# Motif

*Hear it, save it, remember it.*

A Chrome extension for hearing natural French pronunciation while reading the web.

For product overview, features, UX differentiation, and website-ready copy, see [PRODUCT-PR.md](PRODUCT-PR.md).

Select text on any page and press **Option+S** to hear it aloud. Speech is synthesized **entirely on-device** using [Supertonic](https://github.com/supertone-inc/supertonic) via ONNX Runtime Web (WebGPU with WebAssembly fallback). No Python server required.

With no text selected, **Option+S** enters **screen capture mode**: drag a rectangle over text in the page (including images), and Motif runs on-device OCR ([Tesseract.js](https://github.com/naptha/tesseract.js) v7, French) before speaking the result.

## First run

On first use, Motif downloads the Supertonic model assets (~400 MB), preferring a local dev server when `npm run models:serve` is running, otherwise from Hugging Face. Files are cached in the browser and reused across restarts.

While the model is loading, the overlay shows **Loading model…**. Once ready, it switches to **Generating pronunciation…** during synthesis.

Motif also starts downloading/warming the model in the background after install to reduce wait time on first Option+S.

## Requirements

- Chrome 113+ (WebGPU recommended)
- Network access on first model download

## Development

```bash
npm install
npm run dev
```

WXT opens a browser with the extension loaded. Changes hot-reload during development.

Dev uses a **persistent Chrome profile** at `.wxt/chrome-data` (see `wxt.config.ts`). On-device TTS (~400 MB) and STT (~640 MB) models are cached there via the Cache API and reused across restarts — they are **not** stored in `/tmp`.

### Dev storage

Report what is using disk:

```bash
npm run dev:storage
```

Remove legacy `tmp-web-ext--*` folders from `/tmp` (usually only a few MB; **does not** clear model caches):

```bash
npm run dev:clean-tmp
```

Reset the dev browser profile and clear cached models (they re-download on next warm-up):

```bash
npm run dev:clean-profile
```

That command removes `.wxt/chrome-data` — the same as:

```bash
rm -rf .wxt/chrome-data
```

Stop `npm run dev` and close the dev browser before cleaning. Add `--dry-run` to preview, or `--force` to skip the running-dev guard.

## Build

```bash
npm run build
```

Load the unpacked extension from `.output/chrome-mv3/` in `chrome://extensions`.

## Releasing

Version bumps, git tags, the pre-commit guard, GitHub Releases, and Chrome Web Store upload are documented in **[RELEASE.md](RELEASE.md)**.

In short: bump `package.json` with `npm version patch|minor|major --no-git-tag-version` when shipping extension changes; merge via PR; CI creates `v{version}` and the zip when the version is higher than the latest tag.

## Usage

**With a text selection**

1. Select French text on any webpage (partial words at the edges are expanded to whole words automatically)
2. Press **Option+S** (configurable in Motif Options)

**Without a text selection (OCR)**

1. Press **Option+S** — the page dims and you can drag a rectangle over text (including in images)
2. Motif captures that region, recognizes French text with Tesseract.js, then speaks it in the main overlay

**In the overlay**
3. Use **Listen** / **Stop pronunciation** in the overlay
4. Word highlighting follows along in the overlay during playback

Open **Motif → Options** to configure voice (default `F1`), language mode (`French` or `Language-agnostic`), and keyboard shortcuts.

## v0 scope

- Select text → shortcut → on-device Supertonic TTS
- Overlay near the text selection (loading model, generating, listen/stop, errors)
- Word-level highlight sync in the overlay
- Options page for voice, language, and shortcut settings
- Live tab transcription (Option+T)
- Vocabulary capture and word overlay

Flashcards and broader spaced-repetition flows are planned for later.

## Architecture

| Piece | Role |
|-------|------|
| `entrypoints/background.ts` | Shortcut, session lock, orchestration |
| `entrypoints/offscreen/` | ONNX model load, synthesis, fallback audio |
| `entrypoints/overlay.content.ts` | Selection UI, playback, word highlight |
| `entrypoints/options/` | Settings page (React + shadcn/ui) |
| `utils/supertonic/` | Supertonic web port (loader, TTS, alignment) |

UI styling follows [DESIGN.md](DESIGN.md) (warm cream canvas, Cursor Orange primary) via Tailwind + [shadcn/ui](https://ui.shadcn.com/) on the options page; overlays migrate in a later phase.

Based on the official [Supertonic web example](https://github.com/supertone-inc/supertonic/tree/main/web).

## Highlight sync

See [specs/highlight-sync.md](specs/highlight-sync.md) for what the model outputs (audio, alignment, word timings) and how playback ticks drive overlay highlights.

## Translation & IPA (deferred)

Word-level English glosses use Chrome’s built-in Translator API. On-device IPA was investigated and deferred — see [specs/ipa-g2p-notes.md](specs/ipa-g2p-notes.md).

## Authenticated model CDN (planned)

Future: Google sign-in + private S3/CloudFront for TTS model downloads — see [specs/authenticated-model-cdn.md](specs/authenticated-model-cdn.md).
