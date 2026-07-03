import { CloudIcon, LaptopIcon } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import type { RuntimeMode } from "@/utils/runtime-mode";
import { useRuntimeMode } from "../hooks/useRuntimeMode";

function ModeButton({
  label,
  description,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  icon: typeof LaptopIcon;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-foreground bg-muted/60"
          : "border-border bg-card hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function RuntimeModeSection() {
  const runtime = useRuntimeMode();
  const { auth } = runtime;
  const [cloudSignInPrompt, setCloudSignInPrompt] = useState(false);

  const select = (mode: RuntimeMode) => {
    if (mode === "cloud") {
      void runtime.selectMode(mode).then((success) => {
        if (!success) {
          setCloudSignInPrompt(true);
        }
      });
      return;
    }

    setCloudSignInPrompt(false);
    void runtime.selectMode(mode);
  };

  const showCloudAccountCard =
    runtime.mode === "cloud" ||
    cloudSignInPrompt ||
    auth.status !== "signed_out";

  const cloudBlocked =
    runtime.mode !== "cloud" &&
    (auth.status === "not_allowlisted" || auth.status === "error");

  return (
    <section aria-labelledby="runtime-mode-heading" className="space-y-3">
      <div>
        <h2 id="runtime-mode-heading" className="text-base font-semibold">
          Runtime mode
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Motif runs before using shortcuts. Cloud mode requires Google
          sign-in.
        </p>
      </div>

      {runtime.mode === null ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="pt-4 text-sm text-amber-950">
            Select Private or Cloud below. Shortcuts stay disabled until you choose.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeButton
          label="Private"
          description="Runs on your device with WebGPU models (~1 GB download)."
          icon={LaptopIcon}
          active={runtime.mode === "private"}
          disabled={!runtime.ready}
          onClick={() => select("private")}
        />
        <ModeButton
          label="Cloud"
          description="Runs on your Motif Python server. Sign in with Google required."
          icon={CloudIcon}
          active={runtime.mode === "cloud"}
          disabled={!runtime.ready || cloudBlocked}
          onClick={() => select("cloud")}
        />
      </div>

      {showCloudAccountCard ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Motif Cloud account</CardTitle>
            <CardDescription>
              Only allowlisted Google accounts can use cloud mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.isSignedIn && auth.session ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  Signed in as{" "}
                  <span className="font-medium">{auth.session.user.email}</span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void auth.signOut()}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {auth.status === "not_allowlisted" && auth.errorMessage ? (
                  <p className="text-sm text-destructive">{auth.errorMessage}</p>
                ) : null}
                {auth.status === "error" && auth.errorMessage ? (
                  <p className="text-sm text-destructive">{auth.errorMessage}</p>
                ) : null}
                <Button
                  type="button"
                  onClick={() =>
                    void auth.signIn().then(() => {
                      setCloudSignInPrompt(false);
                      void runtime.selectMode("cloud");
                    })
                  }
                  disabled={auth.status === "signing_in" || !runtime.ready}
                >
                  {auth.status === "signing_in"
                    ? "Signing in…"
                    : "Sign in with Google"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {runtime.mode === "cloud" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Motif server</CardTitle>
            <CardDescription>
              Point at your Caddy HTTPS URL (default: motif-cloud.tjtl.io via FRP port 7016).
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
                        : "Set URL after choosing Cloud mode."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
