import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../../lib/audioPcm';

/** Owns all microphone and playback resources for exactly one connection. */
export class VoiceAudio {
  private microphone: AudioContext | null = null;
  private playback: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private frame = 0;
  private nextPlay = 0;
  private closed = false;
  constructor(private readonly onVolume: (volume: number) => void) {}

  async start(send: (message: string) => void) {
    this.microphone = new AudioContext({ sampleRate: 16000 });
    this.playback = new AudioContext({ sampleRate: 24000 });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (this.closed) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      return;
    }
    this.stream = stream;
    const source = this.microphone.createMediaStreamSource(stream);
    const analyser = this.microphone.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const poll = () => {
      if (this.closed) return;
      analyser.getByteFrequencyData(bins);
      this.onVolume(bins.reduce((sum, value) => sum + value, 0) / bins.length / 128);
      this.frame = requestAnimationFrame(poll);
    };
    poll();
    await this.microphone.audioWorklet.addModule('/pcm-worklet.js');
    if (this.isClosed()) return;
    this.worklet = new AudioWorkletNode(this.microphone, 'pcm-processor');
    source.connect(this.worklet);
    this.worklet.connect(this.microphone.destination);
    this.worklet.port.onmessage = (event: MessageEvent<unknown>) => {
      if (!(event.data instanceof Float32Array) || this.closed) return;
      send(
        JSON.stringify({
          realtimeInput: {
            audio: { mimeType: 'audio/pcm;rate=16000', data: float32ToPcm16Base64(event.data) },
          },
        }),
      );
    };
  }

  private isClosed() {
    return this.closed;
  }

  play(encoded: string, onDone: () => void) {
    const context = this.playback;
    if (!context || this.closed) return;
    const buffer = pcm16Base64ToFloat32(encoded, 24000, context);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const at = Math.max(context.currentTime, this.nextPlay);
    source.start(at);
    this.nextPlay = at + buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source);
      if (!this.sources.length && !this.closed) onDone();
    };
  }

  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.sources = [];
    this.nextPlay = this.playback?.currentTime ?? 0;
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    this.interrupt();
    this.worklet?.disconnect();
    this.stream?.getTracks().forEach((track) => {
      track.stop();
    });
    if (this.microphone) void this.microphone.close().catch(() => undefined);
    if (this.playback) void this.playback.close().catch(() => undefined);
    this.microphone = null;
    this.playback = null;
  }
}
