export type TranslationState =
  | { visible: false }
  | {
      visible: true;
      originalText: string;
      translationText: string;
      mode: "full" | "word";
      loading?: boolean;
    };

/** @deprecated Use TranslationState */
export type TranslationViewState = TranslationState;

/** @deprecated Use TranslationState */
export type TranscriptWordTranslationState = TranslationState;

type TranslationPanelProps = {
  state: TranslationState;
  showRestore?: boolean;
  onRestore?: () => void;
};

export function TranslationPanel({
  state,
  showRestore = true,
  onRestore,
}: TranslationPanelProps) {
  if (!state.visible) {
    return null;
  }

  return (
    <section className="translationSection">
      {state.mode === "word" ? (
        <p className="translationLine">
          <span className="translationLabel">Original</span>
          <span className="translationOriginalValue">{state.originalText}</span>
        </p>
      ) : null}
      <p className="translationLine">
        <span className="translationLineHeader">
          <span className="translationLabel">Translation</span>
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
      </p>
      <hr className="translationDivider" />
    </section>
  );
}

export function TranscriptTranslationPanel({
  state,
}: {
  state: TranslationState;
}) {
  if (!state.visible) {
    return null;
  }

  return (
    <section className="translationSection">
      {state.mode === "word" ? (
        <p className="translationLine">
          <span className="translationLabel">Original</span>
          <span className="translationOriginalValue">{state.originalText}</span>
        </p>
      ) : null}
      <p className="translationLine">
        {state.mode === "word" ? (
          <span className="translationLineHeader">
            <span className="translationLabel">Translation</span>
          </span>
        ) : null}
        <span
          className={`translationGlossValue${state.loading ? " isLoading" : ""}`}
        >
          {state.loading ? "Translating…" : state.translationText}
        </span>
      </p>
      <hr className="translationDivider" />
    </section>
  );
}
