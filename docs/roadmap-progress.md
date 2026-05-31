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
| 62 | Record per-action accuracy at the end of an action quiz | v2.3 — Multi-action ranges | 2026-06-06 |
| 63 | Per-action accuracy table in the performance view (presentation) | v2.3 — Multi-action ranges | 2026-06-06 |
| 64 | Wire per-action accuracy from App into the performance view | v2.3 — Multi-action ranges | 2026-06-06 |
| 65 | Action-grouped notation export (format domain) | v2.3 — Multi-action ranges | 2026-06-06 |
| 66 | Action-grouped notation import (parse domain) | v2.3 — Multi-action ranges | 2026-06-06 |
| 67 | ActionNotation component (export display + import box) | v2.3 — Multi-action ranges | 2026-06-06 |
| 68 | Wire action notation into the action editor (v2.3 complete) | v2.3 — Multi-action ranges | 2026-06-06 |
| 69 | Export all saved data to a backup file (first v3 slice) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 70 | Import a backup file (validate + restore the local library) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 71 | Cloud config foundation (env-gated Supabase config) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 72 | Lazy env-gated Supabase client accessor | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 73 | Supabase auth wrapper module (sign up/in/out/session) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 74 | useAuthSession hook (exposes cloud auth state to React) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 75 | AuthPanel sign-in/sign-up/sign-out component | v3 — Accounts, cloud sync, and backend | 2026-06-08 |

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

Slice 62 connected the recording: `ActionQuiz` now collects an `ActionAttempt[]` (one per
answer) and its `onExit(attempts)` hands them back; `App.handleEndActionQuiz` records them via
`recordActionAccuracy(rangeId, summarizeActionAccuracy(attempts))` (separate from
`handleEndPractice`, since action attempts have a different shape). Ending with no answers
records nothing. Per-action accuracy is now captured every action-quiz session — but nothing
displays it yet.

Slice 63 surfaced per-action accuracy in the performance view: `actionAccuracyRate(stat)` in
`domain/actionRange.ts`, and `RangePerformance` now takes an optional `actionAccuracy?:
RangeActionAccuracy` prop (default `{}`) rendering a "Per-action accuracy" table (action label,
accuracy %, attempts) in `RANGE_ACTIONS` order when non-empty; the empty-state message also now
checks for action data. Tested via the component, but App does not pass the prop yet.

Slice 64 wired it into App: an `actionAccuracy` state (`loadActionAccuracy`, refreshed in
`handleEndActionQuiz` after recording) is passed as `actionAccuracy={actionAccuracy[id] ?? {}}`
to `RangePerformance`. Running an action quiz then opening "View stats" now shows the per-action
table. **Action-specific accuracy tracking is COMPLETE** (summarizer + storage + recording +
performance table + App wiring).

Slice 65 added the export side: `formatActionNotation(handActions)` in `domain/actionRange.ts`
emits one `"{label}: {hands}"` line per action that has hands, in canonical `RANGE_ACTIONS`
order, reusing `formatRangeNotation` per group ("" for an empty/actionless map).

Slice 66 added the import side: `parseActionNotation(input)` in `domain/actionRange.ts` parses
`"{label}: {notation}"` lines (case-insensitive label → `RangeAction`, hands via
`parseRangeNotation`) into a `handActions` map, round-tripping with `formatActionNotation`. It
throws on a colonless line, unknown label, invalid notation, or a hand in two different actions.

Slice 67 added the standalone `ActionNotation` component (mirrors `RangeNotation`, reusing its
CSS): a read-only "Current actions" field from `formatActionNotation`, plus an import textarea +
"Apply Action Notation" that runs `parseActionNotation` and reports the parsed map (or shows the
error in a `role="alert"`). Standalone-tested; not yet wired into App.

Slice 68 wired `ActionNotation` into App's action editor (below `MultiActionEditor`, fed by
`handActionsDraft` / `setHandActionsDraft`), so a user can paste action-grouped notation to build
a chart and read the current chart back out; "Save actions" persists an imported chart.

**v2.3 — Multi-action ranges is COMPLETE**: action vocabulary + helpers, the action palette,
multi-color grid, multi-action editor (wired + persisted), mode-2 "what's the correct action?"
practice (picker-wired), action-specific accuracy (summarizer + storage + recording + performance
table), and import/export notation with action groups (domain + UI + wiring).

**With v2.3 done, ALL of v2.x is COMPLETE** — v2 (improved practice modes), v2.1 (mistake
tracking and review), v2.2 (spaced repetition), and v2.3 (multi-action ranges). The next roadmap
target is **v3 — Accounts, cloud sync, and backend**, which is OUT OF SCOPE for finish-v2 and,
per `CLAUDE.md`, requires an explicit user request. The loop STOPS here; slice 69 is queued for
the user to decide on separately.

FINISH-V2 RUN COMPLETE: this run built slices 59–68 (10 slices), each validated
(lint + test:run + build all green), committed, and pushed. The scope boundary (v3) is reached —
the intended success exit.

NOTE ON CADENCE: the user re-invoked finish-v2 (the go-ahead after the slice-58 pause), so a
fresh run resumed at slice 59. Slice counting restarts for THIS run; the next safety pause is
after ~20 slices in this run (≈ slice 78) or when the queued slice crosses into v3, whichever
comes first. v2.3 is expected to finish well before then.

NOTE ON CADENCE: the user approved continuing past the first 20-slice checkpoint (after
slice 38). The loop resumed at slice 39 and continues through v2.2 → v2.3; the next safety
pause is after ~20 slices in this continuation (≈ slice 58) or when the queued slice
crosses into v3, whichever comes first.

