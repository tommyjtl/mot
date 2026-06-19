export type WordTiming = {
  index: number;
  text: string;
  start: number;
  end: number;
};

export type TtsAlignment = {
  words: WordTiming[];
};

export type SynthesizeResult = {
  audio: ArrayBuffer;
  text: string;
  durationS: number;
  alignment: TtsAlignment | null;
};
