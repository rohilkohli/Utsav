import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceTranscriptMessage } from '../components/voice/VoiceTranscript';
import type { AgentStatus, VoiceAgentProps } from '../components/voice/voiceTypes';
import { VoiceAudio } from '../components/voice/voiceAudio';
import { voiceMessageHandler } from '../components/voice/voiceMessages';
import { voiceSetup } from '../components/voice/voiceSetup';
import { useVoiceTools } from '../components/voice/useVoiceTools';

export function useVoiceSession(props: VoiceAgentProps) {
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [messages, setMessages] = useState<VoiceTranscriptMessage[]>([]);
  const [micVolume, setMicVolume] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const audio = useRef<VoiceAudio | null>(null);
  const generation = useRef(0);
  const execute = useVoiceTools(props);
  const latestExecute = useRef(execute);
  useEffect(() => {
    latestExecute.current = execute;
  }, [execute]);
  const add = useCallback((role: VoiceTranscriptMessage['role'], text: string) => {
    const id = crypto.randomUUID();
    setMessages((previous) => [...previous, { id, role, text }].slice(-200));
    return id;
  }, []);
  const append = useCallback((id: string, text: string) => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === id ? { ...message, text: message.text + text } : message,
      ),
    );
  }, []);
  const release = useCallback(() => {
    generation.current += 1;
    audio.current?.stop();
    audio.current = null;
    const connection = socket.current;
    socket.current = null;
    if (connection) {
      connection.onclose = null;
      connection.onerror = null;
      connection.onmessage = null;
      connection.close(1000, 'Session ended');
    }
  }, []);
  const disconnect = useCallback(() => {
    release();
    setMicVolume(0);
    setStatus('idle');
  }, [release]);
  const connect = useCallback(async () => {
    release();
    const current = generation.current;
    setStatus('connecting');
    setMessages([]);
    const engine = new VoiceAudio(setMicVolume);
    audio.current = engine;
    const send = (text: string) => {
      if (socket.current?.readyState === WebSocket.OPEN && socket.current.bufferedAmount < 262144)
        socket.current.send(text);
    };
    try {
      await engine.start(send);
      if (generation.current !== current) {
        engine.stop();
        return;
      }
      const connection = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/voice/ws`,
      );
      socket.current = connection;
      const handle = voiceMessageHandler({
        audio: engine,
        setStatus,
        add,
        append,
        execute: (name, args) => latestExecute.current(name, args),
        send,
      });
      connection.onopen = () => {
        if (current === generation.current) send(JSON.stringify(voiceSetup()));
      };
      connection.onmessage = (event: MessageEvent<unknown>) => {
        if (current !== generation.current) return;
        if (typeof event.data === 'string') void handle(event.data);
        else if (event.data instanceof Blob) void event.data.text().then(handle);
      };
      const end = () => {
        if (current !== generation.current) return;
        release();
        setMicVolume(0);
        setStatus('ended');
        add('system', 'Voice connection ended. You can reconnect or continue planning by typing.');
      };
      connection.onerror = end;
      connection.onclose = end;
    } catch (error) {
      if (current !== generation.current) return;
      release();
      setStatus('ended');
      setMicVolume(0);
      add(
        'system',
        error instanceof Error ? error.message : 'Voice is unavailable. Please try again.',
      );
    }
  }, [release, add, append]);
  useEffect(() => release, [release]);
  return { status, messages, micVolume, connect, disconnect };
}
