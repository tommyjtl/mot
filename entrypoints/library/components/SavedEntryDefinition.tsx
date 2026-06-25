import { buildWordReferenceUrl } from "@/utils/dictionary-links";

type SavedEntryDefinitionProps = {
  original: string;
};

export function SavedEntryDefinition({ original }: SavedEntryDefinitionProps) {
  const wordReferenceUrl = buildWordReferenceUrl(original);

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        Definition
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted-foreground italic">Not available at the moment.</p>
        <a
          href={wordReferenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Look up on WordReference →
        </a>
      </div>
    </div>
  );
}
