import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchRemoteHealth } from "@/utils/remote-api";
import { initRuntimeModeStore, runtimeModeStore } from "@/utils/runtime-mode-store";
import type { RuntimeModeState } from "@/utils/runtime-mode";

type CloudServiceState = "checking" | "ready" | "pending" | "error";

function CloudServiceCard({
  title,
  state,
  detail,
}: {
  title: string;
  state: CloudServiceState;
  detail: string;
}) {
  const badgeVariant =
    state === "ready"
      ? "success"
      : state === "error"
        ? "error"
        : state === "pending"
          ? "default"
          : "loading";

  const badgeLabel =
    state === "ready"
      ? "Ready"
      : state === "error"
        ? "Unavailable"
        : state === "pending"
          ? "Pending"
          : "Checking";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
        {state === "checking" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : state === "ready" ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : state === "pending" ? null : (
          <X className="size-4 text-destructive" aria-hidden="true" />
        )}
        <span>{detail}</span>
      </CardContent>
    </Card>
  );
}

export function CloudModelsSection() {
  const [mode, setMode] = useState<RuntimeModeState>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [healthState, setHealthState] = useState<CloudServiceState>("checking");
  const [services, setServices] = useState<{
    translation?: string;
    tts?: string;
    stt?: string;
  }>({});

  useEffect(() => {
    void initRuntimeModeStore().then(() => {
      const state = runtimeModeStore.getState();
      setMode(state.mode);
      setBaseUrl(state.remoteApiBaseUrl);
    });

    return runtimeModeStore.subscribe(() => {
      const state = runtimeModeStore.getState();
      setMode(state.mode);
      setBaseUrl(state.remoteApiBaseUrl);
    });
  }, []);

  useEffect(() => {
    if (mode !== "cloud") {
      return;
    }

    let cancelled = false;
    setHealthState("checking");

    void fetchRemoteHealth(baseUrl).then((health) => {
      if (cancelled) {
        return;
      }

      if (!health) {
        setHealthState("error");
        setServices({});
        return;
      }

      setHealthState("ready");
      setServices(health.services ?? {});
    });

    return () => {
      cancelled = true;
    };
  }, [mode, baseUrl]);

  if (mode !== "cloud") {
    return null;
  }

  const translationReady =
    healthState === "ready" && services.translation === "ready";
  const ttsReady = healthState === "ready" && services.tts === "ready";
  const sttReady = healthState === "ready" && services.stt === "ready";

  const translationState: CloudServiceState =
    healthState === "checking"
      ? "checking"
      : translationReady
        ? "ready"
        : healthState === "ready"
          ? "error"
          : "error";

  const ttsState: CloudServiceState =
    healthState === "checking"
      ? "checking"
      : ttsReady
        ? "ready"
        : healthState === "ready"
          ? "pending"
          : "error";

  const sttState: CloudServiceState =
    healthState === "checking"
      ? "checking"
      : sttReady
        ? "ready"
        : healthState === "ready"
          ? "pending"
          : "error";

  return (
    <div className="space-y-3">
      <CloudServiceCard
        title="Translation"
        state={translationState}
        detail={
          translationReady
            ? "Opus-MT fr→en on Motif server."
            : "Start the Python gateway and frpc tunnel."
        }
      />
      <CloudServiceCard
        title="Text-to-speech"
        state={ttsState}
        detail={
          ttsReady
            ? "Supertonic serve on Motif server."
            : "TTS proxy coming in the next phase."
        }
      />
      <CloudServiceCard
        title="Live transcription"
        state={sttState}
        detail={
          sttReady
            ? "faster-whisper on Motif server."
            : "STT stream coming in the next phase."
        }
      />
    </div>
  );
}
