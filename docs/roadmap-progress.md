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

## Next slice

- **Number:** 13
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Persist per-range practice stats (type + storage foundation)

### Prompt

You are implementing roadmap slice 13 of **v1.4 — Range library and filtering**. Slices 1–12
finished every v1.4 feature that needs no practice history: search, the four metadata
filters, name/recently-edited sorts, duplicate, archive (+ hide-by-default), and favorite
(+ favorites-only). The features still missing from v1.4 — the **"Recently practiced"** and
**"Accuracy"** sorts, and the **"Last practiced"** / **accuracy** fields on range cards —
are all blocked on one thing the app does not yet have: it never remembers anything about a
finished practice session. This slice adds that missing foundation — a persisted,
per-range practice-stats record — and nothing else. It follows the project's established
"data first, then behavior" rhythm (slice 9 added the archived flag before slice 10 used it;
slice 11 added the favorite flag before slice 12 used it). **No UI is wired this slice:**
recording at session end and displaying/sorting by these stats are later slices.

Context (read these before starting):
- Practice scoring is pure and already produces session aggregates.
  `src/domain/practice.ts` exposes `summarizePracticeAttempts(attempts)` returning a
  `PracticeSessionSummary` (`src/types/practice.ts`): `{ totalQuestions, correctAnswers,
  accuracyPercentage }`. `src/components/PracticeSession.tsx` holds these attempts in
  component state only — its doc comment explicitly notes "nothing is persisted in this
  slice." Do not change PracticeSession, App.tsx, or RangeLibrary this slice.
- `src/storage/rangeStorage.ts` is the storage pattern to mirror: a single versioned
  `localStorage` key (`export const STORAGE_KEY = 'poker-range-trainer.saved-ranges.v1'`),
  a private `writeSavedRanges` doing `localStorage.setItem(KEY, JSON.stringify(...))`, and a
  `loadSavedRanges()` that returns a safe default when the key is absent, the JSON is
  corrupt (wrapped `JSON.parse` in try/catch), or the parsed value is the wrong shape, and
  that **skips individual malformed entries** rather than discarding everything. Reuse this
  exact defensive style (try/catch parse, shape guards, per-entry validation, skip-not-throw
  on load).
- Its tests in `src/storage/rangeStorage.test.ts` run under jsdom with
  `beforeEach(() => localStorage.clear())` to isolate cases — copy that setup.

Task — add the practice-stats type and its storage layer (no UI):
- Type: in `src/types/practice.ts`, add and document an exported
  `interface RangePracticeStats { rangeId: string; totalAttempts: number; correctAttempts:
  number; lastPracticedAt: string }` (cumulative attempt counts across all sessions for that
  range, plus the ISO-8601 timestamp of the most recent session). Note in the doc comment
  that accuracy is derived later as `correctAttempts / totalAttempts` and that recording/
  display come in later slices.
- Storage: add a new file `src/storage/practiceStatsStorage.ts`, mirroring
  `rangeStorage.ts`:
  - `export const PRACTICE_STATS_STORAGE_KEY = 'poker-range-trainer.practice-stats.v1'`.
  - `export function loadPracticeStats(): Record<string, RangePracticeStats>` — returns a map
    keyed by `rangeId`. Empty object `{}` when the key is absent, the JSON is corrupt, or the
    parsed value is not a non-null, non-array object. Validate each entry's value
    independently (`rangeId` a non-empty string; `totalAttempts` and `correctAttempts` finite
    numbers `>= 0`; `lastPracticedAt` a string) and **skip** malformed ones; build the
    returned map keyed by each validated value's own `rangeId` so the map is always
    self-consistent.
  - `export function recordPracticeSession(rangeId: string, summary: Pick<
    PracticeSessionSummary, 'totalQuestions' | 'correctAnswers'>, timestamp: string =
    new Date().toISOString()): void` — folds one finished session into the stored record:
    when `summary.totalQuestions <= 0` it is a **no-op** (an unanswered session never creates
    or touches a record); otherwise it loads the map, adds `summary.totalQuestions` to
    `totalAttempts` and `summary.correctAnswers` to `correctAttempts` (starting from 0 for a
    range with no prior record), sets `lastPracticedAt` to `timestamp`, and writes the map
    back through a private `writePracticeStats` helper.
- Keep this module pure storage/side-effects only — no React, no DOM beyond `localStorage`,
  and no poker math. Exported functions are exercised by the new tests, so they are not dead
  code; do not wire them into any component yet.

Tests to add (`src/storage/practiceStatsStorage.test.ts`, with `beforeEach(() =>
localStorage.clear())`):
- `loadPracticeStats`: returns `{}` when nothing is stored; returns `{}` when the stored JSON
  is corrupt; returns `{}` when the stored value is not an object (e.g. an array or a
  string); skips malformed entries while keeping valid ones; round-trips a value written by
  `recordPracticeSession`.
- `recordPracticeSession`: creates a new record for a first session (counts and
  `lastPracticedAt` set from the summary + timestamp); folds a second session into the
  existing record cumulatively (counts add up, `lastPracticedAt` advances to the newer
  timestamp); records ranges independently (recording range B leaves range A untouched); is a
  no-op when `totalQuestions` is 0 (no record is created, and an existing record is left
  unchanged). Pass explicit `timestamp` strings for determinism.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the `RangePracticeStats` type and the
  `practiceStatsStorage.ts` read/record functions plus their tests. Do NOT touch
  `PracticeSession.tsx`, `App.tsx`, or `RangeLibrary.tsx`, and do NOT add the
  recently-practiced/accuracy sorts or the last-practiced/accuracy card fields yet — those
  are the next slices, now unblocked by this one.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: persist per-range practice stats`
