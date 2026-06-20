import type { WordTiming } from "../tts-types";

const WORD_RE = /\S+/g;

export type SignalAlignmentOptions = {
  /** Analysis frame length in milliseconds. */
  frameMs?: number;
  /** Hop between frames in milliseconds. */
  hopMs?: number;
  /** Moving-average smoothing window in milliseconds. */
  smoothMs?: number;
  /** Fraction of peak envelope used as the speech floor. */
  energyThreshold?: number;
  /** Minimum duration per word segment. */
  minWordMs?: number;
  /** How far (fraction of average word length) to search for an energy valley. */
  valleySearchRatio?: number;
};

export const DEFAULT_SIGNAL_ALIGNMENT_OPTIONS: SignalAlignmentOptions = {
  frameMs: 10,
  hopMs: 5,
  smoothMs: 25,
  energyThreshold: 0.12,
  minWordMs: 50,
  valleySearchRatio: 0.45,
};

type EnvelopeFrame = {
  timeS: number;
  energy: number;
};

function tokenizeWords(displayText: string): string[] {
  return [...displayText.matchAll(WORD_RE)].map((match) => match[0]!);
}

function computeEnvelope(
  samples: Float32Array | number[],
  sampleRate: number,
  frameMs: number,
  hopMs: number,
): EnvelopeFrame[] {
  const frameSize = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const hopSize = Math.max(1, Math.round((sampleRate * hopMs) / 1000));
  const frames: EnvelopeFrame[] = [];

  for (let start = 0; start < samples.length; start += hopSize) {
    const end = Math.min(start + frameSize, samples.length);
    if (end <= start) {
      break;
    }

    let sumSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      sumSquares += sample * sample;
    }

    frames.push({
      timeS: (start + end) / (2 * sampleRate),
      energy: Math.sqrt(sumSquares / (end - start)),
    });
  }

  return frames;
}

function smoothEnvelope(
  frames: EnvelopeFrame[],
  sampleRate: number,
  hopMs: number,
  smoothMs: number,
): EnvelopeFrame[] {
  const hopSize = Math.max(1, Math.round((sampleRate * hopMs) / 1000));
  const windowFrames = Math.max(
    1,
    Math.round((smoothMs / 1000) * sampleRate) / hopSize,
  );

  return frames.map((frame, index) => {
    let sum = 0;
    let count = 0;
    const half = Math.floor(windowFrames / 2);

    for (let offset = -half; offset <= half; offset += 1) {
      const neighbor = frames[index + offset];
      if (!neighbor) {
        continue;
      }
      sum += neighbor.energy;
      count += 1;
    }

    return {
      timeS: frame.timeS,
      energy: count > 0 ? sum / count : frame.energy,
    };
  });
}

function speechBounds(
  frames: EnvelopeFrame[],
  energyThreshold: number,
): { startS: number; endS: number } {
  if (frames.length === 0) {
    return { startS: 0, endS: 0 };
  }

  const peak = frames.reduce(
    (max, frame) => Math.max(max, frame.energy),
    0,
  );
  const floor = peak * energyThreshold;

  let startIndex = 0;
  while (startIndex < frames.length && (frames[startIndex]?.energy ?? 0) < floor) {
    startIndex += 1;
  }

  let endIndex = frames.length - 1;
  while (endIndex >= 0 && (frames[endIndex]?.energy ?? 0) < floor) {
    endIndex -= 1;
  }

  if (startIndex > endIndex) {
    return { startS: 0, endS: frames.at(-1)?.timeS ?? 0 };
  }

  return {
    startS: frames[startIndex]?.timeS ?? 0,
    endS: frames[endIndex]?.timeS ?? 0,
  };
}

function deepestValleyInWindow(
  frames: EnvelopeFrame[],
  windowStartS: number,
  windowEndS: number,
): number | null {
  let bestTime: number | null = null;
  let bestEnergy = Number.POSITIVE_INFINITY;

  for (let index = 1; index < frames.length - 1; index += 1) {
    const frame = frames[index]!;
    if (frame.timeS < windowStartS || frame.timeS > windowEndS) {
      continue;
    }

    const prev = frames[index - 1]!.energy;
    const next = frames[index + 1]!.energy;
    if (frame.energy >= prev || frame.energy >= next) {
      continue;
    }

    if (frame.energy < bestEnergy) {
      bestEnergy = frame.energy;
      bestTime = frame.timeS;
    }
  }

  return bestTime;
}

function lowestEnergyInWindow(
  frames: EnvelopeFrame[],
  windowStartS: number,
  windowEndS: number,
): number | null {
  let bestTime: number | null = null;
  let bestEnergy = Number.POSITIVE_INFINITY;

  for (const frame of frames) {
    if (frame.timeS < windowStartS || frame.timeS > windowEndS) {
      continue;
    }
    if (frame.energy < bestEnergy) {
      bestEnergy = frame.energy;
      bestTime = frame.timeS;
    }
  }

  return bestTime;
}

