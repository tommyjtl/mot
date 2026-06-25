# Product

## Register

product

## Users

French learners and intermediate readers who consume French on the open web — news (RFI, Le Monde), YouTube, social posts, and mixed-language pages. They read with a browser tab focused on content, often with audio or video nearby. They want pronunciation help, vocabulary capture, and transcription without leaving the page or sending text to a cloud TTS API.

## Product Purpose

**Motif — hear it, save it, remember it.**

Motif is a Chrome extension that makes French on the web legible and memorable:

- **Hear it:** Select text (or OCR a region) and get on-device Supertonic TTS with word-level highlight sync.
- **Save it:** Capture words into a personal vocabulary with contexts and notes from the page.
- **Remember it:** (Roadmap) Spaced repetition and flashcards built on saved entries.

Success looks like a learner who stays in flow on the original page — hearing correct pronunciation, saving a word in one gesture, and returning to reading without context-switching to another app.

## Brand Personality

Quietly confident, warm, editorial — closer to a well-designed reading tool than a gamified language app. Calm over clever. Precise over playful. The product should feel like a capable companion, not a tutor shouting for attention.

**Three words:** Warm, precise, unobtrusive.

## Anti-references

- Dark IDE / developer-dashboard SaaS chrome (dense sidebars, navy shells, metric hero cards).
- Generic language-app gamification (streak flames, XP badges, loud gradients).
- AI-slop marketing pages: cream canvas + identical card grids + gradient text + drop-shadow cards.
- Floating panels that feel like ads or modals blocking the page.
- Cloud-dependent TTS that breaks offline or leaks reading habits.

## Design Principles

1. **Stay in the reading flow.** Overlays are compact, draggable, and dismissible; the web page remains the primary surface.
2. **On-device by default.** Models download once, run locally, and respect privacy — no server round-trip for synthesis or OCR.
3. **Progressive depth.** Hear → save → remember is a ladder; v0 nails hear + save without forcing flashcard UX prematurely.
4. **Restrained visual confidence.** Hairline borders, sparse orange accent, system typography — craft through spacing and hierarchy, not decoration.
5. **Keyboard-first power use.** Shortcuts for speak and transcribe are first-class and configurable; options stay discoverable but out of the way.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** for extension pages (options) and overlay controls.
- Maintain **≥4.5:1** body text contrast on the cream canvas; avoid washed-out muted grays on tinted backgrounds.
- **Configurable keyboard shortcuts**; visible focus rings on interactive controls.
- Honor **`prefers-reduced-motion`** when adding or migrating overlay animations.
- Error and loading states use plain language (model download, capture denied, worker unavailable).
