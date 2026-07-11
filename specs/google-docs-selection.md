# Google Docs selection — investigation & spike (deferred)

Motif reads selected text via normal DOM APIs (`window.getSelection()`, focused `<input>` / `<textarea>`). That works on most pages (including the Google Search bar) but **not** on Google Docs, which renders document text on **canvas** instead of ordinary selectable DOM nodes.

When Option+S finds no selection, the overlay content script maps `empty` → `ocr`, so Google Docs users silently enter capture mode even when they highlighted text. This spec captures the problem, approaches considered, the current spike, and what remains before shipping.

## What we want

On `docs.google.com/document/*`:

1. User selects French text (Editing, Suggesting, or Viewing mode).
2. User presses Option+S.
3. Motif shows the **TTS overlay** with the selected phrase — same as any normal page.
4. Overlay positions near the selection rect.

OCR remains available when the user **intentionally** has no text selection (empty selection on non-Docs pages today).

## Why standard selection fails

| API | Google Search | Google Docs |
|-----|---------------|-------------|
| `document.activeElement` as input/textarea | Works (`<textarea name="q">`) | Usually `.docs-texteventtarget-iframe`, not the hidden textarea |
| `window.getSelection()` on top document | N/A | Returns empty / collapsed |
| Visible blue highlight | Real DOM selection | Canvas-drawn; not exposed to normal Range APIs |

Relevant code today:

- `utils/selection.ts` — `readSelectedText()` / `evaluateSelection()`
- `entrypoints/overlay.content.tsx` — maps `empty` → `{ status: "ocr" }` before replying to background

## Approaches considered

### 1. Iframe / hidden textarea only (rejected for product)

Read selection from `.docs-texteventtarget-iframe` via `contentWindow.getSelection()` or the iframe’s hidden `textarea`.

- **Pros:** Small change, no Google approval.
- **Cons:** Unreliable on canvas Docs (reported empty on macOS/Windows Chrome); does not enable annotated overlay rects without whitelist.
- **Decision:** Not sufficient alone; may remain as a **secondary read path** after annotated canvas is active.

### 2. Annotated canvas whitelist (chosen spike)

Google exposes a private hook for approved extensions:

```js
// MAIN world, document_start, before Docs initializes
window._docs_annotate_canvas_by_ext = "<chrome-extension-id>";
```

When whitelisted, Docs adds companion DOM (e.g. `.kix-canvas-tile-selection svg rect`, iframe-accessible selection) alongside the canvas so extensions can read text and bounds.

- **Pros:** Same path Grammarly / LanguageTool-style extensions use; best chance of stable text + positioning.
- **Cons:** Extension ID must be **whitelisted by Google**; API is undocumented and may change; dev builds use a different unpacked ID until keyed or whitelisted separately.

References:

