type StatusFooterProps = {
  message?: string | null;
  error?: boolean;
  loadingPhase?: "loading-model" | "generating" | "recognizing";
  loadingDetail?: string;
  loadingPercent?: number;
};

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
      <p className="status" role="status" aria-live="polite">
        <span className="spinner" />
        {`${label}${suffix}`}
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
      </p>
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
