export function writeWavFile(audioData: number[], sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = audioData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const int16Data = new Int16Array(buffer, 44);
  for (let index = 0; index < audioData.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, audioData[index] ?? 0));
    int16Data[index] = Math.floor(clamped * 32767);
  }

  return buffer;
}

export function audioDurationSeconds(sampleCount: number, sampleRate: number): number {
  return sampleCount / sampleRate;
}

export function readWavSamples(buffer: ArrayBuffer): {
  samples: Float32Array;
  sampleRate: number;
} {
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataOffset = 44;

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
  }

  const int16 = new Int16Array(buffer, dataOffset);
  const samples = new Float32Array(int16.length);
  for (let index = 0; index < int16.length; index += 1) {
    samples[index] = (int16[index] ?? 0) / 32768;
  }

  return { samples, sampleRate };
}
