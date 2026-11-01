import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';

type AgentStatus = 'idle' | 'connecting' | 'ready' | 'listening' | 'speaking' | 'ended';
type TabName = 'budget' | 'timeline' | 'vendors' | 'ideas';

interface Msg {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  text: string;
}

export interface VoiceAgentProps {
  plan?: PlanOutput | null;
  input?: WizardInput | null;
  onNavigateTab?: (tab: TabName) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function float32ToPcm16Base64(f32: Float32Array): string {
  const buf = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, f32[i]));
    buf[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(buf.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function pcm16Base64ToFloat32(b64: string, sampleRate: number): AudioBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const ctx = new AudioContext({ sampleRate });
  const buf = ctx.createBuffer(1, int16.length, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < int16.length; i++) ch[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  ctx.close();
  return buf;
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Tap to Talk',
  connecting: 'Connecting…',
  ready: 'Ready',
  listening: 'Listening…',
  speaking: 'Utsav Speaking…',
  ended: 'Call Ended',
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#6b7280',
  connecting: '#f59e0b',
  ready: '#10b981',
  listening: '#ef4444',
  speaking: '#3b82f6',
  ended: '#6b7280',
};

// ─── component ────────────────────────────────────────────────────────────────

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ plan, input, onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [messages, setMessages] = useState<Msg[]>([]);
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
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
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
  const addMsg = useCallback((role: Msg['role'], text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { id, role, text }]);
    return id;
  }, []);

  const appendAgent = useCallback((id: string | null, chunk: string) => {
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m)),
    );
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
          topBudgetItems: plan.budget.slice(0, 6).map(
            (b) => `${b.category}: ₹${b.amount.toLocaleString('en-IN')} (${b.suggestedPercent}%)`,
          ),
          upcomingTasks: plan.timeline
            .filter((t) => !t.completed)
            .slice(0, 4)
            .map((t) => `${t.title} — due ${t.date}`),
          vendors: plan.vendors.slice(0, 6).map(
            (v) => `${v.category} — budget ₹${v.budgetedAmount.toLocaleString('en-IN')} — status: ${v.status}`,
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
          sourceListRef.current.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
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
            setMessages((prev) => [...prev, { id: agentMsgIdRef.current!, role: 'agent', text: '' }]);
          }
          appendAgent(agentMsgIdRef.current, ot.text);
        }

        const mt = sc.modelTurn as { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } | undefined;
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
              } catch { /* decode error — skip chunk */ }
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
        const calls = (msg.toolCall as { functionCalls: Array<{ id: string; name: string; args: Record<string, string> }> }).functionCalls;
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

      // Get API key from server
      const resp = await fetch('/api/voice/session');
      if (!resp.ok) throw new Error('Voice session unavailable');
      const { apiKey } = await resp.json();

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
        wsRef.current.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: pcm } },
        }));
      };

      // Open WebSocket to Gemini Live API
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`,
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

        ws.send(JSON.stringify({
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
            tools: [{
              functionDeclarations: [
                {
                  name: 'get_celebration_plan',
                  description: 'Get the current celebration plan — budget breakdown, timeline, vendors, and summary.',
                  parameters: { type: 'OBJECT', properties: {} },
                },
                {
                  name: 'search_vendors',
                  description: 'Search for real local vendors near a city using Google Maps. Returns names, phone numbers, ratings, and addresses.',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      category: { type: 'STRING', description: 'Vendor type: photographer, caterer, decorator, mehendi artist, DJ, pandit, banquet hall, tent house, etc.' },
                      city: { type: 'STRING', description: 'Indian city name, e.g. Mumbai, Delhi, Bangalore, Jaipur' },
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
                      tab: { type: 'STRING', description: 'One of: budget, timeline, vendors, ideas' },
                    },
                    required: ['tab'],
                  },
                },
              ],
            }],
          },
        }));
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
      addMsg('system', `⚠️ ${err instanceof Error ? err.message : 'Could not start voice session.'}`);
    }
  }, [handleMsg, addMsg, pollVolume]);

  // ── disconnect ──
  const disconnect = useCallback(() => {
    cancelAnimationFrame(volRafRef.current);
    setMicVol(0);
    sourceListRef.current.forEach((s) => { try { s.stop(); } catch { /* ok */ } });
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
  useEffect(() => () => { disconnect(); }, [disconnect]);

  const canConnect = status === 'idle' || status === 'ended';

  // ── ring scale based on mic vol ──
  const ringScale = 1 + micVol * 0.45;
  const btnScale = 1 + micVol * 0.08;

  return (
    <>
      <style>{`
        @keyframes uv-pulse {
          0%,100% { opacity:.35; transform:scale(1); }
          50% { opacity:.7; transform:scale(1.15); }
        }
        @keyframes uv-spin {
          from { transform:rotate(0deg); }
          to { transform:rotate(360deg); }
        }
        .uv-ring {
          position:absolute; inset:-10px; border-radius:50%;
          border:2px solid rgba(255,111,0,.55);
          transition:transform .05s linear;
          pointer-events:none;
        }
        .uv-ring.idle { animation:uv-pulse 2.5s ease-in-out infinite; }
        .uv-ring.connecting { animation:uv-spin 1s linear infinite; border-style:dashed; }
      `}</style>

      {/* Floating button */}
      <div style={{
        position: 'fixed', bottom: '1.75rem', right: '1.75rem', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem',
      }}>
        {/* Voice panel */}
        {isOpen && (
          <div style={{
            width: '340px', maxHeight: '480px',
            background: 'var(--surface-card)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 40px rgba(0,0,0,.25)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '0.85rem 1rem',
              background: 'linear-gradient(135deg,var(--primary-saffron) 0%,var(--primary-magenta) 100%)',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}>
              <span style={{ fontSize: '1.15rem' }}>🎙️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Utsav Voice</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{
                    display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                    background: STATUS_COLOR[status],
                    boxShadow: `0 0 6px ${STATUS_COLOR[status]}`,
                  }} />
                  {STATUS_LABEL[status]}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem' }}
                aria-label="Close voice agent"
              >✕</button>
            </div>

            {/* Transcript */}
            <div
              ref={transcriptRef}
              style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', minHeight: '120px' }}
            >
              {messages.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', margin: 'auto 0' }}>
                  Press <strong>Connect</strong> below and start talking!
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : m.role === 'system' ? 'center' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: m.role === 'system' ? '0.25rem 0.6rem' : '0.5rem 0.75rem',
                    borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : m.role === 'tool' ? '8px' : '12px 12px 12px 2px',
                    fontSize: '0.8rem',
                    lineHeight: 1.45,
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg,var(--primary-saffron),var(--primary-magenta))'
                      : m.role === 'agent'
                        ? 'var(--surface-card-hover)'
                        : m.role === 'tool'
                          ? 'rgba(16,185,129,.1)'
                          : 'transparent',
                    color: m.role === 'user' ? '#fff' : m.role === 'system' ? 'var(--text-muted)' : m.role === 'tool' ? '#10b981' : 'var(--text-main)',
                    border: m.role === 'agent' ? '1px solid var(--surface-border)' : m.role === 'tool' ? '1px dashed #10b981' : 'none',
                    fontStyle: m.role === 'system' ? 'italic' : 'normal',
                    fontFamily: m.role === 'tool' ? 'monospace' : 'inherit',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.text || (m.role === 'agent' ? '…' : '')}
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--surface-border)',
              display: 'flex', gap: '0.5rem',
            }}>
              {canConnect ? (
                <button
                  type="button"
                  onClick={connect}
                  style={{
                    flex: 1, padding: '0.6rem', fontWeight: 700, fontSize: '0.875rem',
                    borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,var(--primary-saffron),var(--primary-magenta))',
                    color: '#fff', boxShadow: '0 2px 8px rgba(230,81,0,.3)',
                  }}
                >
                  🎙️ Connect &amp; Talk
                </button>
              ) : (
                <button
                  type="button"
                  onClick={disconnect}
                  style={{
                    flex: 1, padding: '0.6rem', fontWeight: 700, fontSize: '0.875rem',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)',
                    cursor: 'pointer', background: 'var(--surface-card-hover)', color: 'var(--text-main)',
                  }}
                >
                  ⏹ End Call
                </button>
              )}
            </div>
          </div>
        )}

        {/* FAB */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label="Open Utsav Voice Agent"
          style={{
            position: 'relative',
            width: '58px', height: '58px',
            borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: isOpen
              ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
              : 'linear-gradient(135deg,var(--primary-saffron),var(--primary-magenta))',
            boxShadow: '0 4px 20px rgba(230,81,0,.45)',
            fontSize: '1.4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${isOpen ? btnScale : 1})`,
            transition: 'transform .05s linear, background .2s',
          }}
        >
          <span className={`uv-ring ${isOpen ? (status === 'connecting' ? 'connecting' : '') : 'idle'}`}
            style={{ transform: `scale(${isOpen && status === 'listening' ? ringScale : 1})` }} />
          {isOpen ? '✕' : '🎙️'}
        </button>
      </div>
    </>
  );
};
