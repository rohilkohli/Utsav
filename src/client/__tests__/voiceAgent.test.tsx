// @vitest-environment jsdom
import { useContext } from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { VoiceAgent } from '../components/voice/VoiceAgent';
import type { AgentStatus } from '../components/voice/voiceTypes';
import type { VoiceTranscriptMessage } from '../components/voice/VoiceTranscript';
import { AuthContext } from '../components/auth/context';
const state = vi.hoisted(() => ({
  status: ((): AgentStatus => 'idle')(),
  messages: [] as VoiceTranscriptMessage[],
  micVolume: 0.5,
  connect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  disconnect: vi.fn(),
}));
vi.mock('../hooks/useVoiceSession', () => ({ useVoiceSession: () => state }));
it('coordinates connect/end/close, live transcripts and focus restoration', async () => {
  const user = userEvent.setup();
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scroll, configurable: true });
  const view = render(<VoiceAgent />);
  await user.click(screen.getByRole('button', { name: 'Open Utsav Voice Agent' }));
  await user.click(screen.getByRole('button', { name: /Connect & Talk/ }));
  expect(state.connect).toHaveBeenCalledOnce();
  state.status = 'speaking';
  state.messages = [
    { id: 'agent', role: 'agent', text: '' },
    { id: 'user', role: 'user', text: 'Budget?' },
    { id: 'tool', role: 'tool', text: 'Facts' },
    { id: 'system', role: 'system', text: '' },
  ];
  view.rerender(<VoiceAgent />);
  expect(screen.getByText('…')).toBeVisible();
  expect(screen.getByText('Budget?')).toBeVisible();
  expect(scroll).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /End Call/ }));
  expect(state.disconnect).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Close voice agent' }));
  expect(state.disconnect).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('fails closed when authentication actions are used without a provider', async () => {
  const hook = renderHook(() => useContext(AuthContext));
  await expect(hook.result.current.login()).rejects.toThrow('AuthProvider is required');
  await expect(hook.result.current.logout()).rejects.toThrow('AuthProvider is required');
});
