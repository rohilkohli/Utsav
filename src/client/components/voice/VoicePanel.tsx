import React from 'react';
import { VoiceTranscript } from './VoiceTranscript';
import type { VoiceTranscriptMessage } from './VoiceTranscript';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Tap to Talk', connecting: 'Connecting…', ready: 'Ready', listening: 'Listening…', speaking: 'Utsav Speaking…', ended: 'Call Ended',
};
const STATUS_COLOR: Record<string, string> = {
  idle: '#6b7280', connecting: '#f59e0b', ready: '#10b981', listening: '#ef4444', speaking: '#3b82f6', ended: '#6b7280',
};

interface VoicePanelProps {
  isOpen: boolean;
  status: string;
  messages: VoiceTranscriptMessage[];
  transcriptRef: React.RefObject<HTMLDivElement>;
  canConnect: boolean;
  micVolume: number;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ isOpen, status, messages, transcriptRef, canConnect, micVolume, onToggle, onConnect, onDisconnect }) => (
  <div className="voice-launcher">
    {isOpen && (
      <div className="voice-panel">
        <div className="voice-panel__header">
          <span>🎙️</span>
          <div className="voice-panel__title"><strong>Utsav Voice</strong><span><i style={{ background: STATUS_COLOR[status] ?? STATUS_COLOR.idle }} />{STATUS_LABEL[status] ?? status}</span></div>
          <button type="button" onClick={onToggle} className="voice-panel__close" aria-label="Close voice agent">✕</button>
        </div>
        <VoiceTranscript messages={messages} transcriptRef={transcriptRef} />
        <div className="voice-panel__controls">
          {canConnect ? <button type="button" onClick={onConnect} className="voice-panel__primary">🎙️ Connect &amp; Talk</button> : <button type="button" onClick={onDisconnect} className="voice-panel__secondary">⏹ End Call</button>}
        </div>
      </div>
    )}
    <button type="button" onClick={onToggle} aria-label="Open Utsav Voice Agent" className={`voice-fab ${isOpen ? 'voice-fab--open' : ''}`} style={{ transform: `scale(${isOpen ? 1 + micVolume * 0.08 : 1})` }}>
      <span className={`uv-ring ${isOpen ? (status === 'connecting' ? 'connecting' : '') : 'idle'}`} style={{ transform: `scale(${isOpen && status === 'listening' ? 1 + micVolume * 0.45 : 1})` }} />
      {isOpen ? '✕' : '🎙️'}
    </button>
  </div>
);
