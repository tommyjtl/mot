import {
  isCompleteTranscriptSentence,
  partitionTranscriptSentences,
  translationSourcesMatch,
} from "./transcript-sentence";

/** One finalized sentence and its translation (never retranslated). */
export type FrozenTranslation = {
  source: string;
  translation: string;
};

/**
 * Real-time translation state for live transcript overlay.
 *
 * Pipeline:
 * 1. Transcript updates call `syncRealtimeTranslationState` to split text into
 *    frozen sentences + one active chunk (in-progress last sentence).
 * 2. A single worker translates oldest missing frozen sentences (catch-up mode)
 *    and the active tail (debounced while transcription grows).
 * 3. When the active chunk gains sentence-ending punctuation, its translation
 *    is promoted into `frozenTranslations` and translation stops for that chunk.
 * 4. Display joins all frozen translations plus the active tail translation.
 */
export type RealtimeTranslationState = {
  frozenTranslations: FrozenTranslation[];
  activeSource: string | null;
  activeTranslation: string | null;
  /** Source text that `activeTranslation` was produced for (may lag while chunk grows). */
  translatedActiveSource: string | null;
};

export const REALTIME_TRANSLATION_DEBOUNCE_MS = 600;

export function emptyRealtimeTranslationState(): RealtimeTranslationState {
  return {
    frozenTranslations: [],
    activeSource: null,
    activeTranslation: null,
    translatedActiveSource: null,
  };
}

function findCompletedSentenceForActive(
  previousActive: string,
  completeSentences: string[],
): string | null {
  const trimmed = previousActive.trim();
  if (!trimmed) {
    return null;
  }

  for (let index = completeSentences.length - 1; index >= 0; index -= 1) {
    const sentence = completeSentences[index]!;
    if (translationSourcesMatch(sentence, trimmed)) {
      return sentence;
    }

    if (
      isCompleteTranscriptSentence(sentence) &&
      sentence.startsWith(trimmed)
    ) {
      return sentence;
    }
  }

  return completeSentences.at(-1) ?? null;
}

/** Map session-store fields to the consolidated translation state shape. */
export function readRealtimeTranslationState(session: {
  sentenceTranslationEntries: FrozenTranslation[];
  cachedPendingSentence: string | null;
  cachedPendingTranslation: string | null;
  cachedActiveTranslationSource: string | null;
}): RealtimeTranslationState {
  return {
    frozenTranslations: session.sentenceTranslationEntries,
    activeSource: session.cachedPendingSentence,
    activeTranslation: session.cachedPendingTranslation,
    translatedActiveSource: session.cachedActiveTranslationSource,
  };
}

/** Map consolidated state back onto session-store fields. */
export function writeRealtimeTranslationState(
  state: RealtimeTranslationState,
): {
  sentenceTranslationEntries: FrozenTranslation[];
  cachedPendingSentence: string | null;
  cachedPendingTranslation: string | null;
  cachedActiveTranslationSource: string | null;
} {
  return {
    sentenceTranslationEntries: state.frozenTranslations,
    cachedPendingSentence: state.activeSource,
    cachedPendingTranslation: state.activeTranslation,
    cachedActiveTranslationSource: state.translatedActiveSource,
  };
}

/** Reconcile translation state from the current visible transcript text. */
export function syncRealtimeTranslationState(
  text: string,
  previous: RealtimeTranslationState,
): RealtimeTranslationState {
  const { complete, pending } = partitionTranscriptSentences(text);
  const translationsBySource = new Map<string, string>();

  for (const entry of previous.frozenTranslations) {
    if (entry.translation) {
      translationsBySource.set(entry.source, entry.translation);
    }
  }

  if (
    !pending &&
    previous.activeSource &&
    previous.activeTranslation
  ) {
    const finalizedAs = findCompletedSentenceForActive(
      previous.activeSource,
      complete,
    );
    if (finalizedAs) {
      translationsBySource.set(finalizedAs, previous.activeTranslation);
    }
  }

  const frozenTranslations = complete.map((source) => ({
    source,
    translation: translationsBySource.get(source) ?? "",
  }));

  if (pending) {
    if (pending === previous.activeSource) {
      return {
        frozenTranslations,
        activeSource: pending,
        activeTranslation: previous.activeTranslation,
        translatedActiveSource: previous.translatedActiveSource,
      };
    }

    const keepsStaleTranslation = shouldKeepStaleActiveTranslation(
      previous,
      pending,
    );

    return {
      frozenTranslations,
      activeSource: pending,
      activeTranslation: keepsStaleTranslation ? previous.activeTranslation : null,
      translatedActiveSource: keepsStaleTranslation
        ? previous.translatedActiveSource
        : null,
    };
  }

  const lastComplete = complete.at(-1);
  if (!lastComplete) {
    return {
      frozenTranslations,
      activeSource: null,
      activeTranslation: null,
      translatedActiveSource: null,
    };
  }

  const existingTranslation = translationsBySource.get(lastComplete);
  if (existingTranslation) {
    return {
      frozenTranslations,
      activeSource: null,
      activeTranslation: null,
      translatedActiveSource: null,
    };
  }

  // Toggle-on or paused: translate the last complete sentence once, then freeze it.
  return {
    frozenTranslations,
    activeSource: lastComplete,
    activeTranslation: null,
    translatedActiveSource: null,
  };
}

