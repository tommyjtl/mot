export function LibraryEmptyState({ query }: { query: string }) {
  const trimmed = query.trim();

  if (trimmed) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No saved items match &ldquo;{trimmed}&rdquo;.
      </p>
    );
  }

  return (
    <div className="py-10 text-center">
      <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Save text while reading on any page.
      </p>
    </div>
  );
}
