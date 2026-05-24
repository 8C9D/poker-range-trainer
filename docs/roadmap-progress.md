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
| 21 | Practice-mode picker wiring build-from-memory into App | v2 — Improved practice modes | 2026-06-06 |
| 22 | Timed-drill domain foundation (countdown math + durations) | v2 — Improved practice modes | 2026-06-06 |
| 23 | Timed-drill practice component (mode 5 UI) | v2 — Improved practice modes | 2026-06-06 |
| 24 | Wire the timed drill into the practice-mode picker | v2 — Improved practice modes | 2026-06-06 |
| 25 | Weakness-focused draw domain foundation (mode 6) | v2 — Improved practice modes | 2026-06-06 |
| 26 | Weakness-focused drill practice component (mode 6 UI) | v2 — Improved practice modes | 2026-06-06 |
| 27 | Wire the weakness drill into the practice-mode picker | v2 — Improved practice modes | 2026-06-06 |
| 28 | Per-hand accuracy aggregation (v2.1 domain foundation) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 29 | Per-hand accuracy storage foundation (persist + record) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 30 | Record per-hand accuracy at end of session (wiring) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 31 | Per-hand accuracy presentation helpers (rate + ranking) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 32 | Range performance view component (weakest-hands table) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 33 | Open the performance view from a library card (wiring) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 34 | Accuracy heat-level helper (heatmap foundation) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 35 | Range accuracy heatmap (component + performance-view integration) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 36 | Mistake-pool and restricted-draw helpers (mistakes-only foundation) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 37 | PracticeSession optional hand pool (restrict prompts to a subset) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 38 | "Practice mistakes" entry from the performance view (mistakes-only mode) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 39 | Session history storage foundation (append + load) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 40 | Record finished sessions into the history log (wiring) | v2.1 — Mistake tracking and review | 2026-06-06 |
| 41 | Session history timeline in the performance view | v2.1 — Mistake tracking and review | 2026-06-06 |
| 42 | Spaced-repetition scheduling foundation (review state + scheduler) | v2.2 — Spaced repetition system | 2026-06-06 |
| 43 | Review-state storage foundation (load + upsert) | v2.2 — Spaced repetition system | 2026-06-06 |
| 44 | Advance review state at end of session (wiring) | v2.2 — Spaced repetition system | 2026-06-06 |
| 45 | Due-ranges selector (which ranges are due for review) | v2.2 — Spaced repetition system | 2026-06-06 |
| 46 | Due-today review queue component | v2.2 — Spaced repetition system | 2026-06-06 |
| 47 | Wire the due-today review queue into App | v2.2 — Spaced repetition system | 2026-06-06 |
| 48 | Review-streak helper (consecutive review days) | v2.2 — Spaced repetition system | 2026-06-06 |
| 49 | Show the review streak on the due-today queue | v2.2 — Spaced repetition system | 2026-06-06 |
| 50 | Action model foundation (RangeAction vocab + handsForAction) | v2.3 — Multi-action ranges | 2026-06-06 |
| 51 | Per-action range percentage helper | v2.3 — Multi-action ranges | 2026-06-06 |
| 52 | Action palette component (select the active action) | v2.3 — Multi-action ranges | 2026-06-06 |
| 53 | Multi-color action grid component (assign actions to hands) | v2.3 — Multi-action ranges | 2026-06-06 |
| 54 | Multi-action editor component (palette + grid + per-action %) | v2.3 — Multi-action ranges | 2026-06-06 |
| 55 | Persist optional per-hand actions on a saved range | v2.3 — Multi-action ranges | 2026-06-06 |
| 56 | Wire the multi-action editor into a per-range "Actions" view | v2.3 — Multi-action ranges | 2026-06-06 |
| 57 | Mode-2 practice foundation (prompt pool + correct-action lookup) | v2.3 — Multi-action ranges | 2026-06-06 |
| 58 | Action-quiz practice component (mode 2) | v2.3 — Multi-action ranges | 2026-06-06 |
| 59 | Wire the action quiz into the practice-mode picker (mode 2) | v2.3 — Multi-action ranges | 2026-06-06 |
| 60 | Per-action accuracy summarization (v2.3 domain foundation) | v2.3 — Multi-action ranges | 2026-06-06 |
| 61 | Action-accuracy storage foundation (persist + record) | v2.3 — Multi-action ranges | 2026-06-06 |

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
(with a "Try again" and "Back to library"). Slice 21 wired mode 3 into `App` behind
a practice-mode picker: clicking "Practice" on a library card now shows a picker that
launches either the existing recognition mode (mode 1) or build-from-memory (mode 3),
with the mode reset on every exit. With that, **mode 3 is fully delivered**
(comparison helper + component + picker wiring). Recognition still records per-range
stats; build-from-memory deliberately does not (different metric shape).

