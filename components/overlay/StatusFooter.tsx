type StatusFooterProps = {
  message?: string | null;
  error?: boolean;
  loadingPhase?: "loading-model" | "generating" | "recognizing";
  loadingDetail?: string;
  loadingPercent?: number;
  actionLabel?: string;
  onAction?: () => void;
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
  actionLabel,
  onAction,
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
      <div className="statusBlock" aria-live="polite">
        <output className="status">
          <span className="inlineSpinner" />
          {`${label}${suffix}`}
        </output>
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
    <div className="statusBlock" aria-live="polite">
      <output className={`status${error ? " error" : ""}`}>{message}</output>
      {actionLabel && onAction ? (
        <button type="button" className="statusOptionsLink" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
