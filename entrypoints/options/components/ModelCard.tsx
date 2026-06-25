import type { ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ModelCardView } from "../types";

type ModelCardProps = {
  title: string;
  view: ModelCardView;
  children?: ReactNode;
};

function StatusIcon({ view }: { view: ModelCardView }) {
  if (view.state === "checking" || view.state === "loading") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  }

  if (view.state === "ready") {
    return <Check className="size-4 shrink-0 text-success" aria-hidden="true" />;
  }

  if (view.state === "error") {
    return (
      <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
    );
  }

  return null;
}

function badgeVariant(view: ModelCardView) {
  if (view.state === "ready") {
    return "success" as const;
  }
  if (view.state === "error") {
    return "error" as const;
  }
  if (view.state === "loading" || view.state === "checking") {
    return "loading" as const;
  }
  return "default" as const;
}

export function ModelCard({ title, view, children }: ModelCardProps) {
  const showProgress =
    view.state === "loading" && typeof view.percent === "number";

  return (
    <Card aria-live="polite">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <StatusIcon view={view} />
          <CardTitle>{title}</CardTitle>
          <Badge variant={badgeVariant(view)} className="ml-auto">
            {view.state === "checking"
              ? "Checking"
              : view.state === "loading"
                ? "Loading"
                : view.state === "ready"
                  ? "Ready"
                  : "Error"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {view.state !== "ready" ? (
          <p
            className={`text-sm leading-relaxed ${
              view.state === "error"
                ? "whitespace-pre-wrap break-words text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {view.detail}
          </p>
        ) : null}
        {showProgress ? <Progress value={view.percent} className="h-2" /> : null}
      </CardContent>
    </Card>
  );
}
