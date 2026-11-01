import React from 'react';

export interface VoiceTranscriptMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  text: string;
}

interface VoiceTranscriptProps {
  messages: VoiceTranscriptMessage[];
  transcriptRef: React.RefObject<HTMLDivElement>;
}

export const VoiceTranscript: React.FC<VoiceTranscriptProps> = ({ messages, transcriptRef }) => (
  <div ref={transcriptRef} className="voice-transcript">
    {messages.length === 0 && <p className="voice-transcript__empty">Press <strong>Connect</strong> below and start talking!</p>}
    {messages.map((message) => (
      <div key={message.id} className={`voice-message voice-message--${message.role}`}>
        <div className="voice-message__bubble">{message.text || (message.role === 'agent' ? '…' : '')}</div>
      </div>
    ))}
  </div>
);
