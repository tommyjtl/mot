export function formatSavedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatContextHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