Mode 5 ("Timed drill") is now underway. Slice 22 added its pure domain foundation,
`src/domain/timedDrill.ts`: `DRILL_DURATION_OPTIONS` ([30, 60, 120]s),
`DEFAULT_DRILL_SECONDS` (60), and `getRemainingSeconds` / `isDrillOver` countdown math
that takes the current time as a parameter (clamped, ceil-rounded, clock-skew safe).
Slice 23 added the standalone `TimedDrillSession` component: a config → running →
done flow that reuses recognition scoring (`createPracticeAttempt`,
`summarizePracticeAttempts`) and drives the countdown off `getRemainingSeconds` plus a
250ms interval (clock read only inside the interval to keep render pure; interval
cleaned up on expiry/unmount). It reports a `PracticeSessionSummary` via `onExit`. It
is fully tested (with Vitest fake timers + `fireEvent`, since userEvent deadlocks
against fake timers) but not yet wired into `App`.

Slice 24 wired the timed drill into the practice-mode picker as a third mode
("Timed drill"), routing its `onExit` summary through `handleEndPractice` so timed
sessions record into the same per-range recognition stats. With that, **mode 5 is fully
delivered** (countdown helpers + component + picker wiring). The picker now offers
recognition, build-from-memory, and timed drill.

Mode 6 ("Weakness-focused drill") is now underway. Slice 25 added its pure domain
foundation, `src/domain/weaknessDrill.ts`: `WEAKNESS_MISTAKE_WEIGHT` (3),
`buildWeaknessPool(attempts)` (each hand once plus extra copies per incorrect attempt),
and `getWeaknessFocusedHand(attempts, random)` (a pool-weighted draw that is uniform
with no mistakes and biases toward missed hands otherwise). This is an *in-session*
weakness signal from the current session's attempts; cross-session per-hand accuracy
tracking is the separate v2.1 work.

Slice 26 added the standalone `WeaknessFocusedDrill` component, and slice 27 wired it
into the picker as a fourth mode ("Weakness drill"), routing its `onExit` through
`handleEndPractice` so it records into per-range stats.

**v2 — Improved practice modes is now COMPLETE.** The practice-mode picker offers
recognition (mode 1), build-from-memory (mode 3), timed drill (mode 5), and weakness
drill (mode 6); mode 4 (missing-hands review) lives on the recognition session. Mode 2
("Pick the correct action") remains intentionally deferred to **v2.3**'s multi-action
range model (per the roadmap and finish-v2 scope).

**v2.1 — Mistake tracking and review** is now underway. Slice 28 added the pure domain
foundation: the `HandAccuracyStat` type (`hand`, `attempts`, `correct`,
`falsePositives`, `falseNegatives`) and `summarizeHandAccuracy(attempts)` in
`src/domain/practice.ts`, which tallies a session's attempts per hand in canonical order
(every incorrect attempt is exactly one of FP/FN, so `falsePositives + falseNegatives ===
attempts - correct`).

Slice 29 added the persistence: `src/storage/handAccuracyStorage.ts`
(`loadHandAccuracy`, `recordHandAccuracy`) plus the `RangeHandAccuracy` type alias,
mirroring `practiceStatsStorage` (single versioned key, defensive validation, fold-a-
session recording). It is tested directly but not yet called from the app.

Slice 30 wired the recording in: the recognition-style components (recognize/timed/
weakness) now report their raw session `attempts` via `onExit`, and `App.handleEndPractice`
derives and persists BOTH the per-range summary (`recordPracticeSession`) and the per-hand
accuracy (`recordHandAccuracy(summarizeHandAccuracy(attempts))`). Build-from-memory and the
picker cancel are unchanged. Per-hand mistake data is now captured every session.

