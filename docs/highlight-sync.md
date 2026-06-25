# Highlight sync and model output

This document describes what Supertonic gives Motif during synthesis, and how the overlay keeps word highlights aligned with audio playback.

## What the model gives us

Motif runs **Supertonic 3** in an offscreen document via ONNX Runtime Web. For each synthesis request, the pipeline produces:

### 1. WAV audio

A mono PCM WAV buffer at the model sample rate (from `onnx/tts.json`). This is what you hear when pronunciation plays.

### 2. Display text

The **processed speakable string** after Supertonic’s text frontend (language tags stripped, normalization applied). The overlay shows this text, not necessarily the raw page selection byte-for-byte.

### 3. Word alignment (`TtsAlignment`)

Built from the **duration predictor** (`duration_predictor.onnx`), which outputs a duration in **seconds per character** of the preprocessed string.

Each entry in `alignment.words` is a `WordTiming`:

| Field   | Type     | Meaning                                      |
|---------|----------|----------------------------------------------|
| `index` | number   | Zero-based word index in display text        |
| `text`  | string   | The word token                               |
| `start` | number   | Start time in seconds from clip beginning     |
| `end`   | number   | End time in seconds (exclusive boundary)      |

**How word times are computed** (`utils/supertonic/alignment.ts`):

1. Sum character durations for each character in a word.
2. Skip leading/trailing non-speakable wrapper from lang tags.
3. **Scale** all word times so the predicted timeline matches the actual WAV length (predicted vs generated audio can differ slightly).

For multi-chunk text, word timings are concatenated with silence gaps between chunks.

### 4. What we do *not* get

- Sample-accurate phoneme boundaries (character-level durations are model estimates).
- A separate “ground truth” timeline from the vocoder — alignment is from the duration predictor, then scaled to WAV length.

---

## How audio playback works

```
Offscreen document                Background                 Content script (overlay)
─────────────────                ──────────                 ──────────────────────────
HTMLAudioElement plays WAV  →    relays ticks (~20 Hz)  →   adaptive playback clock
                                 mot-playback-relay          + 60 fps highlight loop
```

1. **Synthesis** completes in the offscreen document.
2. **Background** sends `tts-result` (text, audio, alignment) to the tab, then starts playback in offscreen.
3. **Offscreen** emits playback position every **50 ms** (`currentTime`, `duration`) while audio plays.
4. **Background** forwards these as `tts-playback` messages to the content script.
5. **Listen / Stop** replays or stops the same offscreen player.

Audio always plays in the **offscreen document** (not in the page), so autoplay works after Option+S.

---

## How highlight sync works

Highlights live **only inside the overlay shadow DOM** (`<span class="word">`). The page DOM is never modified.

### Choosing the active word

`utils/overlay-word-sync.ts`:

1. **If alignment exists:** find the word where  
   `currentTime >= word.start && currentTime < word.end`
2. **Otherwise (fallback):** assume equal time per word using  
   `floor((currentTime / duration) * wordCount)`

### Estimating “now” between ticks

`utils/overlay-playback-clock.ts`:

1. Each playback tick **anchors** the clock to offscreen `currentTime`.
2. A **requestAnimationFrame** loop extrapolates between ticks:  
   `estimatedTime = anchorTime + elapsedSinceAnchor + adaptiveLatency`
3. **Adaptive latency** (0–120 ms) learns relay lag by comparing each incoming tick to our extrapolation (starts at 25 ms, smooths with EMA).

### Duration source

Prefer alignment’s last word `end` time when available; otherwise use the audio element’s `duration` from playback ticks.

---

## Word tap (single-word playback)

When the user **clicks a word** in the ready overlay:

1. Motif **stops** current playback.
2. Sends **only that word** back through the same Supertonic pipeline (new synthesis).
3. Plays the short clip and **highlights that word** for the duration of the clip.
4. **Listen** still replays the **full** original selection audio.

Word clips reuse the same alignment + playback clock machinery, scoped to one word.