function pickBoundaryTimes(
  frames: EnvelopeFrame[],
  speechStartS: number,
  speechEndS: number,
  wordCount: number,
  options: Required<SignalAlignmentOptions>,
): number[] {
  const speechDuration = Math.max(0, speechEndS - speechStartS);
  if (wordCount <= 1 || speechDuration <= 0) {
    return [];
  }

  const avgWordDuration = speechDuration / wordCount;
  const minGapS = options.minWordMs / 1000;
  const searchHalfWidth = avgWordDuration * options.valleySearchRatio;
  const boundaries: number[] = [];

  for (let boundaryIndex = 1; boundaryIndex < wordCount; boundaryIndex += 1) {
    const ideal = speechStartS + boundaryIndex * avgWordDuration;
    const minTime = Math.max(
      speechStartS + boundaryIndex * minGapS,
      (boundaries.at(-1) ?? speechStartS) + minGapS,
    );
    const maxTime = Math.min(
      speechEndS - (wordCount - boundaryIndex) * minGapS,
      speechEndS,
    );

    if (minTime > maxTime) {
      boundaries.push(Math.min(Math.max(ideal, minTime), maxTime));
      continue;
    }

    const windowStart = Math.max(minTime, ideal - searchHalfWidth);
    const windowEnd = Math.min(maxTime, ideal + searchHalfWidth);

    const valley =
      deepestValleyInWindow(frames, windowStart, windowEnd) ??
      lowestEnergyInWindow(frames, windowStart, windowEnd) ??
      Math.min(Math.max(ideal, minTime), maxTime);

    boundaries.push(valley);
  }

  return boundaries;
}

function equalWordBoundaries(
  speechStartS: number,
  speechEndS: number,
  wordCount: number,
): number[] {
  const speechDuration = Math.max(0, speechEndS - speechStartS);
  if (wordCount <= 1 || speechDuration <= 0) {
    return [];
  }

  const boundaries: number[] = [];
  for (let boundaryIndex = 1; boundaryIndex < wordCount; boundaryIndex += 1) {
    boundaries.push(speechStartS + (boundaryIndex / wordCount) * speechDuration);
  }
  return boundaries;
}

/**
 * Map display text to word timings by finding energy valleys in the synthesized audio.
 */
export function wordAlignmentFromAudio(
  samples: Float32Array | number[],
  sampleRate: number,
  displayText: string,
  totalDurationS: number,
  wordIndexStart = 0,
  options: SignalAlignmentOptions = DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
): { words: WordTiming[]; timelineEnd: number } {
  const timelineEnd = totalDurationS > 0 ? totalDurationS : samples.length / sampleRate;
  const tokens = tokenizeWords(displayText);

  if (tokens.length === 0 || timelineEnd <= 0 || samples.length === 0) {
    return { words: [], timelineEnd };
  }

  const resolved: Required<SignalAlignmentOptions> = {
    frameMs: options.frameMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.frameMs!,
    hopMs: options.hopMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.hopMs!,
    smoothMs: options.smoothMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.smoothMs!,
    energyThreshold:
      options.energyThreshold ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.energyThreshold!,
    minWordMs: options.minWordMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.minWordMs!,
    valleySearchRatio:
      options.valleySearchRatio ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.valleySearchRatio!,
  };

  const rawEnvelope = computeEnvelope(
    samples,
    sampleRate,
    resolved.frameMs,
    resolved.hopMs,
  );
  const envelope = smoothEnvelope(
    rawEnvelope,
    sampleRate,
    resolved.hopMs,
    resolved.smoothMs,
  );

  const { startS, endS } = speechBounds(envelope, resolved.energyThreshold);
  const speechStartS = startS;
  const speechEndS = Math.max(endS, speechStartS + resolved.minWordMs / 1000);

  let boundaries =
    envelope.length > 0
      ? pickBoundaryTimes(
          envelope,
          speechStartS,
          speechEndS,
          tokens.length,
          resolved,
        )
      : equalWordBoundaries(speechStartS, speechEndS, tokens.length);

  if (boundaries.length !== Math.max(0, tokens.length - 1)) {
    boundaries = equalWordBoundaries(speechStartS, speechEndS, tokens.length);
  }

  const segmentStarts = [speechStartS, ...boundaries];
  const segmentEnds = [...boundaries, speechEndS];

  const words: WordTiming[] = tokens.map((text, index) => ({
    index: wordIndexStart + index,
    text,
    start: segmentStarts[index] ?? speechStartS,
    end: segmentEnds[index] ?? speechEndS,
  }));

  return { words, timelineEnd };
}
