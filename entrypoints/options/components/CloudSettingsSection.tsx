import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { KeybindInput } from "@/components/KeybindInput";
import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
} from "@/utils/keyboard-shortcut";
import { useRuntimeMode } from "../hooks/useRuntimeMode";
import { useExtensionShortcuts } from "../hooks/useExtensionShortcuts";
import { CloudModelsSection } from "./CloudModelsSection";
import { ModelCard } from "./ModelCard";

export function CloudSettingsSection() {
  const runtime = useRuntimeMode();
  const { auth } = runtime;
  const shortcuts = useExtensionShortcuts();

  if (!auth.isSignedIn) {
    return (
      <section aria-labelledby="cloud-settings-heading" className="space-y-3">
        <div>
          <h2 id="cloud-settings-heading" className="text-base font-semibold">
            Cloud setup
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to connect to your Motif server and use cloud shortcuts.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-5">
            {auth.status === "not_allowlisted" && auth.errorMessage ? (
              <p className="text-sm text-destructive">{auth.errorMessage}</p>
            ) : null}
            {auth.status === "error" && auth.errorMessage ? (
              <p className="text-sm text-destructive">{auth.errorMessage}</p>
            ) : null}
            <Button
              type="button"
              onClick={() => void auth.signIn()}
              disabled={auth.status === "signing_in" || !runtime.ready}
            >
              {auth.status === "signing_in"
                ? "Signing in…"
                : "Sign in with Google"}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="cloud-settings-heading" className="space-y-5">
      <div>
        <h2 id="cloud-settings-heading" className="text-base font-semibold">
          Cloud setup
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Remote inference status and shortcuts for your Motif server.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <p className="text-sm text-foreground">
            Signed in as{" "}
            <span className="font-medium">{auth.session?.user.email}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void auth.signOut()}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Motif server</CardTitle>
          <CardDescription>
            Your Caddy HTTPS URL (default: motif-cloud.tjtl.io via FRP port 7016).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="remote-api-url">Server URL</FieldLabel>
              <Input
                id="remote-api-url"
                type="url"
                value={runtime.remoteApiBaseUrl}
                onChange={(event) =>
                  runtime.setRemoteApiBaseUrl(event.target.value)
                }
                placeholder="https://motif-cloud.tjtl.io"
                disabled={!runtime.ready}
              />
              <FieldDescription>
                {runtime.remoteHealth === "checking"
                  ? "Checking server…"
                  : runtime.remoteHealth === "ok"
                    ? "Server reachable."
                    : runtime.remoteHealth === "error"
                      ? "Server unreachable. Start the gateway and frpc tunnel."
                      : "Set your server URL."}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Models</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Service status from your Motif gateway.
          </p>
        </div>

        <CloudModelsSection authenticated />

        <ModelCard
          title="Text-to-speech"
          view={{
            state: "ready",
            label: "Cloud server",
            detail: "Runs on Motif server when wired.",
          }}
        >
          <KeybindInput
            label="Shortcut"
            description="Speak selected text on the active page."
            value={shortcuts.speakShortcut}
            defaultShortcut={DEFAULT_SPEAK_SHORTCUT}
            onChange={shortcuts.setSpeakShortcut}
            disabled={shortcuts.loading}
          />
        </ModelCard>

        <ModelCard
          title="Live transcription"
          view={{
            state: "ready",
            label: "Cloud server",
            detail: "Runs on Motif server when wired.",
          }}
        >
          <KeybindInput
            label="Shortcut"
            description="Transcribe audio from the active web page."
            value={shortcuts.transcribeShortcut}
            defaultShortcut={DEFAULT_TRANSCRIBE_SHORTCUT}
            onChange={shortcuts.setTranscribeShortcut}
            disabled={shortcuts.loading}
          />
        </ModelCard>
      </div>
    </section>
  );
}