**v3 — Accounts, cloud sync, and backend** is now underway (the user invoked `finish-roadmap`,
which is the explicit authorization `CLAUDE.md` requires for v3+ work). It starts local-first:
true accounts / backend / cloud sync are larger slices that need infrastructure decisions and
will pause for the user when reached.

Slice 69 added the export side of the backup feature: `src/storage/backup.ts` with `buildBackup
(exportedAt?)` — gathering every persisted slice (`loadSavedRanges`, `loadPracticeStats`,
`loadHandAccuracy`, `loadActionAccuracy`, `loadSessionHistory`, `loadReviewStates`) into one
versioned `Backup` object (`version: 1`, `exportedAt`, plus the six data maps) — and
`serializeBackup(backup)` (pretty JSON). An "Export backup" button in `App`'s editor controls
builds the JSON and triggers a Blob/object-URL download named by date. Local-only, no network.
Import is the next slice.

Slice 70 added the import counterpart in `src/storage/backup.ts`: `parseBackup(json)` (JSON-parses
and validates the payload — object shape, supported `version`, the `ranges` array and the five
data maps — throwing a clear `Error` otherwise) and `restoreBackup(backup)` (writes each slice
back under its existing storage key, REPLACING all local data). An "Import backup" file-input in
`App` reads the file via `file.text()`, runs parse + restore behind a `confirm()` (since import
wipes local data), reports parse errors via `alert()`, then refreshes the in-memory state. Round-
trip and malformed-input rejection are unit-tested. **The local-first backup import/export feature
is COMPLETE** — the safe, no-backend portion of v3.

**v3 backend decisions made (2026-06-08):** the user chose **Supabase** (managed Postgres + auth +
RLS) for the backend, **Supabase managed auth** (email/password + OAuth), and **explicit push/pull**
sync (no silent overwrites; anonymous/local mode must keep working). Build small Supabase slices,
each gated behind env-config presence so the local-only path stays fully functional and validatable
without a live project.

Slice 71 added the cloud config foundation: `src/cloud/cloudConfig.ts` with `getCloudConfig(env?)`
(returns `{ url, anonKey }` from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, trimmed, or `null`
when either is missing/blank) and `isCloudConfigured(env?)`. The env source is injectable for pure
unit tests; `import.meta.env` is the default. Added `src/vite-env.d.ts` typing the two vars. No
network, no dependency yet — the app stays 100% local when unconfigured.

Slice 72 added `src/cloud/supabaseClient.ts`: `getSupabaseClient(deps?)` lazily creates and
memoizes a single `SupabaseClient` from `getCloudConfig()`, returning `null` when cloud is
unconfigured. Created on first call (no import-time side effects). `deps` injects `config` and
`create` so tests cover the null path and creation/memoization without network or live creds.
`@supabase/supabase-js` is now a dependency, but it is not imported by the app entry yet, so the
bundle is unchanged and local users are unaffected. `resetSupabaseClient()` supports tests.

Slice 73 added `src/cloud/auth.ts`: a thin wrapper over Supabase managed auth — `signUp`,
`signIn`, `signOut`, `getCurrentSession`, `onAuthChange` — over `getSupabaseClient()` (injectable).
When cloud is unconfigured (client null) the operations fail gracefully: mutating ops throw
`CloudNotConfiguredError`, `getCurrentSession` returns null, `onAuthChange` is a no-op returning a
no-op unsubscribe. Fully unit-tested with a fake Supabase auth object (no network/creds). No UI yet.

Slice 74 added `src/cloud/useAuthSession.ts`: a React hook returning `{ session, user, loading,
isCloudConfigured }`. On mount (when configured) it seeds from `getCurrentSession()` and subscribes
via `onAuthChange`, unsubscribing on unmount; when unconfigured it stays signed-out/not-loading so
local users are unaffected. Deps are injectable; tested with `renderHook` (no network) for the
unconfigured path, seeding, auth-change updates, and unmount unsubscribe.

Slice 75 added the standalone `src/components/AuthPanel.tsx` (+ CSS): cloud-account UI built on
`auth.ts`. Unconfigured → a short "local-only mode" note (no form). Configured + signed out → email/
password fields with Sign in / Sign up (errors in a `role="alert"`, buttons disabled while busy).
Signed in → the user's email + Sign out. Session comes from a prop (parent owns it); the component
owns only local busy/error state. Auth fns are injectable; tested across all three states + error.
Not wired into App yet.

## Next slice

- **Number:** 76
- **Roadmap target:** v3 — Accounts, cloud sync, and backend
- **Working title:** Wire AuthPanel + useAuthSession into App

### Prompt

Wire the cloud account UI into `App`. Call `useAuthSession()` in `App` and render `<AuthPanel
isCloudConfigured={...} session={...} />` in the app header/controls area (a discreet spot — it
shows only a one-line note for local-only users, so it must not disrupt the existing layout).
Keep everything else unchanged: no sync yet, local data still flows through localStorage. The point
of this slice is only that a configured user can sign in/up/out from the running app; cloud data
read/write is a later slice.

Since `App` is heavily tested, ensure existing tests still pass (the AuthPanel renders its
local-only note by default because tests run with no Supabase env vars → `isCloudConfigured` is
false). If any App test asserts on exact header contents, update it minimally.

Validation: `npm run lint`, `npm run test:run`, `npm run build`.

Constraints:
- Cloud strictly optional; with no env vars the app behaves exactly as before (plus a one-line note).
- No real network in tests. Small and reversible.

Suggested commit message:
- `feat: wire cloud account sign-in into the app`
