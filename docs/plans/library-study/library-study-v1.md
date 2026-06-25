# Library Study — V1 Plan

**Register:** product / feature spec  
**Status:** Draft (source of truth for implementation)  
**Last updated:** 2025-06-25

---

## Summary

Extend the Saved Library from a **reference browser** into a **light study surface** with two v1 capabilities:

1. **Cards layout** — A week-scoped carousel of flippable flashcards, toggled against the existing masonry list.
2. **Type-after-dictation** — An atomic practice exercise inside the saved entry dialog: hear TTS, type the word/phrase, get a binary correct/incorrect result.

A future **Practice** hub (top-level button, pooled sessions, multiple exercise types) is explicitly deferred. V1 validates the learning loop on single entries and improves browse UX via the carousel.

---

## Goals

| Goal | V1 | Later |
|------|----|-------|
| Browse saved vocabulary | Masonry (existing) + Cards carousel | Stats-driven sort |
| Passive review (flip) | Cards carousel | Deck / session modes |
| Active recall (dictation) | Per-entry dialog mode | Pooled quiz sessions |
| Track practice effort | Stats storage (`attemptCount`, `mistakeCount`) | Display badges, sort by weakness |
| Bookmarks / curated pools | — | Revisit when job is clear |
| LLM / rule-based hints | — | With multi-exercise flows |
| EN ↔ FR translation exercises | — | After dictation feels solid |

---

## Non-goals (V1)

- Top-level **Practice** button and pool selection UI
- Quiz sessions spanning multiple entries
- Bookmark field on `VocabEntry`
- LLM-backed or progressive hint systems (wrong-try counters, etc.)
- Accent/diacritic grading or partial scores
- Spaced repetition, streaks, familiarity flags
- Surfacing practice stats in the library UI (collect only)
- New exercise types beyond type-after-dictation

---

## Current baseline

Relevant existing behavior (as of this spec):

- **Library page** (`entrypoints/library/App.tsx`): search, sort (date / context count), masonry grid, paginated load-more.
- **Saved card**: original, translation, saved date, inline speak.
- **Saved entry dialog**: original (interactive TTS), translation, definition, contexts, notes, delete. Deep-link via URL param.
- **TTS**: on-device Supertonic via `speak-word` message → offscreen synthesis → playback events.
- **Vocab schema** (`VocabEntry`): `original`, `normalized`, `translation`, `note`, `contexts`, `createdAt`, `updatedAt`. No practice fields.

---

## Information architecture (V1)

```
Saved Library
├── Header (title, item count)
├── Toolbar
│   ├── Search
│   ├── Sort (existing options)
│   └── Layout toggle: List | Cards          ← new
│
├── List mode (default)
│   └── Masonry grid (existing SavedMasonryGrid)
│
└── Cards mode
    ├── Week rail:  ←  [This week]  →         ← new
    └── Carousel:  [ghost] [ACTIVE] [ghost]  ← new
        └── Flashcard (front / back)

SavedEntryDialog
├── Normal mode (existing detail view)
└── Dictation mode                             ← new
    ├── Header: title + dictation entry + Exit + Close
    ├── Exercise row: [Speak □] [ input ··· Submit · Hint 💡 ]
    └── Result (correct / incorrect, retry, review)
```

**Future (not v1):** A top-level **Practice** button in the library header will unify pool selection and multi-entry sessions. Dictation entry in the dialog remains as an atomic shortcut.

---

## Feature A — Cards layout (carousel)

### Purpose

Give saved items a **study-oriented browse mode**: one word at a time, flippable, scoped by week so the library never dumps the full collection into a single view.

### Layout toggle

| Control | Behavior |
|---------|----------|
| **List** | Current masonry grid (default) |
| **Cards** | Week carousel |

- Toggle lives in the library toolbar (alongside search / sort).
- Preference persisted in extension local storage (key TBD, e.g. `motLibraryLayout`).
- Sort and search apply in both modes; week rail further filters Cards mode to the selected week bucket.

### Week rail

Entries are grouped by **calendar week** using `createdAt`.

| Element | Behavior |
|---------|----------|
| **Label** | Relative when possible: “This week”, “Last week”; otherwise a date range (e.g. “Jun 2 – Jun 8, 2025”) |
| **← / →** | Previous / next week that contains at least one entry matching current search + sort |
| **Empty week** | If the navigated week has no matching entries: empty state copy (e.g. “Nothing saved this week”) |
| **Initial week** | Default to the week containing the newest matching entry (respecting sort) |

