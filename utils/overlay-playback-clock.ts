/** Adaptive playback clock for overlay word sync. */

const MIN_LATENCY_S = 0;
const MAX_LATENCY_S = 0.12;
const LATENCY_SMOOTHING = 0.35;
const INITIAL_LATENCY_S = 0.025;

let anchorTimeS = 0;
let anchorAtMs = 0;
let latencyCompensationS = INITIAL_LATENCY_S;
let running = false;

export function resetPlaybackClock(): void {
  anchorTimeS = 0;
  anchorAtMs = 0;
  latencyCompensationS = INITIAL_LATENCY_S;
  running = false;
}

export function stopPlaybackClock(): void {
  running = false;
}

/** Resync to a reported audio position and adapt relay lag compensation. */
export function syncPlaybackClock(reportedTimeS: number): void {
  const nowMs = performance.now();

  if (running && anchorAtMs > 0) {
    const extrapolatedS = anchorTimeS + (nowMs - anchorAtMs) / 1000;
    const errorS = reportedTimeS - extrapolatedS;
    latencyCompensationS = Math.min(
      MAX_LATENCY_S,
      Math.max(
        MIN_LATENCY_S,
        latencyCompensationS + errorS * LATENCY_SMOOTHING,
      ),
    );
  }

  anchorTimeS = reportedTimeS;
  anchorAtMs = nowMs;
  running = true;
}

export function estimatedPlaybackTimeS(): number {
  if (!running) {
    return anchorTimeS;
  }

  return (
    anchorTimeS +
    (performance.now() - anchorAtMs) / 1000 +
    latencyCompensationS
  );
}

export function currentLatencyCompensationS(): number {
  return latencyCompensationS;
}