/** Text that should be sent to the translator on the next debounced pass. */
export function getActiveTranslationTarget(
  state: RealtimeTranslationState,
): string | null {
  const target = state.activeSource?.trim();
  return target || null;
}

/** Skip a translator call when the active chunk already has a fresh translation. */
export function shouldRetranslateActiveChunk(
  state: RealtimeTranslationState,
): boolean {
  const target = getActiveTranslationTarget(state);
  if (!target) {
    return false;
  }

  return (
    !state.activeTranslation || state.translatedActiveSource !== target
  );
}

function firstUntranslatedFrozenSource(
  state: RealtimeTranslationState,
): string | null {
  const entry = state.frozenTranslations.find(
    (candidate) => !candidate.translation.trim(),
  );
  return entry?.source ?? null;
}

/** Whether any frozen or active sentence still needs a translator pass. */
export function hasPendingTranslationWork(
  state: RealtimeTranslationState,
): boolean {
  if (firstUntranslatedFrozenSource(state)) {
    return true;
  }

  return shouldRetranslateActiveChunk(state);
}

/**
 * Pick the next source string to send to the translator.
 * In catch-up mode, frozen sentences are translated oldest-first before the tail.
 */
export function getNextTranslationTarget(
  state: RealtimeTranslationState,
  options: { catchupMode?: boolean } = {},
): string | null {
  const missingFrozen = firstUntranslatedFrozenSource(state);

  if (options.catchupMode && missingFrozen) {
    return missingFrozen;
  }

  const activeTarget = getActiveTranslationTarget(state);
  if (activeTarget && shouldRetranslateActiveChunk(state)) {
    return activeTarget;
  }

  return missingFrozen;
}

/** Whether the active tail translation is behind the current source chunk. */
export function isActiveTranslationStale(
  state: RealtimeTranslationState,
): boolean {
  const target = getActiveTranslationTarget(state);
  if (!target || !state.activeTranslation?.trim()) {
    return false;
  }

  return shouldRetranslateActiveChunk(state);
}

function normalizeTranslationLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildRealtimeTranslationDisplay(
  state: RealtimeTranslationState,
  options: { markStaleTail?: boolean } = {},
): string {
  const parts = state.frozenTranslations
    .map((entry) => normalizeTranslationLine(entry.translation))
    .filter(Boolean);

  if (state.activeTranslation) {
    let tail = normalizeTranslationLine(state.activeTranslation);
    if (options.markStaleTail && isActiveTranslationStale(state)) {
      tail = `${tail} …`;
    }
    parts.push(tail);
  }

  return parts.join(" ");
}

function shouldKeepStaleActiveTranslation(
  previous: RealtimeTranslationState,
  pending: string,
): boolean {
  if (!previous.activeTranslation) {
    return false;
  }

  const candidates = [
    previous.activeSource,
    previous.translatedActiveSource,
  ].filter((value): value is string => Boolean(value?.trim()));

  return candidates.some((candidate) =>
    translationSourcesMatch(pending, candidate),
  );
}

export type ApplyActiveTranslationResult = {
  state: RealtimeTranslationState;
  applied: boolean;
};

/** Store a translator result on the active chunk or its newly frozen sentence. */
export function applyActiveTranslationResult(
  state: RealtimeTranslationState,
  source: string,
  translation: string,
  text: string,
): ApplyActiveTranslationResult {
  const { complete, pending } = partitionTranscriptSentences(text);

  if (pending && translationSourcesMatch(pending, source)) {
    return {
      applied: true,
      state: {
        ...state,
        activeSource: pending,
        activeTranslation: translation,
        translatedActiveSource: pending,
      },
    };
  }

  const frozenMatch = complete.find((sentence) =>
    translationSourcesMatch(sentence, source),
  );
  if (frozenMatch) {
    const frozenTranslations = state.frozenTranslations.map((entry) =>
      entry.source === frozenMatch ? { ...entry, translation } : entry,
    );

    return {
      applied: true,
      state: syncRealtimeTranslationState(text, {
        ...state,
        frozenTranslations,
      }),
    };
  }

  if (
    state.activeSource &&
    translationSourcesMatch(state.activeSource, source)
  ) {
    return {
      applied: true,
      state: {
        ...state,
        activeTranslation: translation,
        translatedActiveSource: state.activeSource,
      },
    };
  }

  return { applied: false, state };
}
