/**
 * Runs in the page's main world so keyboard shortcuts (YouTube seek, etc.)
 * can be blocked while the transcript textarea is focused in edit mode.
 */
export default defineContentScript({
  matches: ["*://*/*"],
  runAt: "document_start",
  world: "MAIN",

  main() {
    function shouldIsolateKeyboard(event: KeyboardEvent): boolean {
      if (event.key === "Escape") {
        return false;
      }

      const host = document.getElementById("mot-transcript-overlay-host");
      if (!host?.dataset.transcriptEdit) {
        return false;
      }

      const root = host.shadowRoot;
      if (!root) {
        return false;
      }

      const transcript = root.querySelector(".transcript");
      return root.activeElement === transcript;
    }

    function onKeyEvent(event: KeyboardEvent): void {
      if (!shouldIsolateKeyboard(event)) {
        return;
      }

      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    window.addEventListener("keydown", onKeyEvent, true);
    window.addEventListener("keyup", onKeyEvent, true);
  },
});
