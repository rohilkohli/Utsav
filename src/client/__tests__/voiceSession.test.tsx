// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceSession } from '../hooks/useVoiceSession';

const state = vi.hoisted(() => ({ start: vi.fn<() => Promise<void>>(), stop: vi.fn() }));
vi.mock('../components/voice/voiceAudio', () => ({
  VoiceAudio: class {
    start = state.start;
    stop = state.stop;
    interrupt = vi.fn();
    play = vi.fn();
  },
}));
vi.mock('../components/voice/useVoiceTools', () => ({
  useVoiceTools: () => () => Promise.resolve('facts'),
}));
const sockets: FakeSocket[] = [];
class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });
  constructor(readonly url: string) {
    sockets.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}
beforeEach(() => {
  state.start.mockReset().mockResolvedValue(undefined);
  state.stop.mockClear();
  sockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice session cancellation and resource ownership', () => {
  it('connects only to the same-origin relay and releases resources on disconnect', async () => {
    const hook = renderHook(() => useVoiceSession({}));
    await act(async () => {
      await hook.result.current.connect();
    });
    const socket = sockets[0];
    expect(socket?.url).toBe(`ws://${window.location.host}/api/voice/ws`);
    act(() => {
      socket?.open();
    });
    expect(socket?.send).toHaveBeenCalledWith(expect.stringContaining('get_celebration_plan'));
    await act(async () => {
      socket?.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
      await Promise.resolve();
    });
    expect(hook.result.current.status).toBe('listening');
    act(() => {
      hook.result.current.disconnect();
    });
    expect(hook.result.current.status).toBe('idle');
    expect(socket?.close).toHaveBeenCalledWith(1000, 'Session ended');
    expect(state.stop).toHaveBeenCalledOnce();
    hook.unmount();
  });
  it('ends cleanly on microphone permission failure', async () => {
    state.start.mockRejectedValueOnce(new Error('Microphone permission denied'));
    const hook = renderHook(() => useVoiceSession({}));
    await act(async () => {
      await hook.result.current.connect();
    });
    expect(hook.result.current.status).toBe('ended');
    expect(hook.result.current.messages[0]?.text).toContain('permission denied');
    expect(state.stop).toHaveBeenCalledOnce();
    expect(sockets).toHaveLength(0);
  });
  it('ignores a cancelled microphone permission response after unmount', async () => {
    let finish: (() => void) | undefined;
    state.start.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const hook = renderHook(() => useVoiceSession({}));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = hook.result.current.connect();
    });
    hook.unmount();
    await act(async () => {
      finish?.();
      await pending;
    });
    expect(sockets).toHaveLength(0);
    expect(state.stop).toHaveBeenCalled();
  });
  it('releases mic/playback when the relay reports a connection failure', async () => {
    const hook = renderHook(() => useVoiceSession({}));
    await act(async () => {
      await hook.result.current.connect();
    });
    act(() => {
      sockets[0]?.onerror?.();
    });
    await waitFor(() => {
      expect(hook.result.current.status).toBe('ended');
    });
    expect(state.stop).toHaveBeenCalledOnce();
    expect(hook.result.current.messages[0]?.text).toContain('connection ended');
  });
});
