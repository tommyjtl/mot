type StatusFooterProps = {
  message?: string | null;
  error?: boolean;
  loadingPhase?: "loading-model" | "generating" | "recognizing";
  loadingDetail?: string;
  loadingPercent?: number;
};

function openOptionsPage(): void {
  void browser.runtime.openOptionsPage();
}

export function StatusFooter({
  message,
  error,
  loadingPhase,
  loadingDetail,
  loadingPercent,
}: StatusFooterProps) {
  if (loadingPhase) {
    let defaultLabel = "Recognizing text…";
    if (loadingPhase === "loading-model") {
      defaultLabel = "Loading model…";
    } else if (loadingPhase === "generating") {
      defaultLabel = "Generating pronunciation…";
    }

    const label = loadingDetail ?? defaultLabel;
    const suffix =
      typeof loadingPercent === "number" && loadingPhase === "loading-model"
        ? ` ${loadingPercent}%`
        : "";

    return (
      <div className="statusBlock" role="status" aria-live="polite">
        <p className="status">
          <span className="inlineSpinner" />
          {`${label}${suffix}`}
        </p>
        {loadingPhase === "loading-model" ? (
          <button
            type="button"
            className="statusOptionsLink"
            onClick={openOptionsPage}
          >
            Open Options for download progress
          </button>
        ) : null}
        {typeof loadingPercent === "number" && loadingPhase === "loading-model" ? (
          <div className="progressTrack">
            <div
              className="progressFill"
              style={{
                width: `${Math.max(0, Math.min(100, loadingPercent))}%`,
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!message) {
    return null;
  }

  return (
    <p
      className={`status${error ? " error" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
