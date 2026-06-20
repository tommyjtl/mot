# Mot

A Chrome extension for hearing natural French pronunciation while reading the web.

Select text on any page and press **Option+S** to hear it aloud. Speech is synthesized **entirely on-device** using [Supertonic](https://github.com/supertone-inc/supertonic) via ONNX Runtime Web (WebGPU with WebAssembly fallback). No Python server required.

With no text selected, **Option+S** enters **screen capture mode**: drag a rectangle over text in the page (including images), and Mot runs on-device OCR ([Tesseract.js](https://github.com/naptha/tesseract.js) v7, French) before speaking the result.

## First run

On first use, Mot downloads the Supertonic model assets (~400 MB) from Hugging Face and caches them in the browser. This happens once; later sessions reuse the cache.

While the model is loading, the overlay shows **Loading model…**. Once ready, it switches to **Generating pronunciation…** during synthesis.

Mot also starts downloading/warming the model in the background after install to reduce wait time on first Option+S.

## Requirements

- Chrome 113+ (WebGPU recommended)
- Network access on first model download

## Development

```bash
npm install
npm run dev
```

WXT opens a browser with the extension loaded. Changes hot-reload during development.

## Build

```bash
npm run build
```

Load the unpacked extension from `.output/chrome-mv3/` in `chrome://extensions`.

## Usage

**With a text selection**

1. Select French text on any webpage (partial words at the edges are expanded to whole words automatically)
2. Press **Option+S** (remappable in Chrome extension shortcuts)

**Without a text selection (OCR)**

1. Press **Option+S** — the page dims and you can drag a rectangle over text (including in images)
2. Mot captures that region, recognizes French text with Tesseract.js, then speaks it in the main overlay

**In the overlay**
3. Use **Listen** / **Stop pronunciation** in the overlay
4. Word highlighting follows along in the overlay during playback

Open **Mot → Options** to configure voice (default `F1`) and language mode (`French` or `Language-agnostic`).

## v0 scope

- Select text → shortcut → on-device Supertonic TTS
- Overlay near the text selection (loading model, generating, listen/stop, errors)
- Word-level highlight sync in the overlay
- Options page for voice and language settings

Vocabulary capture, translation, in-page DOM highlighting, and flashcards are planned for later.

## Architecture

| Piece | Role |
|-------|------|
| `entrypoints/background.ts` | Shortcut, session lock, orchestration |
| `entrypoints/offscreen/` | ONNX model load, synthesis, fallback audio |
| `entrypoints/overlay.content.ts` | Selection UI, playback, word highlight |
| `utils/supertonic/` | Supertonic web port (loader, TTS, alignment) |

Based on the official [Supertonic web example](https://github.com/supertone-inc/supertonic/tree/main/web).

## Highlight sync

See [docs/highlight-sync.md](docs/highlight-sync.md) for what the model outputs (audio, alignment, word timings) and how playback ticks drive overlay highlights.

## Translation & IPA (deferred)

Word-level English glosses use Chrome’s built-in Translator API. On-device IPA was investigated and deferred — see [docs/ipa-g2p-notes.md](docs/ipa-g2p-notes.md).
