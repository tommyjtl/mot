/** Published Chrome Web Store extension ID (fallback if import.meta.url is unavailable). */
export const MOTIF_PUBLISHED_EXTENSION_ID = "mlgmlehgbmoebpgghjnkheaciijcfblo";

export function isGoogleDocsDocumentPage(locationLike: Pick<Location, "hostname" | "pathname"> = location): boolean {
  return (
    locationLike.hostname === "docs.google.com" &&
    locationLike.pathname.startsWith("/document/")
  );
}
