import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceAudio } from '../components/voice/voiceAudio';
import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../lib/audioPcm';

const contexts: FakeAudioContext[] = [];
const worklets: FakeWorklet[] = [];
class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeAudioContext {
  destination = {};
  currentTime = 3;
  audioWorklet = { addModule: vi.fn(() => Promise.resolve()) };
  sources: FakeSource[] = [];
  close = vi.fn(() => Promise.resolve());
  constructor(readonly options: { sampleRate: number }) {
    contexts.push(this);
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 2,
      getByteFrequencyData: (buffer: Uint8Array) => {
        buffer.fill(64);
      },
    };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createBuffer(_channels: number, length: number, rate: number) {
    const values = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => values };
  }
}
class FakeWorklet {
  connect = vi.fn();
  disconnect = vi.fn();
  port: { onmessage: ((event: { data: unknown }) => void) | null } = { onmessage: null };
  constructor() {
    worklets.push(this);
  }
}
const track = { stop: vi.fn() };
const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [track] }));
beforeEach(() => {
  contexts.length = 0;
  worklets.length = 0;
  track.stop.mockClear();
  getUserMedia.mockClear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeWorklet);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice microphone and playback lifecycle', () => {
  it('loads a same-origin worklet, streams PCM and closes every resource', async () => {
    const volume = vi.fn();
    const send = vi.fn();
    const audio = new VoiceAudio(volume);
    await audio.start(send);
    expect(contexts[0]?.audioWorklet.addModule).toHaveBeenCalledWith('/pcm-worklet.js');
    expect(volume).toHaveBeenCalledWith(0.5);
    worklets[0]?.port.onmessage?.({ data: new Float32Array([0, -0.5, 1]) });
    expect(send).toHaveBeenCalledWith(expect.stringContaining('audio/pcm;rate=16000'));
    worklets[0]?.port.onmessage?.({ data: 'not PCM' });
    expect(send).toHaveBeenCalledOnce();
    const done = vi.fn();
    audio.play(float32ToPcm16Base64(new Float32Array([0, -0.5, 1])), done);
    const source = contexts[1]?.sources[0];
    expect(source?.start).toHaveBeenCalledWith(3);
    source?.onended?.();
    expect(done).toHaveBeenCalledOnce();
    audio.play('AAA=', done);
    audio.interrupt();
    expect(contexts[1]?.sources[1]?.stop).toHaveBeenCalledOnce();
    audio.stop();
    audio.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(worklets[0]?.disconnect).toHaveBeenCalledOnce();
    expect(contexts[0]?.close).toHaveBeenCalledOnce();
    expect(contexts[1]?.close).toHaveBeenCalledOnce();
  });
  it('stops a late permission response after session cancellation', async () => {
    let resolvePermission: ((value: { getTracks: () => (typeof track)[] }) => void) | undefined;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const audio = new VoiceAudio(vi.fn());
    const pending = audio.start(vi.fn());
    audio.stop();
    resolvePermission?.({ getTracks: () => [track] });
    await pending;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(worklets).toHaveLength(0);
  });
  it('clamps PCM samples and decodes into the shared playback context', () => {
    const encoded = float32ToPcm16Base64(new Float32Array([-2, -1, 0, 1, 2]));
    const samples = new Int16Array(
      Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)).buffer,
    );
    expect(Array.from(samples)).toEqual([-32768, -32768, 0, 32767, 32767]);
    const context = new AudioContext({ sampleRate: 24000 });
    const buffer = pcm16Base64ToFloat32(encoded, 24000, context);
    expect(Array.from(buffer.getChannelData(0))).toEqual([-1, -1, 0, 1, 1]);
    expect(contexts[0]?.close).not.toHaveBeenCalled();
    pcm16Base64ToFloat32(encoded, 24000);
    expect(contexts[1]?.close).toHaveBeenCalledOnce();
  });
});
