# Roadmap slice progress

State file for the `roadmap-slice` skill. The skill reads this file on every
invocation to find the next slice to build, and rewrites it as part of each
committed slice. You can hand-edit the **Next slice** prompt below to steer what
gets built next — the skill uses whatever is here.

- Scope and ordering come from [`roadmap.md`](./roadmap.md).
- Project rules (validation, commit style, what's out of scope) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken in
  roadmap order — never a whole version at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline (built before this skill existed)

As of commit `f8f4e83`, these roadmap versions are complete:

- **v1** — 13×13 grid, click-to-toggle, named ranges, local save/view/edit/delete,
  practice mode, session stats.
- **v1.1** — drag-select painting, range shortcut buttons, live range percentage and
  combo counts.
- **v1.2** — range notation parser/exporter (import, export, copy, dash ranges).
- **v1.3** — optional scenario metadata and the metadata editor fields.

The next roadmap target is **v1.4 — Range library and filtering**.

## Completed slices

| # | Slice | Roadmap | Date |
|---|-------|---------|------|
| 1 | Search saved ranges by name | v1.4 — Range library and filtering | 2026-06-03 |
| 2 | Filter saved ranges by position | v1.4 — Range library and filtering | 2026-06-03 |
| 3 | Filter saved ranges by action type | v1.4 — Range library and filtering | 2026-06-03 |
| 4 | Filter saved ranges by stack depth | v1.4 — Range library and filtering | 2026-06-03 |
| 5 | Filter saved ranges by game type | v1.4 — Range library and filtering | 2026-06-03 |
| 6 | Sort saved ranges by name | v1.4 — Range library and filtering | 2026-06-05 |
| 7 | Sort saved ranges by recently edited | v1.4 — Range library and filtering | 2026-06-05 |
| 8 | Duplicate a saved range | v1.4 — Range library and filtering | 2026-06-05 |
| 9 | Archive / unarchive a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |
| 10 | Hide archived ranges by default behind a "Show archived" toggle | v1.4 — Range library and filtering | 2026-06-05 |
| 11 | Favorite / unfavorite a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |
| 12 | Filter to favorited ranges only behind a "Favorites only" toggle | v1.4 — Range library and filtering | 2026-06-05 |
| 13 | Persist per-range practice stats (type + storage foundation) | v1.4 — Range library and filtering | 2026-06-05 |
| 14 | Record finished practice sessions into per-range stats | v1.4 — Range library and filtering | 2026-06-05 |
| 15 | Show per-range practice stats (last practiced + accuracy) on library cards | v1.4 — Range library and filtering | 2026-06-05 |
| 16 | Sort saved ranges by recently practiced | v1.4 — Range library and filtering | 2026-06-05 |
| 17 | Sort saved ranges by accuracy | v1.4 — Range library and filtering | 2026-06-05 |
| 18 | Missing-hands review at the end of a practice session | v2 — Improved practice modes | 2026-06-05 |
| 19 | Range-comparison helper for "build from memory" practice (domain foundation) | v2 — Improved practice modes | 2026-06-06 |
| 20 | Build-from-memory practice component (mode 3 UI) | v2 — Improved practice modes | 2026-06-06 |

With slice 17 the **v1.4 — Range library and filtering** version is fully
implemented (name search; position/action/stack/game filters; name / recently
edited / recently practiced / accuracy sorts; duplicate, archive, and favorite;
and range cards summarizing name, scenario, percent, last-practiced, and
accuracy).

**v2 — Improved practice modes** is now underway. Slice 18 added practice mode 4
("Missing hands review"): ending a session opens a review step that recaps the
session stats and lists the mistakes — hands missed (in range, answered out) and
hands wrongly included (out of range, answered in) — before the final summary is
persisted on dismiss. Slice 19 began mode 3 ("Build from memory") with its pure
domain foundation: `compareBuiltRange(target, built)` normalizes both inputs and
splits them into `correct` / `missed` / `extra` lists in canonical order. Slice 20
added the standalone `BuildFromMemoryPractice` component: it shows a saved range's
name, lets the user rebuild it on a blank `HandGrid` from memory, and on "Check my
range" uses `compareBuiltRange` to report correct/missed/added-by-mistake hands
(with a "Try again" and "Back to library"). It is fully tested but not yet wired
into `App`. Still to come in v2: wiring mode 3 in behind a practice-mode picker,
mode 5 ("Timed drill"), and mode 6 ("Weakness-focused drill"). Mode 2 ("Pick the
correct action") stays deferred until the multi-action range model arrives in v2.3.
The next slice adds a practice-mode picker so the user can launch either the
existing recognition mode or build-from-memory.

## Next slice

- **Number:** 21
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Practice-mode picker wiring build-from-memory into App

### Prompt

You are implementing roadmap slice 21, continuing **v2 — Improved practice modes**.
Slice 20 delivered a standalone, fully tested `BuildFromMemoryPractice` component
(mode 3) that is not yet reachable by the user. This slice wires it into `App` behind
a small practice-mode picker so the user can launch EITHER the existing recognition
mode (mode 1, `PracticeSession`) OR build-from-memory (mode 3) for a saved range.

Scope of THIS slice: add a practice-mode picker step in `App` and route to the chosen
mode. Do NOT change the two practice components themselves, and do NOT add modes 5/6
(timed / weakness) — those are later slices. Keep the picker minimal.

Context (read these before starting):
- `src/App.tsx` — owns practice launch state. Today: `practicingRange: SavedRange |
  null` (set by `handlePractice(range)` from the library card's "Practice" button);
  when non-null it renders `<PracticeSession range={practicingRange}
  onExit={handleEndPractice} />`. `handleEndPractice(summary)` records the session
  into per-range stats (`recordPracticeSession` + `setPracticeStats(loadPracticeStats())`)
  and clears `practicingRange`. The header subtitle switches on `practicingRange`.
- `src/components/PracticeSession.tsx` — mode 1, `onExit: (summary:
  PracticeSessionSummary) => void`.
- `src/components/BuildFromMemoryPractice.tsx` — mode 3, `onExit: () => void` (no
  summary — build-from-memory is NOT folded into the recognition accuracy stats in
  this slice; keep it that way to avoid conflating two different metrics).
- `src/App.test.tsx` — established App-level RTL patterns (rendering `<App />`,
  seeding `localStorage` saved ranges, clicking "Practice", asserting on the practice
  view). Mirror these; reset storage between tests as that file already does.
- `src/components/PracticeSession.css` — reuse existing classes for the picker
  (`practice-session`, `practice-header`, `practice-answers`/`.primary`) so no new CSS
  file is needed.

Task — wire a mode picker into `App`:
- Add state `practiceMode: 'recognize' | 'build' | null` (null = mode not yet chosen).
- When the user starts practice (`handlePractice`), set `practicingRange` and leave
  `practiceMode` null so the picker shows first. (Keep the existing "Practice" button
  on library cards as the single entry point — do NOT add per-mode buttons to
  `RangeLibrary` in this slice.)
- Render logic when `practicingRange` is non-null:
  - `practiceMode === null` → a picker `<section className="practice-session"
    aria-label="Choose practice mode">` with a header naming the range, a short
    description of each mode, a "Recognize hands (in/out)" button (sets mode
    `'recognize'`), a "Build from memory" button (sets mode `'build'`), and a "Back to
    library" button that cancels (clears `practicingRange`).
  - `practiceMode === 'recognize'` → `<PracticeSession>` as today; its
    `onExit={handleEndPractice}` must still record stats AND also clear `practiceMode`.
  - `practiceMode === 'build'` → `<BuildFromMemoryPractice range={practicingRange}
    onExit={…} />` where the exit handler clears BOTH `practicingRange` and
    `practiceMode` (no stats recorded for build mode this slice).
- Make sure leaving any mode resets `practiceMode` to null so the next launch starts at
  the picker. Update the header subtitle to read sensibly for each state (picker /
  recognition / build) — keep copy short.

Tests to add/update (`src/App.test.tsx`):
- clicking "Practice" on a saved range shows the mode picker (both mode buttons + the
  range name), not a hand prompt yet;
- choosing "Recognize hands (in/out)" shows the recognition prompt (e.g. the "In range"
  / "Out of range" buttons) — keep/adapt any existing test that assumed practice went
  straight to recognition;
- choosing "Build from memory" shows the build-from-memory view (e.g. heading
  "Build from memory: <name>" and a "Check my range" button);
- "Back to library" from the picker returns to the editor/library (no practice view);
- after finishing/exiting a build-from-memory session, returning and clicking
  "Practice" shows the picker again (mode reset). Keep existing recognition-stats tests
  passing (recognition exit still records stats).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: the picker + routing in `App` and its tests only. Do NOT
  modify `PracticeSession` or `BuildFromMemoryPractice`, do NOT add new practice modes,
  and do NOT change `RangeLibrary`'s card actions.
- Do NOT record build-from-memory results into per-range practice stats in this slice
  (the stats model tracks recognition attempts; conflating shapes is out of scope).
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add practice-mode picker with build-from-memory option`
