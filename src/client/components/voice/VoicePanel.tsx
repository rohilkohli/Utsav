import './VoicePanel.css';
import { useRef } from 'react';
import type { RefObject } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { VoiceTranscript } from './VoiceTranscript';
import type { VoiceTranscriptMessage } from './VoiceTranscript';
import type { AgentStatus } from './voiceTypes';

const labels: Record<AgentStatus, string> = {
  idle: 'Tap to Talk',
  connecting: 'Connecting…',
  ready: 'Ready',
  listening: 'Listening…',
  speaking: 'Utsav Speaking…',
  ended: 'Call Ended',
};
interface VoicePanelProps {
  isOpen: boolean;
  status: AgentStatus;
  messages: VoiceTranscriptMessage[];
  transcriptRef: RefObject<HTMLDivElement>;
  canConnect: boolean;
  micVolume: number;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}
export function VoicePanel({
  isOpen,
  status,
  messages,
  transcriptRef,
  canConnect,
  micVolume,
  onToggle,
  onConnect,
  onDisconnect,
}: VoicePanelProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialog, onToggle);
  return (
    <div className="voice-launcher">
      {isOpen && (
        <div
          className="voice-panel"
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-panel-title"
          tabIndex={-1}
        >
          <div className="voice-panel__header">
            <span aria-hidden="true">🎙️</span>
            <div className="voice-panel__title">
              <strong id="voice-panel-title">Utsav Voice</strong>
              <span role="status">
                <i className={`voice-status voice-status--${status}`} />
                {labels[status]}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="voice-panel__close"
              aria-label="Close voice agent"
            >
              ✕
            </button>
          </div>
          <VoiceTranscript messages={messages} transcriptRef={transcriptRef} />
          <meter
            className="voice-level"
            min={0}
            max={1}
            value={Math.min(1, micVolume)}
            aria-label="Microphone level"
          />
          <div className="voice-panel__controls">
            {canConnect ? (
              <button type="button" onClick={onConnect} className="voice-panel__primary">
                🎙️ Connect &amp; Talk
              </button>
            ) : (
              <button type="button" onClick={onDisconnect} className="voice-panel__secondary">
                ⏹ End Call
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Close Utsav Voice Agent' : 'Open Utsav Voice Agent'}
        aria-expanded={isOpen}
        className={`voice-fab ${isOpen ? 'voice-fab--open' : ''}`}
      >
        <span className={`uv-ring ${isOpen ? status : 'idle'}`} aria-hidden="true" />
        {isOpen ? '✕' : '🎙️'}
      </button>
    </div>
  );
}
