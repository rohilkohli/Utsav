import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../../lib/audioPcm';
import type { VoiceTranscriptMessage } from './VoiceTranscript';
import { VoicePanel } from './VoicePanel';

type AgentStatus = 'idle' | 'connecting' | 'ready' | 'listening' | 'speaking' | 'ended';
type TabName = 'budget' | 'timeline' | 'vendors' | 'ideas';

export interface VoiceAgentProps {
  plan?: PlanOutput | null;
  input?: WizardInput | null;
  onNavigateTab?: (tab: TabName) => void;
}

// ─── component ────────────────────────────────────────────────────────────────

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ plan, input, onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [messages, setMessages] = useState<VoiceTranscriptMessage[]>([]);
  const [micVol, setMicVol] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceListRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayRef = useRef(0);
  const agentMsgIdRef = useRef<string | null>(null);
  const volRafRef = useRef<number>(0);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // ── scroll transcript to bottom ──
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // ── mic volume animation ──
  const pollVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
    setMicVol(avg / 128);
    volRafRef.current = requestAnimationFrame(pollVolume);
  }, []);

  // ── add message helper ──
  const addMsg = useCallback((role: VoiceTranscriptMessage['role'], text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { id, role, text }]);
    return id;
  }, []);

  const appendAgent = useCallback((id: string | null, chunk: string) => {
    if (!id) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)));
  }, []);

  // ── tool execution ──
  const executeTool = useCallback(
    async (name: string, args: Record<string, string>): Promise<string> => {
      if (name === 'get_celebration_plan') {
        if (!plan || !input)
          return 'No celebration plan has been generated yet. Ask the user to describe their event and generate a plan first.';
        return JSON.stringify({
          summary: plan.summary,
          eventType: input.eventType,
          city: input.city,
          guestCount: input.guestCount,
          eventDate: input.eventDate,
          totalBudget: `₹${input.totalBudget.toLocaleString('en-IN')}`,
          subEvents: input.subEvents,
          topBudgetItems: plan.budget
            .slice(0, 6)
            .map(
              (b) => `${b.category}: ₹${b.amount.toLocaleString('en-IN')} (${b.suggestedPercent}%)`,
            ),
          upcomingTasks: plan.timeline
            .filter((t) => !t.completed)
            .slice(0, 4)
            .map((t) => `${t.title} — due ${t.date}`),
          vendors: plan.vendors
            .slice(0, 6)
            .map(
              (v) =>
                `${v.category} — budget ₹${v.budgetedAmount.toLocaleString('en-IN')} — status: ${v.status}`,
            ),
        });
      }

      if (name === 'search_vendors') {
        try {
          const res = await fetch('/api/vendors/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: args.category, city: args.city || input?.city }),
          });
          if (!res.ok) return 'Vendor search unavailable. Google Maps API may not be configured.';
          const data = await res.json();
          if (!data.suggestions?.length) return 'No vendors found for that category in that city.';
          return data.suggestions
            .map(
              (s: { name: string; rating?: number; phone?: string; address?: string }) =>
                `• ${s.name}${s.rating ? ` (${s.rating}★)` : ''} — ${s.phone || 'no phone'} — ${s.address || ''}`,
            )
            .join('\n');
        } catch {
          return 'Failed to search vendors. Please try again.';
        }
      }

      if (name === 'navigate_to_tab') {
        const tab = args.tab as TabName;
        if (['budget', 'timeline', 'vendors', 'ideas'].includes(tab)) {
          onNavigateTab?.(tab);
          return `Navigated to the ${tab} tab.`;
        }
        return 'Unknown tab. Use one of: budget, timeline, vendors, ideas.';
      }

      return 'Unknown tool.';
    },
    [plan, input, onNavigateTab],
  );

  // ── handle incoming WS message ──
  const handleMsg = useCallback(
    async (raw: string) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // Setup complete
      if (msg.setupComplete) {
        setStatus('listening');
        addMsg('system', '🎙️ Connected! Say hello to Utsav Voice.');
        return;
      }

      // Server content (audio + transcription + barge-in)
      if (msg.serverContent) {
        const sc = msg.serverContent as Record<string, unknown>;

        if (sc.interrupted) {
          sourceListRef.current.forEach((s) => {
            try {
              s.stop();
            } catch {
              /* already stopped */
            }
          });
          sourceListRef.current = [];
          nextPlayRef.current = playCtxRef.current?.currentTime ?? 0;
          setStatus('listening');
          agentMsgIdRef.current = null;
        }

        const it = sc.inputTranscription as { text?: string } | undefined;
        if (it?.text) addMsg('user', it.text);

        const ot = sc.outputTranscription as { text?: string } | undefined;
        if (ot?.text) {
          if (!agentMsgIdRef.current) {
            agentMsgIdRef.current = `${Date.now()}-agent`;
            setMessages((prev) => [
              ...prev,
              { id: agentMsgIdRef.current!, role: 'agent', text: '' },
            ]);
          }
          appendAgent(agentMsgIdRef.current, ot.text);
        }

        const mt = sc.modelTurn as
          { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } | undefined;
        if (mt?.parts) {
          for (const part of mt.parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
              setStatus('speaking');
              try {
                const playCtx = playCtxRef.current!;
                const audioBuf = pcm16Base64ToFloat32(part.inlineData.data, 24000);
                const src = playCtx.createBufferSource();
                src.buffer = audioBuf;
                src.connect(playCtx.destination);
                const now = playCtx.currentTime;
                const startAt = Math.max(now, nextPlayRef.current);
                src.start(startAt);
                nextPlayRef.current = startAt + audioBuf.duration;
                sourceListRef.current.push(src);
                src.onended = () => {
                  sourceListRef.current = sourceListRef.current.filter((x) => x !== src);
                  if (sourceListRef.current.length === 0) setStatus('listening');
                };
              } catch {
                /* decode error — skip chunk */
              }
            }
          }
        }

        if (sc.turnComplete) {
          agentMsgIdRef.current = null;
        }
        return;
      }

      // Tool call
      if (msg.toolCall) {
        const calls = (
          msg.toolCall as {
            functionCalls: Array<{ id: string; name: string; args: Record<string, string> }>;
          }
        ).functionCalls;
        const responses: Array<{ id: string; name: string; response: { output: string } }> = [];
        for (const call of calls) {
          addMsg('tool', `🔧 ${call.name}(${JSON.stringify(call.args)})`);
          const result = await executeTool(call.name, call.args);
          responses.push({ id: call.id, name: call.name, response: { output: result } });
        }
        wsRef.current?.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }
    },
    [addMsg, appendAgent, executeTool],
  );

  // ── connect ──
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setMessages([]);
      agentMsgIdRef.current = null;

      // Mic audio context at 16 kHz
      const micCtx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = micCtx;

      // Playback audio context at 24 kHz
      const playCtx = new AudioContext({ sampleRate: 24000 });
      playCtxRef.current = playCtx;
      nextPlayRef.current = 0;

      // Mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Analyser for volume visualisation
      const src = micCtx.createMediaStreamSource(stream);
      const analyser = micCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      src.connect(analyser);
      volRafRef.current = requestAnimationFrame(pollVolume);

      // AudioWorkletNode for mic capture (replaces deprecated ScriptProcessorNode).
      // Inlined as a Blob URL so it works regardless of static-file hosting / MIME config.
      const workletSrc = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() { super(); this._buf = new Float32Array(1024); this._pos = 0; }
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (!ch) return true;
            for (let i = 0; i < ch.length; i++) {
              this._buf[this._pos++] = ch[i];
              if (this._pos === 1024) { this.port.postMessage(this._buf.slice()); this._pos = 0; }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blob = new Blob([workletSrc], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await micCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      const workletNode = new AudioWorkletNode(micCtx, 'pcm-processor');
      processorRef.current = workletNode;
      src.connect(workletNode);
      workletNode.connect(micCtx.destination);
      workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const pcm = float32ToPcm16Base64(e.data);
        wsRef.current.send(
          JSON.stringify({
            realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: pcm } },
          }),
        );
      };

      const ws = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/voice/ws`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const systemPrompt = `You are Utsav Voice, a warm and knowledgeable AI celebration planning assistant built into Utsav — India's smartest celebration planner.