Week navigation skips weeks with zero entries after search filter — do not land the user on blank weeks unnecessarily.

### Carousel

| Element | Spec |
|---------|------|
| **Active card** | Centered, full width of the main column (`max-w-[560px]`), full opacity |
| **Adjacent cards** | Peek from **left and right**: reduced opacity (~40%), slightly scaled down, non-interactive |
| **Card count** | One active card; up to two ghost previews |
| **In-week navigation** | Prev/next within the current week’s entry list (buttons, swipe, or arrow keys — implement best-effort) |
| **Position indicator** | Optional but recommended: “3 of 12” for the current week |

### Flashcard layout

Each active carousel card uses a **dedicated flashcard layout** (not the masonry `SavedCard`).

**Card header (top-right, both faces):**

| Control | Icon | Action |
|---------|------|--------|
| **Flip** | Flip/rotate icon | Toggles front ↔ back |
| **Open details** | Details/expand icon | Opens `SavedEntryDialog` in normal mode |

Both icon buttons sit in the **top-right** of the card, grouped together. Visible on **front and back**.

**Card body:**

| Face | Content |
|------|---------|
| **Front** | `original` via **`InteractiveWordText`** — **bold**, prominent; same click/select-to-speak behavior as the saved dialog |
| **Back** | `translation` only (plain text) |

**Pronunciation on front (no separate speak button):**

- Reuse `InteractiveWordText` + `useLibraryWordPronunciation` (or equivalent hook) — identical to `SavedEntryDialog` original surface.
- User **clicks or selects word ranges** in the original text to hear TTS; word-level highlight sync on playback.
- Use the same `libraryWordText` styling class for visual consistency.
- No standalone speak icon button on the flashcard.

**Interaction boundaries:**

- Click/select on original text → speak selected range (does not flip or open dialog).
- Card body tap elsewhere does **not** flip or open dialog; only the header icon buttons do.
- No saved date on the card face in v1.

### Cards mode + search/sort

1. Apply search filter and sort to all entries (same as list mode).
2. Bucket filtered results by week (`createdAt`).
3. Week rail navigates buckets.
4. Carousel shows entries for the selected week only, preserving sort order within the week.

### Empty / edge cases

| Case | Behavior |
|------|----------|
| No saved entries at all | Existing `LibraryEmptyState` |
| Entries exist but none match search | Existing empty search state |
| Cards mode, week has no matches | Week-specific empty state |
| Single entry in week | Carousel with no ghost cards (or ghosts hidden) |

### Visual notes

- Match existing library tokens: cream canvas, hairline borders, restrained shadow on hover/active.
- Ghost cards must not trap focus; only the active card is in the tab order.
- Honor `prefers-reduced-motion` for carousel slide and flip transitions.

### Open decisions — Cards

| # | Question | Default for v1 |
|---|----------|----------------|
| C1 | Cap entries per week in carousel? | Show all entries for the week; add cap if UX suffers |
| C2 | Swipe on trackpad/touch | Nice-to-have; arrow buttons sufficient for v1 |
| C3 | Header button order (flip vs details) | Flip left of details in the top-right cluster |

---

## Feature B — Type-after-dictation (atomic)

### Purpose

Active recall for a single saved entry: hear the target language audio, type what you heard, get a **binary** correct/incorrect result. Lives entirely inside the existing saved entry dialog.

### Entry point

| Location | Spec |
|----------|------|
| **SavedEntryDialog header** | Icon/button **top-right, immediately left of the close (X) control** |
| **Label** | Icon-first with accessible name (e.g. “Practice dictation”); tooltip optional |
| **Action** | Switches dialog to **dictation mode** (same `Dialog` shell, conditional render) |

Opening dictation from the carousel/detail dialog does not change library layout state.

### Dictation mode — exercise row

Replaces the normal **original | translation** split. Single horizontal row, **uniform height** across all controls:

