export function float32ToPcm16Base64(f32: Float32Array): string {
  const buffer = new Int16Array(f32.length);
  for (let index = 0; index < f32.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, f32[index] ?? 0));
    buffer[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(buffer.buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export function pcm16Base64ToFloat32(base64: string, sampleRate: number): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const int16 = new Int16Array(bytes.buffer);
  const context = new AudioContext({ sampleRate });
  const buffer = context.createBuffer(1, int16.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < int16.length; index += 1) {
    const sample = int16[index] ?? 0;
    channel[index] = sample / (sample < 0 ? 0x8000 : 0x7fff);
  }
  void context.close();
  return buffer;
}
