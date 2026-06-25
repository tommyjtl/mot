import { useMemo } from "react";
import { ALIGNMENT_DEBUG_UI_ENABLED } from "../../utils/supertonic/constants";
import { DEFAULT_SIGNAL_ALIGNMENT_OPTIONS } from "../../utils/supertonic/alignment";
import {
  formatAlignmentSeconds,
  getAlignmentDebugTuning,
  isAlignmentDebugPanelOpen,
  toggleAlignmentDebugPanel,
  updateDebugTuning,
} from "./alignment-debug-state";
import { useTtsOverlayStore, ttsOverlayStore } from "./tts-overlay-store";

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="alignmentDebugControl">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="alignmentDebugControlValue">{format(value)}</span>
    </label>
  );
}

export function AlignmentDebugPanel() {
  const state = useTtsOverlayStore();
  const host = state.alignmentDebugHost;
  const tick = state.alignmentDebugTick;

  const alignment = host?.getAlignment() ?? null;
  const activeWordIndex = host?.getActiveWordIndex() ?? null;
  const showToggle = Boolean(host?.hasClip() && alignment?.words.length);
  const open = isAlignmentDebugPanelOpen();

  const tuning = getAlignmentDebugTuning();

  const clockText = useMemo(() => {
    if (!host || !open) {
      return "";
    }

    return (
      `Reported ${formatAlignmentSeconds(host.getReportedTimeS())} · ` +
      `Estimated ${formatAlignmentSeconds(host.getEstimatedTimeS())} · ` +
      `Latency ${formatAlignmentSeconds(host.getLatencyCompensationS())} · ` +
      `Duration ${formatAlignmentSeconds(host.getDurationS())} · ` +
      `Highlight ${activeWordIndex === null ? "—" : `#${activeWordIndex + 1}`}`
    );
  }, [host, open, activeWordIndex, tick]);

  if (!ALIGNMENT_DEBUG_UI_ENABLED || !host) {
    return null;
  }

  return (
    <>
      {showToggle ? (
        <button
          type="button"
          className="alignmentDebugToggle"
          aria-expanded={open ? "true" : "false"}
          onClick={() => {
            toggleAlignmentDebugPanel();
            ttsOverlayStore.setState({
              alignmentDebugTick: tick + 1,
            });
          }}
        >
          {open ? "Hide sync debug" : "Sync debug"}
        </button>
      ) : null}
      {open && showToggle ? (
        <section className="alignmentDebug" aria-label="Alignment sync debug">
          <div className="alignmentDebugControls">
            <RangeControl
              label="Energy threshold"
              min={0.05}
              max={0.35}
              step={0.01}
              value={
                tuning.energyThreshold ??
                DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.energyThreshold!
              }
              format={(value) => value.toFixed(2)}
              onChange={(value) => {
                updateDebugTuning({ energyThreshold: value }, host);
                ttsOverlayStore.setState({ alignmentDebugTick: tick + 1 });
              }}
            />
            <RangeControl
              label="Smooth (ms)"
              min={10}
              max={60}
              step={5}
              value={
                tuning.smoothMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.smoothMs!
              }
              format={(value) => `${Math.round(value)}ms`}
              onChange={(value) => {
                updateDebugTuning({ smoothMs: value }, host);
                ttsOverlayStore.setState({ alignmentDebugTick: tick + 1 });
              }}
            />
            <RangeControl
              label="Min word (ms)"
              min={20}
              max={150}
              step={5}
              value={
                tuning.minWordMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.minWordMs!
              }
              format={(value) => `${Math.round(value)}ms`}
              onChange={(value) => {
                updateDebugTuning({ minWordMs: value }, host);
                ttsOverlayStore.setState({ alignmentDebugTick: tick + 1 });
              }}
            />
            <RangeControl
              label="Valley search"
              min={0.2}
              max={0.7}
              step={0.05}
              value={
                tuning.valleySearchRatio ??
                DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.valleySearchRatio!
              }
              format={(value) => value.toFixed(2)}
              onChange={(value) => {
                updateDebugTuning({ valleySearchRatio: value }, host);
                ttsOverlayStore.setState({ alignmentDebugTick: tick + 1 });
              }}
            />
          </div>
          <p className="alignmentDebugClock">{clockText}</p>
          <div className="alignmentDebugList">
            <p className="alignmentDebugCaption">
              Signal-based timings from audio energy valleys (not model output).
            </p>
            {!alignment?.words.length ? (
              <p className="alignmentDebugEmpty">No alignment data for this clip.</p>
            ) : (
              alignment.words.map((word) => (
                <div
                  key={word.index}
                  className={`alignmentDebugRow${
                    activeWordIndex === word.index ? " isActive" : ""
                  }`}
                >
                  <div className="alignmentDebugMeta">
                    <span className="alignmentDebugIndex">#{word.index + 1}</span>
                    <span className="alignmentDebugWord">{word.text}</span>
                    <span className="alignmentDebugTime">
                      {formatAlignmentSeconds(word.start)} →{" "}
                      {formatAlignmentSeconds(word.end)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
