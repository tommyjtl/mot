import { KeybindInput } from "@/components/KeybindInput";
import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
} from "@/utils/keyboard-shortcut";
import { initRuntimeModeStore, runtimeModeStore } from "@/utils/runtime-mode-store";
import type { RuntimeModeState } from "@/utils/runtime-mode";
import { useEffect, useState } from "react";
import { CloudModelsSection } from "./CloudModelsSection";
import { ModelCard } from "./ModelCard";
import { useExtensionShortcuts } from "../hooks/useExtensionShortcuts";
import { useSttModelStatus, useTranscriptionDebugState } from "../hooks/useSttModelStatus";
import { useTtsModelStatus } from "../hooks/useTtsModelStatus";
import { formatTargetTab } from "../types";

export function ModelsSection() {
  const ttsView = useTtsModelStatus();
  const transcription = useTranscriptionDebugState();
  const sttView = useSttModelStatus();
  const shortcuts = useExtensionShortcuts();
  const [mode, setMode] = useState<RuntimeModeState>(null);

  useEffect(() => {
    void initRuntimeModeStore().then(() => {
      setMode(runtimeModeStore.getState().mode);
    });

    return runtimeModeStore.subscribe(() => {
      setMode(runtimeModeStore.getState().mode);
    });
  }, []);

  const shortcutsDisabled = shortcuts.loading || mode === null;
  const isCloud = mode === "cloud";
  const isPrivate = mode === "private";

  return (
    <section aria-labelledby="models-heading" className="space-y-3">
      <div>
        <h2 id="models-heading" className="text-base font-semibold">
          Models
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === null
            ? "Select a runtime mode above to enable shortcuts."
            : isCloud
              ? "Remote inference status from your Motif server."
              : "Download and warm-up status for each on-device model."}
        </p>
      </div>

      {isCloud ? <CloudModelsSection /> : null}

      <div className="space-y-3">
        {isPrivate ? (
          <ModelCard title="Text-to-speech" view={ttsView}>
            <KeybindInput
              label="Shortcut"
              description="Speak selected text on the active page."
              value={shortcuts.speakShortcut}
              defaultShortcut={DEFAULT_SPEAK_SHORTCUT}
              onChange={shortcuts.setSpeakShortcut}
              disabled={shortcutsDisabled}
            />
          </ModelCard>
        ) : (
          <ModelCard
            title="Text-to-speech"
            view={{
              state: mode === null ? "checking" : "ready",
              label: mode === null ? "Select mode" : "Cloud server",
              detail:
                mode === null
                  ? "Choose Private or Cloud above."
                  : "Runs on Motif server when wired.",
            }}
          >
            <KeybindInput
              label="Shortcut"
              description="Speak selected text on the active page."
              value={shortcuts.speakShortcut}
              defaultShortcut={DEFAULT_SPEAK_SHORTCUT}
              onChange={shortcuts.setSpeakShortcut}
              disabled={shortcutsDisabled}
            />
          </ModelCard>
        )}

        {isPrivate ? (
          <ModelCard title="Live transcription" view={sttView}>
            <KeybindInput
              label="Shortcut"
              description="Transcribe audio from the active web page."
              value={shortcuts.transcribeShortcut}
              defaultShortcut={DEFAULT_TRANSCRIBE_SHORTCUT}
              onChange={shortcuts.setTranscribeShortcut}
              disabled={shortcutsDisabled}
            />

            <ul className="space-y-2 border-t border-border pt-3 text-sm text-foreground">
              <li className="flex items-start justify-between gap-3">
                <strong className="font-semibold">Transcription</strong>
                <span className="text-right text-muted-foreground">
                  {transcription.unavailable
                    ? "Unavailable"
                    : transcription.active
                      ? "Active"
                      : "Inactive"}
                </span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <strong className="font-semibold">Target tab</strong>
                <span className="max-w-[60%] break-all text-right text-muted-foreground">
                  {transcription.unavailable
                    ? "—"
                    : formatTargetTab(transcription)}
                </span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <strong className="font-semibold">Offscreen worker</strong>
                <span className="text-right text-muted-foreground">
                  {transcription.unavailable
                    ? "—"
                    : transcription.offscreenDocument
                      ? "Running"
                      : "Not running"}
                </span>
              </li>
            </ul>
          </ModelCard>
        ) : (
          <ModelCard
            title="Live transcription"
            view={{
              state: mode === null ? "checking" : "ready",
              label: mode === null ? "Select mode" : "Cloud server",
              detail:
                mode === null
                  ? "Choose Private or Cloud above."
                  : "Runs on Motif server when wired.",
            }}
          >
            <KeybindInput
              label="Shortcut"
              description="Transcribe audio from the active web page."
              value={shortcuts.transcribeShortcut}
              defaultShortcut={DEFAULT_TRANSCRIBE_SHORTCUT}
              onChange={shortcuts.setTranscribeShortcut}
              disabled={shortcutsDisabled}
            />
          </ModelCard>
        )}
      </div>
    </section>
  );
}
