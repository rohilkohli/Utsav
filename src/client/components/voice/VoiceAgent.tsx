import { useEffect, useRef, useState } from 'react';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { VoicePanel } from './VoicePanel';
import type { VoiceAgentProps } from './voiceTypes';
export type { VoiceAgentProps } from './voiceTypes';

export function VoiceAgent(props: VoiceAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const session = useVoiceSession(props);
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [session.messages]);
  return (
    <VoicePanel
      {...session}
      isOpen={isOpen}
      transcriptRef={transcriptRef}
      canConnect={session.status === 'idle' || session.status === 'ended'}
      onToggle={() => {
        if (isOpen) session.disconnect();
        setIsOpen(!isOpen);
      }}
      onConnect={() => {
        void session.connect();
      }}
      onDisconnect={session.disconnect}
    />
  );
}