Slice 31 added the pure presentation helpers in `src/domain/practice.ts`:
`handAccuracyRate(stat)` (correct/attempts %, 0 when none) and
`rankHandAccuracy(rangeStats)` (weakest-first: ascending accuracy, then more attempts,
then canonical order).

Slice 32 added the standalone `RangePerformance` component: a weakest-first per-hand table
(hand, accuracy %, attempts, missed, wrongly-included) from `rankHandAccuracy`, with an
empty state. It is fully tested but not yet reachable.

Slice 33 wired it in: each library card has a "Stats" action (`View stats for {name}`)
that opens `RangePerformance` for that range; `App` keeps a `handAccuracy` state
(`loadHandAccuracy`, refreshed after each session) and renders the view with that range's
per-hand map. The per-hand performance page is now reachable and live.

Slice 34 added the pure `accuracyHeatLevel(stat)` helper (+ `HeatLevel` type) in
`src/domain/practice.ts`: untested when no attempts, else low (<50%) / medium (50–79%) /
high (80%+).

Slice 35 added the read-only `HandHeatmap` 13×13 grid (cells colored by
`accuracyHeatLevel`, with `data-heat` for tests) and surfaced it in `RangePerformance`
above the table when there is data.

Slice 36 added the mistakes-only domain foundation in `src/domain/practice.ts`:
`handsWithMistakes(rangeStats)` (hands with any recorded error, canonical order) and
`getRandomHandFrom(pool, random)` (draw a prompt from a restricted, non-empty pool).

Slice 37 added the optional `handPool` prop to `PracticeSession`: when provided (non-empty)
recognition draws prompts only from that subset via `getRandomHandFrom`; default behavior
(full 169-hand draw) is unchanged.

Slice 38 wired the "Practice mistakes" button into the performance view: when a range has
recorded mistakes, the button launches a recognition session restricted to
`handsWithMistakes` (via `App`'s `practiceHandPool` state and `PracticeSession`'s
`handPool` prop), skipping the mode picker. **The "practice mistakes only" mode is now
complete.**

Slice 41 surfaced the session-history log in `RangePerformance` as a newest-first
"Session history" table (date, score, accuracy), fed by an `App` `sessionHistory` state
(refreshed after each session).

**v2.1 — Mistake tracking and review is now COMPLETE**: per-hand accuracy tracking with
false-positive/false-negative counts, the range-specific performance page, the heatmap
overlay, mistake review (mode 4 + performance view), "practice mistakes only", and session
history are all delivered.

**v2.2 — Spaced repetition system** is now underway. Slice 42 added the pure scheduling
foundation: the `RangeReviewState` type and `src/domain/spacedRepetition.ts`
(`seedReviewState`, `scheduleNextReview` — low resets to 1 day + lowers ease, medium holds,
high grows interval by ease — and `isReviewDue`; all timestamps injected). Slice 43 added the persistence: `src/storage/reviewStateStorage.ts` (`loadReviewStates`,
`saveReviewState` upsert), mirroring `practiceStatsStorage`.

Slice 44 wired the update: `App.handleEndPractice` now advances the practiced range's review
state (`loadReviewStates` → `scheduleNextReview(prev ?? seed, summary.accuracyPercentage,
reviewedAt)` → `saveReviewState`) alongside the other recorders. Schedules now advance every
session.

Slice 45 added the pure `selectDueRanges(ranges, reviewStates, now)` selector (never-reviewed
ranges count as due; preserves order).

Slice 46 added the standalone `DueToday` component (lists due ranges with a Practice action;
all-caught-up empty state), fully tested but not yet reachable.

Slice 47 wired the due-today queue into `App`: a "Review due ranges" button opens a
`dueToday` view (`selectDueRanges` over non-archived ranges + `loadReviewStates`, computed
in the handler), and practicing a due range launches the picker. The daily review queue is
live.

Slice 48 added the pure `currentStreak(reviewTimestamps, today)` helper (consecutive UTC
review days ending today, with a one-day grace).

Slice 49 surfaced the streak on the `DueToday` queue (`App` computes `currentStreak` from
all session timestamps in the open handler and passes it down).

