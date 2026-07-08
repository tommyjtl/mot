import { MOTIF_PUBLISHED_EXTENSION_ID } from "../utils/google-docs/page";

declare global {
  interface Window {
    _docs_annotate_canvas_by_ext?: string;
  }
}

/**
 * Ask Google Docs to expose annotated canvas DOM for this extension.
 * Must run in the page main world at document_start, before Docs initializes.
 *
 * @see https://github.com/srgykuz/google-docs-utils/issues/10
 */
function resolveExtensionId(): string {
  try {
    const id = new URL(import.meta.url).hostname;
    if (id) {
      return id;
    }
  } catch {
    // Fall through to published ID.
  }

  return MOTIF_PUBLISHED_EXTENSION_ID;
}

export default defineContentScript({
  matches: ["*://docs.google.com/document/*"],
  runAt: "document_start",
  world: "MAIN",

  main() {
    window._docs_annotate_canvas_by_ext = resolveExtensionId();
  },
});
