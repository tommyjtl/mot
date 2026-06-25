import { ModelsSection } from "./components/ModelsSection";
import { VoiceSettingsSection } from "./components/VoiceSettingsSection";
import { libraryPageUrl } from "@/utils/open-library";

export function App() {
  return (
    <main className="mx-auto max-w-[560px] px-5 py-12">
      <header className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-normal leading-tight tracking-[-0.02em] text-foreground">
              Motif
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">
              Hear it, save it, remember it. On-device French TTS and live tab
              transcription in your browser.
            </p>
          </div>
          <a
            href={libraryPageUrl()}
            className="shrink-0 pt-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            Saved Library →
          </a>
        </div>
      </header>

      <div className="space-y-5">
        <ModelsSection />
        <VoiceSettingsSection />
      </div>
    </main>
  );
}
