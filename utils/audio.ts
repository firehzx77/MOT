export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * PCM(Int16 LE) -> AudioBuffer
 * data: Uint8Array(PCM16)
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Float32 PCM [-1,1] -> base64 PCM16
 * 用于 Live sendRealtimeInput
 */
export function createPcmBlob(data: Float32Array): string {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // clamp
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return encode(new Uint8Array(int16.buffer));
}

/**
 * 通用：base64 -> Blob URL
 * 用于 TTS 返回的 wav base64（以及未来 mp3/ogg 也可复用）
 */
export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function revokeBlobUrl(url: string) {
  try { URL.revokeObjectURL(url); } catch {}
}

/**
 * 快捷：播放 wav base64（如果你需要一行调用）
 */
export async function playWavBase64(wavBase64: string) {
  const url = base64ToBlobUrl(wavBase64, 'audio/wav');
  const audio = new Audio(url);
  try {
    await audio.play();
    audio.onended = () => revokeBlobUrl(url);
    audio.onerror = () => revokeBlobUrl(url);
  } catch {
    revokeBlobUrl(url);
    throw new Error("Failed to play wav audio");
  }
  return audio;
}

// Convert AudioBuffer to WAV blob for saving/replaying
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferData = new ArrayBuffer(length);
  const view = new DataView(bufferData);
  const channels: Float32Array[] = [];
  let i: number, sample: number, offset = 0, pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"
  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded)
  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) { // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale to 16-bit signed int
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferData], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
