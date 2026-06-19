# IPA / G2P — investigation notes (deferred)

Mot explored on-device IPA (International Phonetic Alphabet) for tapped words. We **deferred** this feature: the cost/complexity outweighs the benefit for now, especially next to Chrome’s built-in Translator API for glosses.

## What we wanted

When the user taps a word in the overlay:

- Show English translation (Chrome Translator API — shipped)
- Show French IPA on the translation row, e.g. `/de/`

## Why there is no easy browser API

Unlike translation (Chrome **Translator API** in recent desktop Chrome), there is **no native IPA or G2P API** in the browser. Options are all app-side:

| Approach | Pros | Cons |
|----------|------|------|
| **Dictionary lookup** (Wiktionary, etc.) | Often good IPA for lemmas | Network or large offline cache; weak on inflected forms (`l'utilisation`) |
| **Cloud phonetics API** | Simple integration | Privacy, cost, offline |
| **On-device G2P model** | Private, works offline | Heavy (~100MB+), complex inference stack |

## Model we evaluated

**[klebster/g2p_multilingual_byT5_tiny_onnx](https://huggingface.co/klebster/g2p_multilingual_byT5_tiny_onnx)** (Charsiu ByT5 tiny, ~100 languages)

- Input: `<fra>: mot` → IPA output, e.g. `<fra>: bonjour` → `bɔ̃ʒuʁ`
- ~106 MB FP32 ONNX (encoder + decoder + decoder_with_past)
- ~27 MB INT8 quantized
- French PER ~0.75% on CharsiuG2P test set

## Why Transformers.js did not “just work”

We tried `@huggingface/transformers` with `pipeline('text2text-generation', …)` in the offscreen document (same place as Supertonic TTS).

**Failures:**

1. **Wrong ONNX layout** — Transformers.js expects weights under `onnx/` on Hugging Face. The klebster repo ships Optimum exports at the repo root (`encoder_model.onnx`, etc.). Even after mirroring files into `onnx/`, loading still failed.

2. **No `tokenizer.json`** — ByT5 uses byte-level tokenization (`ByT5Tokenizer`), not SentencePiece. The ONNX repo only has `tokenizer_config.json` / `added_tokens.json`. Transformers.js requires `tokenizer.json` for its pipeline.

3. **No `ByT5Tokenizer` in Transformers.js** — The model `config.json` sets `"tokenizer_class": "ByT5Tokenizer"`. That class is not implemented in Transformers.js (only generic `T5Tokenizer`). Tokenization must be reimplemented (UTF-8 bytes + offset 3) or exported separately.

4. **Seq2seq ONNX inference** — Even with files laid out correctly, Optimum’s T5 export uses separate encoder/decoder graphs with KV-cache. That is a custom greedy/beam loop on `onnxruntime-web`, not a one-line pipeline.

**Representative error when loading from HF:**

```
Could not locate file: ".../onnx/encoder_model.onnx"
```

**Representative error with local `onnx/` mirror:**

```
Local file missing at ".../tokenizer.json"
```

## What a full implementation would require

If we revisit IPA later, a realistic path (aligned with Mot’s Supertonic pattern):

1. **Download & serve** — Extend `scripts/models.py` to fetch G2P assets into `models/g2p/` (with `onnx/` subfolder + tokenizer sidecars), serve from port 8091 like Supertonic.

2. **ByT5 tokenizer in JS** — Encode/decode UTF-8 bytes with offset 3; prompt format `<fra>: {word}`; strip edge punctuation from tapped tokens.

3. **ORT inference in offscreen** — Load encoder/decoder sessions via `onnxruntime-web` (reuse WASM path setup from `utils/supertonic/loader.ts`); implement greedy decode with `decoder_with_past_model.onnx` for steps after the first.

4. **UI** — Slot on translation row (we had stubbed `.translation-ipa-value`); word-mode only; cache per session.

5. **Optional** — Warm-up on install; INT8 models for size; settings toggle `pronunciation.ipa: on | off`.

**Rough cost:** ~100MB download, ~900KB+ extra offscreen bundle, noticeable first-tap latency, non-trivial maintenance.

## Lighter alternatives (if we only need “good enough”)

- **Lemma dictionary** — Offline JSON for top N French lemmas + Wiktionary fetch fallback (no ML).
- **Espeak-ng WASM** — Mature French IPA; different stack from Transformers.js, but smaller integration surface than ByT5 ORT.
- **Server-side G2P in dev only** — Python + Optimum for prototyping, not for production extension.

## Current product decision

**Ship translation only** (Chrome Translator API). **Skip IPA** until we have a clear quality bar and a maintainable stack—likely dictionary-first for common words, or a dedicated ORT G2P path if ML quality is required.

## Related code (removed)

IPA scaffolding was removed from the extension. Translation UI (original + gloss rows, “Show full translation”) remains.

See also: [highlight-sync.md](./highlight-sync.md) for TTS/highlight architecture.