**v2.2 — Spaced repetition system is now COMPLETE**: review state + scheduler, persistence,
session-end schedule updates, the due-today queue, and streak tracking. (Review-completion
history is covered by v2.1's per-range session history.)

The roadmap now moves to **v2.3 — Multi-action ranges** — the LAST in-scope version for
finish-v2. v2.3 reshapes the core range model so each hand can carry an action
(fold/call/raise/3-bet/4-bet/jam/mixed): a multi-color grid, an action palette, per-action
percentages, mode-2 "what's the correct action?" practice, action-specific accuracy, and
notation with action groups. Per the finish-v2 skill this is where small-slice discipline
matters most — build it as many tiny commits, starting with the pure action model.

Slice 50 added the action vocabulary: `RangeAction` (`fold`/`call`/`raise`/`threeBet`/
`fourBet`/`jam`/`mixed`) with `RANGE_ACTIONS` + `RANGE_ACTION_LABELS` in `types/range.ts`
(distinct from the scenario-metadata `ActionType`), and `src/domain/actionRange.ts`'s
`handsForAction(handActions, action)` selector. `SavedRange` is unchanged so far. Slice 51 added `actionRangePercentage(handActions, action)` (reusing `calculateRangePercentage`
over `handsForAction`).

Slice 52 added the standalone `ActionPalette` component (colored swatches, one per action,
with `aria-pressed` selection) and `ActionPalette.css` defining the shared `action-{action}`
color classes (reused by the grid next).

Slice 53 added the standalone controlled `ActionGrid` (13×13 cells colored by assigned
action via the shared `action-{action}` classes, `data-action` for tests, click → `onAssign`).

Slice 54 added the controlled `MultiActionEditor` (palette + grid + per-action % summary;
parent owns `handActions`, active action is internal). All v2.3 building blocks are now
standalone-tested.

Slice 55 extended the persisted model: `SavedRange.handActions?` (optional) plus
`rangeStorage` sanitization (`normalizeHandActions`) that round-trips valid maps and drops
malformed entries; hands-only ranges are unaffected.

Slice 56 wired it in: each library card has an "Actions" button (`Edit actions for {name}`)
opening a per-range action editor (`App` holds `actionEditRange` + `handActionsDraft`, "Save
actions" persists `handActions` via `saveSavedRange`). Assigning + saving + reopening
round-trips.

Slice 57 added the mode-2 foundation: `assignedHands(handActions)` (the prompt pool) and
`correctActionFor(handActions, hand)` (assigned action, else fold).

Slice 58 added the standalone mode-2 `ActionQuiz` component (prompt from `assignedHands`,
colored action answer buttons, scored via `correctActionFor`, running stats + feedback;
no-actions empty state). Fully tested but not yet wired into the picker.

Slice 59 wired the mode-2 quiz into the practice-mode picker: a "Pick the correct action"
button appears in the picker ONLY when the practiced range has an action chart
(`practicingRange.handActions && assignedHands(...).length > 0`), and choosing it routes to
`<ActionQuiz range={practicingRange} onExit={exitPractice} />` (no stats recorded yet —
action-specific accuracy is a later slice). `practiceMode` gained an `'action'` member, a
header subtitle, and a one-line note in the picker description.

Slice 60 began action-specific accuracy with its pure domain foundation: the `ActionAttempt`
type (`hand`/`chosen`/`expected`/`correct`) in `types/practice.ts`, and
`summarizeActionAccuracy(attempts)` + the `ActionAccuracyStat` type in `domain/actionRange.ts`,
which tallies a session's attempts per *expected* action and returns them in canonical
`RANGE_ACTIONS` order (mirrors `summarizeHandAccuracy`).

Slice 61 added the persistence: `src/storage/actionAccuracyStorage.ts` (`loadActionAccuracy`,
`recordActionAccuracy`) plus the `RangeActionAccuracy` alias (kept in `domain/actionRange.ts`
next to `ActionAccuracyStat`, declared `Partial<Record<RangeAction, ActionAccuracyStat>>` since
`RangeAction` is a closed union — unlike `RangeHandAccuracy`, whose `PokerHand` key is `string`).
Mirrors `handAccuracyStorage` (single versioned key, defensive validation incl. an
unknown-action check, fold-a-session recording). Tested directly but not yet called from the app.

v2.3 status: action vocab + helpers, palette, grid, editor (wired + persisted), the mode-2 quiz
component + picker wiring, the per-action accuracy summarizer, AND its storage are done.
Remaining: make `ActionQuiz` report attempts so App records per-action accuracy, surface it, and
notation with action groups.

NOTE ON CADENCE: the user re-invoked finish-v2 (the go-ahead after the slice-58 pause), so a
fresh run resumed at slice 59. Slice counting restarts for THIS run; the next safety pause is
after ~20 slices in this run (≈ slice 78) or when the queued slice crosses into v3, whichever
comes first. v2.3 is expected to finish well before then.

NOTE ON CADENCE: the user approved continuing past the first 20-slice checkpoint (after
slice 38). The loop resumed at slice 39 and continues through v2.2 → v2.3; the next safety
pause is after ~20 slices in this continuation (≈ slice 58) or when the queued slice
crosses into v3, whichever comes first.

## Next slice

- **Number:** 62
- **Roadmap target:** v2.3 — Multi-action ranges
- **Working title:** Record per-action accuracy at the end of an action quiz (ActionQuiz reporting + App wiring)

### Prompt

You are implementing roadmap slice 62, continuing **v2.3 — Multi-action ranges**.
`summarizeActionAccuracy` (slice 60) + `recordActionAccuracy` (slice 61) exist. This slice
connects them: `ActionQuiz` collects its answered attempts and reports them on exit, and `App`
records the per-action accuracy for the practiced range. Mirrors how slice 30 made the
recognition components report `attempts` and `App.handleEndPractice` record them.

Scope of THIS slice: `ActionQuiz` onExit signature + attempt collection, an `App` handler +
route, and tests. No new domain/storage code (slices 60–61 already provide it). Surfacing the
numbers in the UI is a LATER slice.

Context (read these before starting):
- `src/components/ActionQuiz.tsx` — currently `onExit: () => void`, called by both the
  empty-pool "Back to library" button and the running "End quiz" button. Its `answer(chosen)`
  already computes `expected`/`isCorrect`. Collect an `ActionAttempt[]` (push `{ hand:
  currentHand, chosen, expected, correct }` on each answer) and change `onExit` to
  `(attempts: ActionAttempt[]) => void`; both exit buttons call `onExit(attempts)` (the empty
  pool passes `[]`). Keep `random` injectable.
- `src/types/practice.ts` — `ActionAttempt`.
- `src/domain/actionRange.ts` — `summarizeActionAccuracy`.
- `src/storage/actionAccuracyStorage.ts` — `recordActionAccuracy`.
- `src/App.tsx` — currently routes `<ActionQuiz range={practicingRange} onExit={exitPractice} />`
  (slice 59). Add a handler `handleEndActionQuiz(attempts: ActionAttempt[])` that, when
  `practicingRange` is set, calls `recordActionAccuracy(practicingRange.id,
  summarizeActionAccuracy(attempts))` then `exitPractice()`. Route it as the quiz's `onExit`.
  Do NOT route through `handleEndPractice` — that takes `PracticeAttempt[]` and records
  recognition stats; action attempts are a different shape.
- `src/components/ActionQuiz.test.tsx` — update its `onExit` assertions for the new signature.
- `src/App.test.tsx` — extend the action-quiz integration test added in slice 59.

Task:
- Make `ActionQuiz` collect attempts and call `onExit(attempts)`.
- Add `handleEndActionQuiz` to `App` and route the quiz through it.

Tests:
- `ActionQuiz.test.tsx`: answering one hand then ending calls `onExit` with a one-element
  attempt array carrying chosen/expected/correct; the empty-pool exit calls `onExit([])`.
- `App.test.tsx`: after assigning an action and running the quiz (answer one hand, end), the
  range's per-action accuracy is persisted (`loadActionAccuracy()[rangeId]` has the expected
  action with `attempts: 1`). Keep existing tests green.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Component signature + App wiring + tests only; reuse the slice 60/61 domain + storage.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: record per-action accuracy at the end of an action quiz`
