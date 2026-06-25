import { isSingleWordText } from "../../utils/overlay-phrase";
import { VocabAction } from "./VocabAction";

export type TranslationState =
  | { visible: false }
  | {
      visible: true;
      originalText: string;
      translationText: string;
      mode: "full" | "word";
      loading?: boolean;
      vocabReady?: boolean;
      contextText?: string;
      pageUrl?: string;
      pageTitle?: string;
    };

/** @deprecated Use TranslationState */
export type TranslationViewState = TranslationState;

/** @deprecated Use TranslationState */
export type TranscriptWordTranslationState = TranslationState;

type TranslationPanelProps = {
  state: TranslationState;
  showRestore?: boolean;
  showVocabAction?: boolean;
  /** TTS only: show vocab on Translation row for single-word full-mode selections. */
  singleWordVocabInFullMode?: boolean;
  onRestore?: () => void;
  /** Full passage shown below the translation block (used as vocab context). */
  passageText?: string;
  /** Play pronunciation for the original word (word overlay, saved vocab). */
  onSpeakOriginal?: () => void;
  /** Matches TTS overlay word highlight: loading while synthesizing, active during playback. */
  originalSpeakHighlight?: "idle" | "loading" | "active";
};

export function TranslationPanel({
  state,
  showRestore = true,
  showVocabAction = true,
  singleWordVocabInFullMode = false,
  onRestore,
  passageText,
  onSpeakOriginal,
  originalSpeakHighlight = "idle",
}: TranslationPanelProps) {
  if (!state.visible) {
    return null;
  }

  const passage = passageText?.trim() ?? "";
  const hasVocabInputs =
    !state.loading &&
    Boolean(state.translationText.trim()) &&
    Boolean(passage);

  const canShowVocabOnOriginal =
    showVocabAction &&
    state.mode === "word" &&
    hasVocabInputs;

  const canShowVocabOnTranslation =
    showVocabAction &&
    singleWordVocabInFullMode &&
    state.mode === "full" &&
    hasVocabInputs &&
    isSingleWordText(passage);

  return (
    <section className="translationSection">
      {state.mode === "word" ? (
        <div className="translationLine">
          <span className="translationLineHeader">
            <span className="translationLabel">Original</span>
            {canShowVocabOnOriginal ? (
              <VocabAction
                originalText={state.originalText}
                translationText={state.translationText}
                contextText={passage}
              />
            ) : null}
          </span>
          <span className="translationOriginalValue">
            {onSpeakOriginal ? (
              <button
                type="button"
                className={`translationSpeakable word${
                  originalSpeakHighlight === "loading" ? " isLoading" : ""
                }${originalSpeakHighlight === "active" ? " isActive" : ""}`}
                disabled={originalSpeakHighlight === "loading"}
                aria-label={`Hear pronunciation of ${state.originalText}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSpeakOriginal();
                }}
              >
                {state.originalText}
              </button>
            ) : (
              state.originalText
            )}
          </span>
        </div>
      ) : null}
      <div className="translationLine">
        <span className="translationLineHeader">
          <span className="translationLabel">Translation</span>
          {canShowVocabOnTranslation ? (
            <VocabAction
              originalText={state.originalText}
              translationText={state.translationText}
              contextText={passage}
            />
          ) : null}
          {showRestore && state.mode === "word" && !state.loading ? (
            <button
              type="button"
              className="translationRestore"
              onClick={onRestore}
            >
              Show full translation
            </button>
          ) : null}
        </span>
        <span
          className={`translationGlossValue${state.loading ? " isLoading" : ""}`}
        >
          {state.loading ? "Translating…" : state.translationText}
        </span>
      </div>
      <hr className="translationDivider" />
    </section>
  );
}

export function TranscriptTranslationPanel({
  state,
  passageText,
}: {
  state: TranslationState;
  passageText?: string;
}) {
  return (
    <TranslationPanel
      state={state}
      showRestore={false}
      passageText={passageText}
    />
  );
}