```
┌────────┬──────────────────────────────────────────────┐
│ Speak  │  [ text input ·········  Submit ] [ 💡 ]     │
│  □     │                                              │
└────────┴──────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| **Speak button** | Compact **square** on the **left**; height matches input row (icon ~20px inside; button sized to row height, not oversized) |
| **Text input** | Fills remaining space; auto-focused on enter |
| **Submit** | Primary button, **right of input**, same height as input and speak button |
| **Hint (hold-to-peek)** | **Ghost** button with lightbulb icon, right of Submit, same height; see below |
| **Exit dictation mode** | Replaces Remove — right-aligned in footer/header action row |
| **Close (X)** | Still dismisses entire dialog (exits dictation + detail) |

Enter key submits when input is focused.

### Hold-to-peek hint

| Behavior | Spec |
|----------|------|
| **Press and hold** | Temporarily fills the input with the correct answer (`entry.original`) |
| **Release** | Reverts input to whatever the user had typed before the press |
| **Style** | Ghost/secondary — not a primary action |
| **Stats** | Using the hint does **not** increment `mistakeCount` by itself; only an incorrect **submit** does |
| **Accessibility** | Provide keyboard-accessible equivalent (e.g. focus hint + Space hold, or document as pointer-only v1 with follow-up) |

This is a mechanical peek, not an LLM or progressive hint system.

### Dictation mode — hidden UI

Do **not** render:

- Definition (`SavedEntryDefinition`)
- Contexts list
- Notes field
- Saved date
- Remove / delete entry
- Original / translation split (replaced by exercise row)
- Interactive word breakdown on original

The correct answer is never shown persistently during typing — only via hold-to-peek or after submit/review.

### Flow

```
1. User clicks dictation button in dialog header
2. Dialog re-renders in dictation mode; attemptCount++ (once per mode entry)
3. Audio auto-plays entry.original
4. Input focused; user types
5. User submits → DictationGrader → correct / incorrect
6. On incorrect: show expected vs submitted; mistakeCount++
7. User can:
   - Retry (clear result, keep or clear input)
   - Review (reveal expected + translation)
   - Exit dictation mode → normal dialog
   - Close dialog entirely
```

| Step | Detail |
|------|--------|
| **Auto-play** | Once on entering dictation mode; replay via speak button |
| **During playback** | User may type while audio plays |
| **Retry** | Resets result state; does not exit mode; does not increment `attemptCount` |
| **Exit** | Returns to normal dialog view for same entry |

### Grading

#### Principles (v1 — minimal)

- **Binary:** correct or incorrect. No score out of 5.
- **Accents not checked.** Diacritics are ignored entirely for grading.
- **Alphabet match is sufficient:** if the submitted text matches the expected text after normalization (trim, collapse whitespace, case-fold, strip accents, ignore punctuation), it is **correct**.
- Output is a structured **`GradingResult`** for display and stats, not a numeric rubric.

#### Normalization (grading)

Apply in order before comparison:

1. Trim and collapse internal whitespace
2. Case-fold (locale-aware for target language)
3. Strip combining diacritics / accent marks from both strings
4. Remove or ignore punctuation

If normalized strings are equal → **correct**. Otherwise → **incorrect**.

#### GradingResult shape

```ts
type GradingResult = {
  correct: boolean;
  expected: string;    // entry.original (display form)
  submitted: string;   // raw user input
};
```

#### Implementation note

Introduce a **`DictationGrader`** module that:

1. Accepts `expected` and `submitted` strings.
2. Applies the normalization pipeline above.
3. Returns `GradingResult`.

Keep grading normalization separate from vocab **`normalized`** dedup logic. Reuse shared unicode helpers where they exist.

### Stats

Minimal counters only — enough for future library display, nothing more in v1.

| Event | Stats effect |
|-------|--------------|
| Enter dictation mode | `attemptCount++` (**once per mode entry**, not per retry) |
| Submit, incorrect | `mistakeCount++` |
| Submit, correct | No increment to `mistakeCount` |

No UI displays stats in v1.

---

## Practice stats storage

### Purpose

Telemetry per saved entry, **separate from vocab schema**, so analytics can evolve without migrating user content.

### Storage

| Aspect | Spec |
|--------|------|
| **Location** | Extension local storage (separate key from `motVocab`, e.g. `motPracticeStats`) |
| **Key** | Entry `normalized` |
| **Schema version** | Include `schemaVersion` for future migrations |

### Record shape (v1)

```ts
type PracticeStatsRecord = {
  attemptCount: number;   // dictation mode entries (once per enter)
  mistakeCount: number;   // incorrect submits
};

