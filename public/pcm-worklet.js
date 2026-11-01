/** Same-origin worklet so strict script-src 'self' never needs blob: or inline code. */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(1024);
    this.position = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.buffer[this.position++] = sample;
      if (this.position === this.buffer.length) {
        this.port.postMessage(this.buffer.slice());
        this.position = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
