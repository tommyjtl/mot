import { KeybindInput } from "@/components/KeybindInput";
import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
} from "@/utils/keyboard-shortcut";
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

  return (
    <section aria-labelledby="models-heading" className="space-y-3">
      <div>
        <h2 id="models-heading" className="text-base font-semibold">
          Models
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download and warm-up status for each on-device model.
        </p>
      </div>

      <div className="space-y-3">
        <ModelCard title="Text-to-speech" view={ttsView}>
          <KeybindInput
            label="Shortcut"
            description="Speak selected text on the active page."
            value={shortcuts.speakShortcut}
            defaultShortcut={DEFAULT_SPEAK_SHORTCUT}
            onChange={shortcuts.setSpeakShortcut}
            disabled={shortcuts.loading}
          />
        </ModelCard>

        <ModelCard title="Live transcription" view={sttView}>
          <KeybindInput
            label="Shortcut"
            description="Transcribe audio from the active web page."
            value={shortcuts.transcribeShortcut}
            defaultShortcut={DEFAULT_TRANSCRIBE_SHORTCUT}
            onChange={shortcuts.setTranscribeShortcut}
            disabled={shortcuts.loading}
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
      </div>
    </section>
  );
}
