# Testing plan

Mot will use [WXT Vitest](https://wxt.dev/guide/essentials/unit-testing.html) for unit tests and [Playwright](https://wxt.dev/guide/essentials/e2e-testing.html) for E2E tests against `.output/chrome-mv3`.

## Setup (future)

**Unit**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({ plugins: [WxtVitest()] });
```

- Mock WXT APIs via real import paths (see `.wxt/types/imports-module.d.ts`), not `#imports`.
- Reset extension state between tests: `fakeBrowser.reset()` from `wxt/testing/fake-browser`.

**E2E**

- Load extension from `.output/chrome-mv3` (Playwright Chrome Extension docs).
- Reference: [wxt-dev/examples — Vitest](https://github.com/wxt-dev/examples), [Playwright example](https://github.com/wxt-dev/examples).

---

## Unit test cases

Pure logic first; mock offscreen/ONNX/Tesseract for anything heavy.

| Area | File(s) | Cases |
|------|---------|-------|
| Selection | `utils/selection.ts` | `expandIndicesToWordBoundaries` — partial word, whitespace, Unicode; `MAX_SELECTION_LENGTH` → `too_long` |
| Phrase / tokens | `utils/overlay-phrase.ts` | `tokenizeWords`, `phraseFromWordRange` — empty, single word, range clamping |
| Text chunking | `utils/supertonic/chunk-text.ts` | Paragraph/sentence splits; abbreviations (`Dr.`, `e.g.`); `maxLen` edge cases |
| Shortcut | `utils/speak-shortcut.ts` | Alt+S accepted; Option+ß on Mac ignored; modifiers rejected |
| Settings | `utils/settings.ts` | Defaults merged; persist/read via `fakeBrowser` storage |
| Store | `lib/create-store.ts` | `setState`, functional updates, subscribe/unsubscribe |
| Audio | `utils/audio-encoding.ts` | Base64 ↔ ArrayBuffer round-trip |
| Capture region | `utils/capture-region.ts` | Viewport rect → selection rect math |
| Tab requests | `utils/tab-requests.ts` | Generation invalidation, stale request ignored |
| Overlay sync | `utils/overlay-word-sync.ts`, `utils/overlay-playback-clock.ts` | Word index at `currentTime`; boundary ticks |
| Alignment | `utils/supertonic/alignment.ts`, `utils/alignment-from-audio.ts` | Timing → word index mapping (fixture data) |
| Messages | `utils/messages.ts` | Type guards / payload shapes (if helpers exist) |
| Translation | `utils/translation/` | Chrome Translator wrapper mocked; error paths |

**Defer (integration / slow):** Supertonic loader, ONNX inference, Tesseract OCR, offscreen document lifecycle.

---

## E2E test cases

Run against a built extension; stub Hugging Face model download in CI if possible (~400 MB).

| Flow | Steps | Assert |
|------|-------|--------|
| Install / manifest | Load unpacked build | Permissions, commands (`Alt+S`, `Alt+T`), CSP allow wasm |
| Options | Open options page | Default voice `F1`, lang `fr`; save persists after reload |
| Speak selection | Select French text → `Alt+S` | Overlay appears; loading → generating → listen UI |
| Stop playback | Click stop in overlay | Audio stops; overlay dismisses or idle state |
| Empty selection | `Alt+S` with no selection | OCR capture mode (dimmed page, drag rect) |
| OCR path | Drag over text image | Recognized text shown; TTS triggered (or mocked) |
| Too-long selection | Select >300 chars | Error/toast; no crash |
| Transcript | `Alt+T` on media tab | Transcript overlay opens; stop ends session |
| Word highlight | Play TTS | Active word advances during playback |
| Multi-tab | Speak in tab A, switch to tab B | Session scoped per tab; no bleed |
| Shortcut remap | Change command in `chrome://extensions/shortcuts` | New binding triggers speak |

**Chrome Web Store smoke (pre-submit):** fresh profile install, first-run model download, offline after cache, no console errors on common sites (YouTube, news article).

---

## TODO

1. Add `vitest`, `vitest.config.ts`, `"test": "vitest"` script.
2. First unit tests: `expandIndicesToWordBoundaries`, `chunkText`, `isSpeakSelectionShortcut`, `getSettings`/`saveSettings`.
3. Add `@playwright/test`; fixture loads `.output/chrome-mv3`.
4. CI: `wxt build` → unit tests → E2E (headless Chromium + extension flags).
5. E2E #1: options save/reload. E2E #2: selection → overlay visible (mock TTS response).
6. Model-download stub or pre-seeded profile for repeatable CI.
7. Pre-release checklist: manifest review, privacy policy, store listing assets, permissions justification.
