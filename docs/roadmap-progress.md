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

## Next slice

- **Number:** 14
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Record finished practice sessions into per-range stats

### Prompt

You are implementing roadmap slice 14 of **v1.4 — Range library and filtering**. Slice 13
added the persisted, per-range practice-stats foundation but deliberately wired no UI: it
introduced `RangePracticeStats` (`src/types/practice.ts`) and
`src/storage/practiceStatsStorage.ts` with `loadPracticeStats()` and
`recordPracticeSession(rangeId, summary, timestamp?)`, and its prompt noted that "recording
at session end ... come in later slices." This slice is that behavior step: actually call
`recordPracticeSession` when a practice session ends, so finishing practice persists
cumulative attempts and accuracy for the range. It unblocks the remaining v1.4 features —
the **"Recently practiced"** and **"Accuracy"** sorts and the **"Last practiced"**/accuracy
card fields — which are still later slices. This follows the project's "data first, then
behavior" rhythm (slice 13 built the store; this slice writes to it). **No sort or
card-display work this slice** — only the recording side-effect at session end.

Context (read these before starting):
- `src/storage/practiceStatsStorage.ts` exposes `recordPracticeSession(rangeId, summary:
  Pick<PracticeSessionSummary, 'totalQuestions' | 'correctAnswers'>, timestamp?)`. It is
  already a **no-op when `summary.totalQuestions <= 0`**, so ending a session with nothing
  answered must record nothing — rely on that, don't re-guard it in the UI. It folds the
  session cumulatively into the stored record and is already covered by
  `practiceStatsStorage.test.ts`; do not change it.
- `src/components/PracticeSession.tsx` holds the live session: it accumulates `attempts` in
  state and already computes `const summary = summarizePracticeAttempts(attempts)` each
  render (a `PracticeSessionSummary` from `src/types/practice.ts`). Its `onExit: () => void`
  prop is fired by the "End Practice" button and is the session's only end trigger (practice
  is an endless stream of hands). Its doc comment currently says "nothing is persisted in
  this slice" — update that wording.
- `src/App.tsx` is the storage orchestrator: every persistence call (`saveSavedRange`,
  `deleteSavedRange`, favorite/archive toggles) lives in an App handler, not in a leaf
  component. It tracks `const [practicingRange, setPracticingRange] = useState<SavedRange |
  null>(null)`, renders `<PracticeSession range={practicingRange} onExit={handleEndPractice}
  />`, and `handleEndPractice()` currently just does `setPracticingRange(null)`. Keep
  `PracticeSession` persistence-free and record from App, consistent with that pattern.
- `src/App.test.tsx` clears `localStorage` in `beforeEach`, imports storage helpers from
  `./storage/...`, and its `describe('Practice mode', ...)` block saves a range named "Pairs"
  (AA, KK), clicks "Practice range Pairs", and ends practice. Saved-range ids are generated
  by App, so read the id back via `loadSavedRanges()[0].id`.

Task — record the session summary into stats when practice ends (record in App, keep the
component pure):
- In `src/components/PracticeSession.tsx`: change the `onExit` prop type to
  `onExit: (summary: PracticeSessionSummary) => void` (import the type from
  `../types/practice`), and have the "End Practice" button call `onExit(summary)` with the
  already-computed `summary`. Update the doc comment that claims nothing is persisted (note
  instead that the session summary is reported to the parent on exit, which persists it). Do
  not import storage into this component.
- In `src/App.tsx`: import `recordPracticeSession` from `./storage/practiceStatsStorage` and
  the `PracticeSessionSummary` type from `./types/practice`. Change `handleEndPractice` to
  accept the summary, call `recordPracticeSession(practicingRange.id, summary)` while
  `practicingRange` is still set (guard against a null `practicingRange`), then
  `setPracticingRange(null)`. No other behavior changes; the existing no-op-on-zero rule
  means ending without answering records nothing.

Tests to add/update:
- `src/components/PracticeSession.test.tsx`: update the existing "calls onExit when End
  Practice is clicked" test — `onExit` is now called with the session summary. Answer one
  in-range hand (`sequenceRandom([0])` → "AA", click "In range"), then "End Practice", and
  assert `onExit` was called once with
  `expect.objectContaining({ totalQuestions: 1, correctAnswers: 1 })`. Add a case that ending
  immediately (nothing answered) still calls `onExit` with `totalQuestions: 0`.
- `src/App.test.tsx` (`Practice mode` block): add a test that saves "Pairs", starts practice,
  answers one hand, clicks "End Practice", then asserts persistence via `loadPracticeStats()`
  (import it from `./storage/practiceStatsStorage`): the entry keyed by
  `loadSavedRanges()[0].id` has `totalAttempts: 1` (and `correctAttempts` matching the answer
  given). Add a second case: starting practice and ending without answering leaves
  `loadPracticeStats()` empty (`{}`), proving the zero-question no-op holds end to end.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only wire `recordPracticeSession` into the practice end-of-session
  flow (the `onExit` summary in `PracticeSession` + the `handleEndPractice` recording in
  `App`) and its tests. Do NOT add the recently-practiced/accuracy sorts or the
  last-practiced/accuracy card fields, and do NOT change `loadPracticeStats`,
  `recordPracticeSession`, or `RangePracticeStats` — those are done. Those display/sort slices
  come next, now unblocked.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: record practice sessions into per-range stats`
