/**
 * AudioWorkletProcessor that captures mic input and forwards Float32 chunks
 * to the main thread for PCM16 conversion and WebSocket streaming.
 * Buffers 1024 samples (~64 ms at 16 kHz) before posting to reduce message overhead.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(1024);
    this._pos = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this._buf[this._pos++] = channel[i];
      if (this._pos === 1024) {
        this.port.postMessage(this._buf.slice());
        this._pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
