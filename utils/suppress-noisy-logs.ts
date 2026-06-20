const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;
const BARE_ANSI_PATTERN = /\[[0-9;]*m/g;

function cleanConsoleArg(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(ANSI_ESCAPE_PATTERN, "").replace(BARE_ANSI_PATTERN, "");
}

function consoleMessageText(args: unknown[]): string {
  return args.map((arg) => String(cleanConsoleArg(arg))).join(" ");
}

function isNoisyOnnxRuntimeWarning(message: string): boolean {
  return (
    message.includes("onnxruntime") &&
    (message.includes("VerifyEachNodeIsAssignedToAnEp") ||
      message.includes("Some nodes were not assigned to the preferred execution providers") ||
      message.includes("Rerunning with verbose output on a non-minimal build"))
  );
}

/** Keep Chrome's extension Errors page readable during ONNX warm-up. */
export function suppressNoisyOffscreenLogs(): void {
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
      const cleaned = args.map(cleanConsoleArg);
      const text = consoleMessageText(cleaned);

      if (isNoisyOnnxRuntimeWarning(text)) {
        return;
      }

      original(...cleaned);
    };
  }
}