Current date and time: ${now.toString()}
User timezone: ${tz}

You help users plan weddings, birthdays, festivals, and other Indian celebrations. You can:
1. Answer questions about their celebration plan (use get_celebration_plan tool to fetch it)
2. Search for real vendors — photographers, caterers, decorators, mehendi artists, pandit, DJ, etc. — using Google Maps (use search_vendors tool)
3. Navigate to different sections of the dashboard (use navigate_to_tab tool)
4. Give budget advice, vendor tips, and cultural insights for Indian celebrations

Guidelines:
- Be warm, conversational, and culturally aware. Use Indian terms naturally (shaadi, mandap, baraat, etc.)
- Always use ₹ and Indian number formatting (lakhs, crores) for money
- When a user asks about vendors, proactively call search_vendors with their city
- If no plan exists yet, encourage them to fill in the form and generate one
- Keep responses concise — you are speaking, not typing`;

        ws.send(
          JSON.stringify({
            setup: {
              model: 'models/gemini-2.0-flash-live-001',
              generationConfig: {
                responseModalities: ['AUDIO'],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
                },
              },
              systemInstruction: { parts: [{ text: systemPrompt }] },
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: 'get_celebration_plan',
                      description:
                        'Get the current celebration plan — budget breakdown, timeline, vendors, and summary.',
                      parameters: { type: 'OBJECT', properties: {} },
                    },
                    {
                      name: 'search_vendors',
                      description:
                        'Search for real local vendors near a city using Google Maps. Returns names, phone numbers, ratings, and addresses.',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          category: {
                            type: 'STRING',
                            description:
                              'Vendor type: photographer, caterer, decorator, mehendi artist, DJ, pandit, banquet hall, tent house, etc.',
                          },
                          city: {
                            type: 'STRING',
                            description: 'Indian city name, e.g. Mumbai, Delhi, Bangalore, Jaipur',
                          },
                        },
                        required: ['category', 'city'],
                      },
                    },
                    {
                      name: 'navigate_to_tab',
                      description: 'Switch the dashboard to a specific tab so the user can see it.',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          tab: {
                            type: 'STRING',
                            description: 'One of: budget, timeline, vendors, ideas',
                          },
                        },
                        required: ['tab'],
                      },
                    },
                  ],
                },
              ],
            },
          }),
        );
      };

      ws.onmessage = async (event) => {
        const data = event.data instanceof Blob ? await event.data.text() : event.data;
        await handleMsg(data as string);
      };

      ws.onerror = () => {
        setStatus('ended');
        addMsg('system', '⚠️ Connection error. Please try again.');
      };

      ws.onclose = (e) => {
        if (e.code !== 1000) addMsg('system', `🔌 Disconnected (${e.code}).`);
        setStatus('ended');
      };
    } catch (err) {
      setStatus('ended');
      addMsg(
        'system',
        `⚠️ ${err instanceof Error ? err.message : 'Could not start voice session.'}`,
      );
    }
  }, [handleMsg, addMsg, pollVolume]);

  // ── disconnect ──
  const disconnect = useCallback(() => {
    cancelAnimationFrame(volRafRef.current);
    setMicVol(0);
    sourceListRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* ok */
      }
    });
    sourceListRef.current = [];
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micCtxRef.current?.close();
    micCtxRef.current = null;
    playCtxRef.current?.close();
    playCtxRef.current = null;
    wsRef.current?.close(1000, 'user ended');
    wsRef.current = null;
    agentMsgIdRef.current = null;
    nextPlayRef.current = 0;
    setStatus('idle');
  }, []);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
    } else {
      disconnect();
      setIsOpen(false);
      setMessages([]);
    }
  }, [isOpen, disconnect]);

  // ── cleanup on unmount ──
  useEffect(
    () => () => {
      disconnect();
    },
    [disconnect],
  );

  const canConnect = status === 'idle' || status === 'ended';

  return (
    <VoicePanel
      isOpen={isOpen}
      status={status}
      messages={messages}
      transcriptRef={transcriptRef}
      canConnect={canConnect}
      micVolume={micVol}
      onToggle={handleToggle}
      onConnect={connect}
      onDisconnect={disconnect}
    />
  );
};