- [google-docs-utils issue #10](https://github.com/srgykuz/google-docs-utils/issues/10)
- [Stack Overflow — Grammarly-style `_docs_annotate_canvas_by_ext`](https://stackoverflow.com/questions/77314817/how-does-spelling-check-extensions-like-grammarly-and-languagetool-work-on-a)
- [Google whitelist application form](https://docs.google.com/forms/d/e/1FAIpQLScFxMgvXlq2KMsp0UIM66pvThTF1hpojiXQTqyq9txW79OWag/viewform)

Published Motif extension ID: `mlgmlehgbmoebpgghjnkheaciijcfblo`

### 3. Screen reader / accessibility DOM

Enable Docs “Screen reader support” so readable HTML/SVG appears in the DOM.

- **Pros:** No whitelist.
- **Cons:** Requires user setting or invasive toggle; coarse line-level matching; fragile markup.

### 4. Clipboard copy trick

Dispatch `copy` on Docs’ internal content node, read `navigator.clipboard.readText()`.

- **Pros:** Can return exact selection when copy works.
- **Cons:** `clipboardRead` permission; overwrites clipboard; poor UX.

### 5. Reverse-engineer Kix internals (`KX_kixApp`, closure graph)

Traverse Google’s internal document model for selection indices.

- **Pros:** Precise when it works.
- **Cons:** Very fragile (2025 reports: `KX_kixApp` removed in A/B tests).

### 6. Google Docs REST API / Apps Script add-on

Official document access via OAuth.

- **Pros:** Supported by Google for document content.
- **Cons:** Wrong product shape for Option+S on an arbitrary tab; not real-time browser selection.

### 7. OCR only

Current fallback when selection is empty.

- **Pros:** Always works visually.
- **Cons:** Bad UX when user already selected text; extra step.

## Spike implementation (in repo, not merged yet)

| File | Role |
|------|------|
| `entrypoints/google-docs-annotate.content.ts` | MAIN world, `document_start`, sets `_docs_annotate_canvas_by_ext` to runtime extension ID (`import.meta.url`) with fallback to published ID |
| `utils/google-docs/page.ts` | `isGoogleDocsDocumentPage()`, published extension ID constant |
| `utils/google-docs/read-selection.ts` | Read selection from iframe `getSelection()` / hidden `textarea`; overlay rect from `.kix-canvas-tile-selection svg rect` |
| `utils/selection.ts` | Try Google Docs reader first on document pages |
| `entrypoints/overlay.content.tsx` | On Google Docs, **do not** auto-map `empty` → `ocr` |

Manifest output (via WXT):

```json
{
  "matches": ["*://docs.google.com/document/*"],
  "run_at": "document_start",
  "world": "MAIN",
  "js": ["content-scripts/google-docs-annotate.js"]
}
```

## Expected behavior matrix

| Scenario | Expected today (spike) |
|----------|------------------------|
| Normal page + selection | TTS overlay (unchanged) |
| Normal page + no selection | OCR capture mode (unchanged) |
| Google Docs + selection + **whitelisted** annotate | TTS overlay with selected text |
| Google Docs + selection + **not whitelisted** | Error: “Select some text first…” (no silent OCR) |
| Google Docs + no selection | Same error (no OCR) |

## Verification checklist (manual)

1. Load unpacked/dev extension; note extension ID from `chrome://extensions`.
2. Open a Google Doc; in page console: `window._docs_annotate_canvas_by_ext` should equal that ID.
3. Select text; inspect DOM for `.kix-canvas-tile-selection svg rect` (only if annotate mode active).
4. Option+S with selection → TTS overlay if text reads successfully.
5. Option+S without selection on Docs → error toast, **not** OCR dimming.
6. Option+S without selection on a normal page → OCR dimming (unchanged).

## Blockers before merge

1. **Google whitelist approval** for Motif’s extension ID (production and/or dev unpacked ID).
2. **Confirm** selection read works on macOS Chrome after whitelist (historically platform-dependent).
3. **Overlay rect quality** — iframe/textarea fallback rect is coarse; refine using selection overlay SVG bounds.
4. **Product decision** on Google Docs with no selection: keep “no OCR” vs offer explicit “Capture region” affordance.
5. **Remove or gate** spike behind a feature flag if whitelist is pending long-term.

## Recommended next steps (when revisiting)

1. Submit [Google whitelist form](https://docs.google.com/forms/d/e/1FAIpQLScFxMgvXlq2KMsp0UIM66pvThTF1hpojiXQTqyq9txW79OWag/viewform) for `mlgmlehgbmoebpgghjnkheaciijcfblo`.
2. Test spike branch on a real Doc after approval (or with a known-whitelisted dev ID in local builds only).
3. If annotate DOM appears but text is still empty, add logging around iframe `getSelection()` vs textarea indices.
4. If whitelist is denied or delayed, document Google Docs as **OCR-only** with an explicit in-product message rather than silent capture mode.
5. Do **not** ship impersonating another extension’s whitelisted ID in production (policy / breakage risk).

## Current product decision

**Defer merge** until whitelist status and manual verification on Google Docs are confirmed. Keep this spike + spec on a PR for future work.