type PracticeStatsStore = {
  schemaVersion: number;
  records: Record<string, PracticeStatsRecord>; // key = normalized
};
```

### API (conceptual)

- `getPracticeStats(normalized): PracticeStatsRecord | null`
- `recordDictationModeEnter(normalized): void` — increments `attemptCount`
- `recordDictationSubmit(normalized, result: GradingResult): void` — increments `mistakeCount` when `!result.correct`

### Future use (not v1)

- Badge on library cards (“3 mistakes”, “Needs practice”)
- Sort: most mistakes, least attempted
- Practice hub pool suggestions

---

## Accessibility

| Area | Requirement |
|------|-------------|
| Layout toggle | Toggle or segmented control with clear labels; not color-only |
| Week rail | Buttons have accessible names (“Previous week”, “Next week”); current week announced |
| Carousel | Active card focusable; arrow controls keyboard-operable |
| Flashcard | Flip and Open details buttons have accessible names; `InteractiveWordText` keyboard/select behavior matches saved dialog |
| Dictation | Input labeled; speak button named “Play pronunciation”; result announced in live region |
| Hold-to-peek hint | Document pointer-primary v1; follow up with keyboard hold if needed |
| Reduced motion | Respect `prefers-reduced-motion` for flip, carousel slide, result reveal |

---

## Technical dependencies (existing)

| Capability | Used by |
|------------|---------|
| `VocabEntry` / `listVocabEntries` | Cards week bucketing, dialog |
| `speak-word` + playback messages | Dictation audio |
| `SavedEntryDialog` | Dictation mode shell |
| Supertonic offscreen synthesis | TTS generation |
| Local storage patterns from vocab store | Layout preference, stats store |

### New modules (expected)

| Module | Responsibility |
|--------|----------------|
| `DictationGrader` | Normalization + binary `GradingResult` |
| `practice-stats-store` | `attemptCount` / `mistakeCount` read/write |
| `week-bucket` (or inline util) | Group entries by calendar week |
| `Flashcard` | Front/back layout + header actions; front uses `InteractiveWordText` + pronunciation hook |
| `SavedCardsCarousel` | Carousel + ghost cards |
| `LibraryLayoutToggle` | List / Cards switch |
| `WeekRail` | Week navigation |
| Dictation UI slice in `SavedEntryDialog` | Mode switch + exercise row |

---

## Build order

1. **`DictationGrader`** + unit tests (accents ignored, case/punctuation ignored, wrong alphabet).
2. **`practice-stats-store`** + record hooks for mode enter and submit.
3. **Dictation mode** in `SavedEntryDialog` (TTS → exercise row → grade → stats).
4. **Layout toggle** + **week bucket util**.
5. **`Flashcard`** + **week rail** + **carousel**.

Dictation first proves the learning loop; carousel follows or runs in parallel once grader/stats exist.

---

## Test plan (acceptance)

### Dictation

- [ ] Enter dictation from dialog header; definition/contexts/notes/delete hidden.
- [ ] Exercise row: speak square, input, submit, hint — all same height.
- [ ] Audio plays on enter; replay via speak button.
- [ ] Submit correct (ignoring accents) → correct result.
- [ ] Submit correct letters wrong accents → still **correct**.
- [ ] Submit wrong letters → incorrect; expected vs submitted shown; `mistakeCount++`.
- [ ] Case and punctuation ignored.
- [ ] Hold hint fills input; release restores prior input.
- [ ] Exit returns to normal dialog; close dismisses dialog.
- [ ] `attemptCount++` once per dictation mode entry; not on retry.
- [ ] `mistakeCount++` only on incorrect submit.

### Cards

- [ ] Toggle List ↔ Cards persists across reload.
- [ ] Week rail defaults to current/newest week.
- [ ] ←/→ skips empty weeks; label correct.
- [ ] Search/sort respected in Cards mode.
- [ ] Active card centered; ghost cards visible left/right.
- [ ] Front: original via `InteractiveWordText` (bold); back: translation only.
- [ ] Click/select word range on front speaks (same behavior as saved dialog); no separate speak button.
- [ ] Flip icon toggles face; details icon opens dialog (both faces).
- [ ] Card body tap (outside word select) does not flip or open dialog.
- [ ] Empty states for no entries / no week matches.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-06-25 | Initial v1 spec: carousel + atomic dictation, grading, stats storage |
| 2025-06-25 | Resolved open decisions: flashcard header actions, dictation exercise row, hold-to-peek hint, binary grading (accents ignored), minimal stats (`attemptCount`, `mistakeCount`) |
| 2025-06-25 | Flashcard front: `InteractiveWordText` click/select-to-speak (consistent with saved dialog); no standalone speak button |
