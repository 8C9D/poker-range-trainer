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
| 76 | Wire cloud account sign-in into the app | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 77 | Cloud ranges repository + schema (push/pull) | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 78 | Wire explicit push/pull range sync into the app | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 79 | Full-library cloud sync via the backup shape | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 80 | Delete cloud data control | v3 — Accounts, cloud sync, and backend | 2026-06-08 |
| 81 | Responsive layout pass for small screens | v3.1 — Mobile-first and PWA support | 2026-06-08 |
| 82 | Web app manifest + theme color (installable PWA) | v3.1 — Mobile-first and PWA support | 2026-06-08 |
| 83 | Service worker for offline app-shell caching | v3.1 — Mobile-first and PWA support | 2026-06-08 |
| 84 | Swipe gestures for practice answers | v3.1 — Mobile-first and PWA support | 2026-06-08 |
| 85 | Code-split Supabase out of the initial bundle | v3.1 — Mobile-first and PWA support | 2026-06-08 |
| 86 | Export a single range to a JSON file | v3.2 — Import/export ecosystem | 2026-06-08 |
| 87 | Import a single range from a JSON file | v3.2 — Import/export ecosystem | 2026-06-08 |
| 88 | Export a range as a CSV summary | v3.2 — Import/export ecosystem | 2026-06-08 |
| 89 | Export a range as an SVG image | v3.2 — Import/export ecosystem | 2026-06-08 |
| 90 | Shareable range links (client-side URL-encoded range) | v3.2 — Import/export ecosystem | 2026-06-08 |
| 91 | Range packs (export/import a bundle of ranges) | v3.2 — Import/export ecosystem | 2026-06-08 |
| 92 | Shared-ranges backend (publish/fetch/unpublish repo + migration) | v3.2 — Import/export ecosystem | 2026-06-08 |
| 93 | Read-only shared range page + `#/r/:id` hash route | v3.2 — Import/export ecosystem | 2026-06-08 |
| 94 | Publish a range as a shareable cloud link (library UI) | v3.2 — Import/export ecosystem | 2026-06-08 |
| 95 | Unpublish a shared range link (library UI) | v3.2 — Import/export ecosystem | 2026-06-08 |
| 96 | Card model + flop texture tagging (pure domain) | v4 — Advanced poker training | 2026-06-08 |
| 97 | Flop texture display component | v4 — Advanced poker training | 2026-06-08 |
| 98 | Made-hand / draw categorization (pure domain) | v4 — Advanced poker training | 2026-06-08 |
| 99 | Combo expansion + range-vs-board bucketing (pure domain) | v4 — Advanced poker training | 2026-06-08 |
| 100 | Range-vs-board breakdown component | v4 — Advanced poker training | 2026-06-08 |
| 101 | Open a range-vs-board view from the library | v4 — Advanced poker training | 2026-06-08 |
| 102 | Postflop scenario model + decision vocab (pure domain) | v4 — Advanced poker training | 2026-06-08 |
| 103 | Postflop decision heuristic (pure domain) | v4 — Advanced poker training | 2026-06-08 |
| 104 | Postflop decision practice component (self-graded) | v4 — Advanced poker training | 2026-06-08 |
| 105 | Postflop drill launcher wired into App | v4 — Advanced poker training | 2026-06-08 |
| 106 | Combo enumeration + dead-card removal (pure domain) | v4.1 — Combo-level precision | 2026-06-08 |
| 107 | Blocker-aware combo counts (pure domain) | v4.1 — Combo-level precision | 2026-06-08 |
| 108 | Show blocker-aware combo counts vs a board | v4.1 — Combo-level precision | 2026-06-08 |
| 109 | Specific-combo selection model (pure domain) | v4.1 — Combo-level precision | 2026-06-08 |
| 110 | Persist combo-level selections on a saved range (storage) | v4.1 — Combo-level precision | 2026-06-08 |
| 111 | Combo-selection grid component (per-hand-class combo toggles) | v4.1 — Combo-level precision | 2026-06-08 |
| 112 | Blocker-aware practice prompt selection (pure domain) | v4.1 — Combo-level precision | 2026-06-08 |
| 113 | Blocker-aware combo practice component (self-graded combo drill) | v4.1 — Combo-level precision | 2026-06-08 |

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

Slice 76 wired the cloud account UI into `App`: `useAuthSession()` drives `<AuthPanel>` in the app
header. With no Supabase env vars the panel shows only the one-line local-only note, so existing App
tests pass unchanged. The bundle grew (~452 kB) since `@supabase/supabase-js` is now imported via
the hook — a later optimization slice could lazy-load it, but functionality is correct and local
behavior is unchanged. A configured user can now sign in/up/out from the running app; cloud data
read/write is next.

Slice 77 began explicit push/pull sync for saved ranges. `supabase/migrations/0001_ranges.sql`
documents the `ranges` table (`id text pk`, `user_id uuid → auth.users`, `data jsonb`, `updated_at`)
with RLS policies restricting each user to their own rows (not run by app/tests). `src/cloud/
rangesRepo.ts` adds `pushRanges(ranges, deps?)` (upserts `{id,user_id,data,updated_at}` rows) and
`pullRanges(deps?)` (selects the user's rows, returns each `data` as a `SavedRange`). Client +
`resolveUserId` are injectable; unconfigured → `CloudNotConfiguredError`, signed-out →
`NotSignedInError`. Fully unit-tested with a fake query builder (no network). Not wired into App.

Slice 78 wired explicit range sync into `App`: a "Push to cloud" / "Pull from cloud" block in the
header that renders ONLY when signed in (`auth.session`). Push calls `pushRanges(savedRanges)`; pull
calls `pullRanges()`, then `replaceSavedRanges` (a new `rangeStorage` fn that replaces the whole
local library, normalizing each range and discarding ones not pulled) behind a `confirm()`, and
refreshes `savedRanges`. A `syncStatus` line reports progress/errors. Signed-out/local users see
nothing new. `replaceSavedRanges` is unit-tested. **Ranges cloud sync (push + pull) is now usable
end-to-end for a configured, signed-in user.**

Slice 79 extended cloud sync to the WHOLE library via the backup shape. `supabase/migrations/
0002_backups.sql` documents a `backups` table (one `data jsonb` row per `user_id`, owner-only RLS).
`src/cloud/backupRepo.ts` adds `pushBackup(backup, deps?)` (upsert the single row) and
`pullBackup(deps?): Promise<Backup | null>` (`.maybeSingle()`), injectable + same error handling as
`rangesRepo`, fully unit-tested with a fake client. `App`'s push now sends `buildBackup()` via
`pushBackup`; pull does `pullBackup()` → `restoreBackup()` behind the confirm, then refreshes ALL
in-memory state. This SUPERSEDES the ranges-only sync — `rangesRepo` and `replaceSavedRanges` are
now unused by `App` but kept (tested modules, may power finer-grained sync later). **Full-library
cloud sync works end-to-end for a signed-in user.**

Slice 80 added the data-deletion half of v3's "delete account / data export" flow (export already
exists via the backup file). `deleteBackup(deps?)` in `backupRepo.ts` deletes the signed-in user's
`backups` row (`.delete().eq('user_id', userId)`), same injectable deps + unconfigured/signed-out
errors, unit-tested with a fake client. A "Delete cloud data" button in `App`'s signed-in cloud-sync
block runs it behind a `confirm()` (local data kept), updating `syncStatus`. NOTE: deleting the
Supabase auth *account* itself needs admin/edge-function privileges and is out of scope for a
client-only slice; deleting the user's stored data is the safe, in-scope piece.

**v3 — Accounts, cloud sync, and backend is now substantially COMPLETE** (the client-buildable
parts): Supabase config/client gating, managed auth (sign up/in/out + session hook + AuthPanel,
wired into App), full-library cloud sync (push/pull behind confirm), cloud-data deletion, local
backup import/export, and SQL schema/RLS migrations. Anonymous local mode keeps working throughout
(everything is gated on cloud being configured + signed in). The roadmap's "Backend features" list
(server-side rate limiting, dedicated REST APIs, an admin-level account-delete edge function, CI
backend tests) is handled by Supabase's managed platform + RLS rather than a hand-written server,
which is the deliberate consequence of the Supabase decision.

Slice 81 began **v3.1** with a CSS-only responsive pass. The 13×13 grid was already fluid (1fr
columns + `aspect-ratio`, clamped font), so the work was a `@media (max-width: 480px)` block in
`App.css`: tighter app padding, smaller `h1`, ≥44px tap targets for the main control buttons
(`.range-editor button`, `.import-backup`, `.cloud-sync button`), and wrapping for the editor/auth/
cloud-sync control rows. No DOM/logic changes, so all tests pass; desktop layout intact.

Slice 82 made the app installable. Added `public/manifest.webmanifest` (name/short_name, standalone
display, dark `background_color`/`theme_color` `#1a1626`, a maskable SVG icon) and a poker-spade
`public/app-icon.svg`. `index.html` now links the manifest + `theme-color` meta + iOS
`apple-mobile-web-app-*` metas + apple-touch-icon, and the title is now "Poker Range Trainer". The
build copies the manifest and icon into `dist/`. Dependency-free; no service worker yet.

Slice 83 added offline support via a hand-written `public/service-worker.js` (no Vite plugin):
pre-caches the static shell on install, runtime network-first-then-cache for same-origin GETs
(covers Vite's hashed asset URLs), cleans old caches on activate, and ignores cross-origin requests
so Supabase calls always hit the network. `src/main.tsx` registers it behind
`import.meta.env.PROD && 'serviceWorker' in navigator` on `window.load`, so dev and tests are
unaffected. Build copies it to `dist/`. **With install (slice 82) + offline (slice 83), the core
PWA pieces of v3.1 are in place.**

Slice 84 added mobile swipe answers to the recognition `PracticeSession`. New reusable
`src/components/useSwipe.ts` hook (pointer events; fires `onSwipeLeft`/`onSwipeRight` past a 50px
horizontal threshold with limited vertical drift) is attached to the prompt area: swipe right = in
range, swipe left = out of range, mirroring the buttons (which remain the primary control). A hint
line shows while unanswered. The hook's threshold logic is unit-tested; the button flow is unchanged.

Slice 85 code-split Supabase out of the initial bundle. `getSupabaseClient` is now async and loads
the library via dynamic `import('@supabase/supabase-js')` (still memoized, still null when
unconfigured). The `await` propagated through `auth.ts` (a `resolveClient` helper; `onAuthChange` is
now async too), `rangesRepo`, `backupRepo`, and `useAuthSession` (handles a sync-or-async
`subscribe` return). Behavior is identical for local/cloud users; tests updated to await. Result:
main chunk 454 → 255 kB, with Supabase a separate ~200 kB chunk loaded only on a cloud op.

**v3.1 — Mobile-first and PWA support is now substantially COMPLETE**: responsive layout + large tap
targets, installable manifest, offline service worker, swipe answers, and the mobile bundle perf
win. (Remaining roadmap bullets like deeper offline-sync reconciliation build on the existing
explicit push/pull.)

Slice 86 began **v3.2** with single-range JSON export. `src/domain/rangeTransfer.ts` adds the
versioned envelope `{ kind: 'poker-range', version: 1, range }` via `buildRangeExport` /
`serializeRangeExport` (pretty JSON), unit-tested. `RangeLibrary` cards gained an "Export JSON"
button (`onExportRange(range)`, optional prop defaulting to no-op so existing renders are
unaffected; one focused test added). `App` extracted a shared `downloadTextFile(name, text)` helper
(backup export now reuses it) and `handleExportRange` downloads the range as `{sanitized-name}.json`.

Slice 87 added single-range JSON import. `parseRangeExport(json)` in `rangeTransfer.ts` JSON-parses
and validates the envelope (`kind`, `version`, a `range` with string `id`/`name` + `hands` array),
returning the inner `SavedRange` or throwing a clear `Error`; round-trip + rejection paths are
unit-tested. An "Import range" file input in `App` reads the file, parses it, and adds it as a NEW
range with a fresh `createRangeId()` + timestamps (never clobbering an existing range), then
refreshes `savedRanges`; parse errors go to `alert`. **Single-range JSON interchange (export +
import) is complete.**

Slice 88 added CSV export. `formatRangeCsv(range)` in `rangeTransfer.ts` emits a summary block
(name, hand count, combos, percentage — reusing `countSelectedCombos`/`calculateRangePercentage`),
a blank line, then a `hand` column listing each hand; values are CSV-escaped. Unit-tested. A new
"Export CSV" card action (`onExportRangeCsv`, optional like `onExportRange`) is wired in `App`;
`downloadTextFile` now takes an optional mime type (default JSON) so CSV downloads as `text/csv`.

> ⚠️ **finish-roadmap 20-slice safety checkpoint.** This run (slices 69–88) has built **20**
> validated/committed/pushed slices across **v3** (accounts, Supabase auth, full-library cloud sync,
> data deletion, backup import/export), **v3.1** (responsive layout, installable PWA, offline
> service worker, swipe answers, Supabase code-split), and the start of **v3.2** (single-range JSON
> import/export, CSV export). Per the skill's safety checkpoint the loop PAUSED at slice 89; the user
> re-invoked `finish-roadmap` to continue. Slice counting restarts for this run.

Slice 89 added SVG image export. `formatRangeSvg(range)` in `domain/rangeTransfer.ts` renders a
standalone 13×13 SVG (one `<rect>` + `<text>` per starting hand in matrix order): in-range hands use
the accent color, action-assigned hands use their palette color (mirroring `ActionPalette.css`),
others are muted; the range name is XML-escaped into a `<title>`. Pure and dependency-free, unit-
tested for structure (169 cells), fills, action colors, and escaping. An "Export image" card action
(`onExportRangeImage`, optional like the JSON/CSV actions) downloads `{name}.svg` via
`downloadTextFile(..., 'image/svg+xml')`.

Slice 90 added shareable range links (the client-side, no-backend portion of "Shareable range
links"). `encodeRangeToHash(range)` / `decodeRangeFromHash(hash)` in `domain/rangeTransfer.ts`
base64url-encode the existing `serializeRangeExport` envelope (UTF-8 safe via
`encodeURIComponent`/`escape`), reusing `parseRangeExport` on decode and throwing a clear `Error` on
malformed input; round-trip + rejection unit-tested. A "Copy share link" card action
(`onShareRange`, optional) copies `${origin}${pathname}#range=<hash>` to the clipboard (falling back
to `window.prompt` when the Clipboard API is unavailable). On load, `App` runs a module-level
`importSharedRangeFromHash()` BEFORE rendering — it decodes a `#range=` fragment, saves it as a NEW
range (fresh `createRangeId()` + timestamps), and clears the hash — so the normal `loadSavedRanges()`
initializer picks it up without a synchronous setState in an effect (which the lint config forbids).

(Remaining v3.2 bullets — **public read-only range pages** and **private server-hosted shared
links** — require backend/hosting decisions and are a design-decision PAUSE when reached. **Range
packs** are buildable locally and are queued next.)

Slice 91 added range packs. `rangeTransfer.ts` gained the versioned envelope `{ kind:
'poker-range-pack', version: 1, name?, ranges }` via `buildRangePack` / `serializeRangePack` and
`parseRangePack(json): { name?; ranges }` (validates kind/version + that `ranges` is an array of
structurally valid ranges, reusing a factored-out `isValidRangeShape`; throws a clear `Error`
otherwise). Round-trip + rejection unit-tested. `App` wires an "Export pack" button (downloads ALL
ranges as one `.json`) and an "Import pack" file input (adds every contained range as a NEW range
with fresh ids/timestamps, never clobbering), mirroring the single-range flow.

**DESIGN DECISION (2026-06-08):** the user chose the **Supabase row + `/r/:id` route** model for
v3.2's shared range pages, so the loop resumed. Implementation: a `shared_ranges` table keyed by an
unguessable id; public rows readable by id alone, private rows guarded by a secret token; visitor
reads go through a `SECURITY DEFINER` RPC; a client-rendered hash route renders the page read-only.

Slice 92 built the backend foundation. `supabase/migrations/0003_shared_ranges.sql` documents the
`shared_ranges` table (owner-only RLS for insert/update/delete/owner-select) plus a
`get_shared_range(p_id, p_token)` SECURITY DEFINER function that returns the payload when the row is
public or the token matches (granted to anon + authenticated). `src/cloud/sharedRangesRepo.ts` adds
`publishSharedRange(range, isPublic)` (signed-in insert; generates the id and, for private, a token —
both injectable), `getSharedRange(id, token?)` (no sign-in needed; calls the RPC; null when nothing
matches), and `unpublishSharedRange(id)` (owner-scoped delete). Same injectable deps + unconfigured/
signed-out errors as the other repos; fully unit-tested with a fake client. Not wired into the UI yet.

Slice 93 added the visitor-facing read side. `src/domain/shareRoute.ts`'s `parseShareRoute(hash)`
recognizes `#/r/:id` (optional `?t=`/`&t=` private token; percent-decoded; distinct from slice 90's
`#range=`), unit-tested. The standalone read-only `SharedRangePage` component fetches via
`getSharedRange` (injectable) and renders the range read-only — name + combos/percent + the existing
`HandGrid` (or `ActionGrid` when `handActions` is present) with no-op handlers — across loading,
unconfigured, not-found, and error states (initial state computed lazily so no synchronous setState
runs in the effect). `App` now splits into a thin `App` (renders `SharedRangePage` when
`parseShareRoute(location.hash)` matches) and `AppShell` (the full app), so visiting a share link
shows the read-only page while local mode and the `#range=` import path keep working.

Slice 94 added the author-facing publish side. `AppShell.handlePublishRange(range)` asks public vs
private (a `confirm`: OK = public, Cancel = private), calls `publishSharedRange(range, isPublic)`,
builds `${origin}${pathname}#/r/${id}` (with `?t=${token}` for private), copies it to the clipboard
(falling back to `window.prompt`), and reports via `syncStatus`. `RangeLibrary` cards gained a
"Publish link" action gated behind a new `canPublishToCloud` prop (passed `!!auth.session`), so it
appears only for signed-in users; tested for the gating + click. **The shared range pages feature is
usable end-to-end: a signed-in user publishes a link, anyone opens `#/r/:id` to view it read-only.**

> ⚠️ **NOTE ON v3.2 completion.** With slices 86–94, **v3.2 — Import/export ecosystem is
> effectively COMPLETE**: JSON export/import, CSV, SVG image, client-side share links, range packs,
> and cloud-published public/private shared pages. The repo also has an unused
> `unpublishSharedRange` (slice 92) with no UI yet; slice 95 adds that small affordance to fully
> round out the feature before the roadmap moves on to **v4 — Advanced poker training** (a large,
> postflop-focused version — its first slice should be a small pure-domain foundation, e.g. board
> texture tagging).

Slice 95 added the "Unpublish link" affordance. `AppShell` now tracks a `publishedShareIds`
(`Record<rangeId, shareId>`) populated on successful publish; `handleUnpublishRange(range)` calls
`unpublishSharedRange(shareId)` and drops the entry, reporting via `syncStatus`. `RangeLibrary`
shows an "Unpublish link" button only for ranges with a published id this session (new
`onUnpublishRange` + `publishedRangeIds` props), gated behind `canPublishToCloud`; tested for the
gating + click.

> ✅ **v3.2 — Import/export ecosystem is COMPLETE** (slices 86–95): JSON export/import, CSV, SVG
> image, client-side `#range=` share links, range packs, and cloud-published public/private shared
> pages (publish + read-only `#/r/:id` page + unpublish). **With v1–v3.2 all done, the roadmap now
> moves to v4 — Advanced poker training**, a large postflop-focused version. It is a major shift
> (cards, boards, postflop scenarios) but it is product-specified, not an infrastructure decision,
> so the loop proceeds — starting with a small pure-domain foundation (card model + flop texture
> tagging) and keeping every existing preflop feature intact.

Slice 96 began **v4** with a pure domain foundation, no UI. `src/domain/cards.ts` adds a card model
(`RANKS`/`SUITS`, `Card`, `rankValue`, `formatCard`, `parseCard`, `parseBoard` — accepts concatenated
or separated input, rejects malformed/duplicate cards). `src/domain/boardTexture.ts` adds
`tagFlopTexture(board)` returning canonical-ordered `FlopTextureTag[]` (`aceHigh`, `paired`,
`monotone`/`twoTone`/`rainbow`, `connected` with ace-low wheel handling, and a `wet`/`dry` summary).
Both are fully unit-tested and entirely separate from the preflop range model.

Slice 97 added the read-only `FlopTexture` component (+ CSS): it parses a board string via
`parseBoard`, renders the three cards (suit-colored) and the `tagFlopTexture` tags as labeled chips
(`FLOP_TEXTURE_TAGS` order + a `TAG_LABELS` map), and shows a clear inline `role="alert"` error
instead of throwing on bad input. Presentational only, fully tested, not yet wired into the app.

Slice 98 added `src/domain/handCategory.ts`: `categorizeHand(hand, flop): HandCategory[]` classifies
a 2-card hand against a 3-card flop into canonical-ordered tags (`set`, `trips`, `twoPair`,
`overpair`, `topPair`, `middlePair`, `bottomPair`, `pair`/underpair, `flushDraw`, `straightDraw` with
ace-high/low handling, `air`), supporting combined tags (e.g. top pair + flush draw). Pure,
hand-class level (full combo precision is later v4.1), thoroughly unit-tested.

Slice 99 added `src/domain/rangeVsBoard.ts`: `expandHandClass(hand)` expands a preflop class into its
concrete combos (6 pairs / 4 suited / 12 offsuit), and `bucketRangeOnBoard(hands, flop)` expands a
range, drops board-blocked combos, categorizes each remaining combo via `categorizeHand`, and tallies
combos per `HandCategory` (each tag a combo carries is counted, so top-pair + flush-draw counts
toward both). Pure, unit-tested; the data layer for a later range-vs-board view.

Slice 100 added the standalone `RangeVsBoard` component (+ CSS): a local board text input that, on a
valid three-card flop, renders the `FlopTexture` display plus a `bucketRangeOnBoard` combo breakdown
table (`CATEGORY_LABELS` + `HAND_CATEGORIES` order, zero rows muted), with an inline `role="alert"`
error for bad input. Self-contained, fully tested, not yet wired into `App`.

Slice 101 made `RangeVsBoard` reachable. `RangeLibrary` cards gained a "Board" action
(`Analyze {name} vs a board`, optional `onViewBoard` prop); `AppShell` holds a `boardRange` state and
renders the range-vs-board view (header + "Back to library") in the same view-switching chain as the
performance/action views, passing the range's `hands`. An App test opens the view and checks the
overpair breakdown for a saved range; preflop flow untouched.

> ℹ️ **v4 progress.** Done so far: card model + flop texture tagging (96), texture display (97),
> made-hand/draw categorization (98), combo expansion + range-vs-board bucketing (99), the
> range-vs-board breakdown component (100) and its library wiring (101). Remaining v4 bullets:
> a **postflop scenario builder** and **practice postflop decisions** (bet/check/call/raise/fold).
> Next: the pure postflop-scenario model + decision-practice domain, then its UI.

Slice 102 added `src/domain/postflopScenario.ts`: the `PostflopDecision` union
(`bet`/`check`/`call`/`raise`/`fold`) + `POSTFLOP_DECISIONS`/`POSTFLOP_DECISION_LABELS`, the
`PostflopScenario` type (heroHand, flop, potSize, stackDepth, facing), `buildPostflopScenario(input)`
(parses/validates hand + flop, rejects duplicate cards across hand and board), and
`describeHeroHand(scenario)` (the hero hand's `categorizeHand` tags). Pure, unit-tested.

Slice 103 added the heuristic to `postflopScenario.ts`: `isFacingAggression(scenario)` (detects
bet/raise/jam in the `facing` text) and `suggestDecision(scenario): { decision; rationale }`, a
transparent, deterministic, explicitly-NOT-GTO mapping from the hero hand's category tags + whether
aggression is faced to a sensible line (strong made → bet/raise; draws → call vs bet / semi-bluff
when checked to; medium pairs → call/check; air → fold vs bet / check first-in), each with a short
rationale. Unit-tested across every branch.

Slice 104 added the standalone `PostflopPractice` component: given a `PostflopScenario` it shows the
hero hand, `FlopTexture`, pot/stack/`facing`, and the five `POSTFLOP_DECISIONS` as buttons; on answer
it compares to `suggestDecision` and reports match/differ + the suggested decision and rationale
(framed as a heuristic, self-graded, no persisted stats), with an `onExit`. Fully tested; not yet
wired into `App`.

Slice 105 made the postflop drill reachable. `PostflopDrillSetup` is a form (hero hand, flop, pot,
stack, facing) that builds a scenario via `buildPostflopScenario` (inline `role="alert"` on parse
error). `AppShell` holds a `postflop` state (`'setup' | PostflopScenario | null`); a top-level
"Postflop drill" button (next to "Review due ranges") opens the setup, a built scenario renders
`PostflopPractice`, and `onExit` returns to the library — all in the existing view-switching chain.
An App test runs setup → graded answer; preflop flow untouched.

> ✅ **v4 — Advanced poker training is COMPLETE** (slices 96–105): a card model + flop texture
> tagging, made-hand/draw categorization, combo expansion + range-vs-board bucketing with a wired
> per-range "Board" view, and a postflop decision drill (scenario model + transparent heuristic +
> self-graded practice + launcher). The roadmap's deeper postflop-scenario builder is covered by the
> drill setup; full solver-grade play is explicitly out of scope (the heuristic is a teaching tool).
> **The roadmap now moves to v4.1 — Combo-level precision** (expand hand classes to exact combos,
> board/dead-card removal, specific combo selection, blocker-aware practice). Start with a small pure
> domain foundation; the preflop trainer must stay fast.

Slice 106 began **v4.1** with `src/domain/combos.ts`: `handClassCombos(hand)` (6/4/12 combos),
`rangeCombos(hands)`, `comboKey(combo)` (canonical order-independent id, higher card first), and
`removeDeadCards(combos, dead)` (blocker/board removal). `rangeVsBoard.ts` now re-exports
`expandHandClass = handClassCombos` (combo enumeration consolidated here). Pure, unit-tested.

Slice 107 added blocker-aware combo counts to `combos.ts`: `availableComboCount(hands, dead)` (range
total after `removeDeadCards`) and `comboCountByHandClass(hands, dead)` (per-class remaining counts).
Pure, unit-tested (no-dead totals match classic counts; board cards reduce the right classes).

> ⚠️ **finish-roadmap 20-slice safety checkpoint.** This run (slices 89–108) has built **20**
> validated/committed/pushed slices: it FINISHED **v3.2** (SVG export, share links, range packs,
> cloud public/private shared pages), completed **v4 — Advanced poker training** (card model, flop
> texture, hand categorization, range-vs-board view, postflop decision drill), and began **v4.1 —
> Combo-level precision** (combo enumeration, dead-card removal, blocker-aware counts). One
> design-decision pause (shared-page hosting) was resolved by the user mid-run (Supabase + `/r/:id`).
> Per the skill's safety checkpoint the loop PAUSES here. Re-invoking `finish-roadmap` resumes from
> slice 109. The repo is clean and fully pushed.

Slice 108 surfaced the blocker-aware count in the UI: `RangeVsBoard` now also computes
`availableComboCount(hands, flop)` and shows "{n} combos remaining (after removing board cards)"
above the category table. Test updated (AA + AKs on a Kd board → 9 remaining).

Slice 109 added `src/domain/comboSelection.ts`: the pure specific-combo selection model. A
`ComboSelection` is a `Set<string>` of canonical `comboKey`s (the ON combos), so it is
order-independent and serializable-friendly. `allCombosSelected(hands)` / `allCombosForHand(hand)`
seed an all-on selection, `toggleCombo(selection, combo)` returns a NEW selection (immutable input),
`isComboSelected` / `selectedComboCount` query it, and `serializeComboSelection` /
`deserializeComboSelection` round-trip it via a plain key array. Reuses `combos.ts`'s `comboKey`
(so AhKh and KhAh are the same combo). Fully unit-tested; no UI/storage wiring yet.

Slice 110 persisted combo selections on a saved range. `SavedRange` gained an optional
`comboSelections?: Record<PokerHand, string[]>` (each value a serialized list of selected
`comboKey`s for that hand class; ABSENCE = all combos selected, so pre-v4.1 ranges need no
migration). `rangeStorage` gained `normalizeComboSelections` (mirroring `normalizeHandActions`):
it keeps entries with a canonical hand-class key and an array value, drops non-string elements,
and collapses an all-empty map to `undefined` so `comboSelections: {}` is never persisted. Wired
into both `parseSavedRange` (load) and `saveSavedRange` (write). Round-trip + malformed-drop +
all-invalid-omit are unit-tested; hands-only ranges are unaffected.

Slice 111 added the first UI for specific-combo selection: the standalone, controlled
`src/components/ComboSelector.tsx` (+ CSS). Given a `hand` class, the current `ComboSelection`
(`Set` of `comboKey`s, owned by the parent), and an `onToggle(combo)` callback, it renders each
combo from `handClassCombos(hand)` as a suit-colored two-card toggle button with `aria-pressed`
reflecting `isComboSelected`, plus a "{selected}/{total} combos" count. Order-independent via
`comboKey`. Presentational only — no storage or App wiring yet. Component-tested (AKs → 4 buttons,
aria-pressed state, onToggle fires with the clicked combo).

Slice 112 added the pure `src/domain/blockerPractice.ts`: `availablePracticeCombos(hands, dead?,
selection?)` returns a range's concrete combos after dead-card removal and (when a `ComboSelection`
is given) restriction to selected combos (absence = all live combos), and `drawPracticeCombo(hands,
dead?, selection?, random?)` draws one uniformly (injectable `random` defaulting to `Math.random`),
throwing a clear `Error` when the pool is empty. Reuses `combos.ts` + `comboSelection.ts`; unit-
tested for dead-card removal, selection restriction, seeded draw, and the empty-pool throw. No
UI/storage wiring yet.

Slice 113 added the standalone self-graded `src/components/ComboBlockerDrill.tsx` (+ CSS). Given a
range's `hands` and an optional board string, it parses the board as dead cards (inline `role="alert"`
on bad input, like `RangeVsBoard`), shows "{n} combos available" via `availablePracticeCombos`, and a
"Deal a combo" button draws one un-blocked combo (`drawPracticeCombo`) and renders it as two suit-
colored cards. A fully-blocked range shows an empty message instead of crashing; an `onExit` back
action is provided. Board/combo are the only local state (parsing + remaining count memoized).
Component-tested (remaining count, dealt combo excludes a board card, empty message, invalid-board
error). No `App` wiring yet.

## Next slice

- **Number:** 114
- **Roadmap target:** v4.1 — Combo-level precision
- **Working title:** Wire the blocker-aware combo drill into the library (launcher)

### Prompt

Continue **v4.1** by making the blocker-aware combo drill (slice 113's `ComboBlockerDrill`) reachable
from the app, mirroring how the range-vs-board view was wired (slice 101).

- In `src/components/RangeLibrary.tsx`, add an OPTIONAL card action — e.g. a "Combo drill" button
  (`Deal combos for {name}`, optional `onComboDrill?` prop defaulting to no-op so existing renders are
  unaffected) — next to the existing "Board" action.
- In `App`/`AppShell`, hold a `comboDrillRange` state (a `SavedRange | null`) and render
  `<ComboBlockerDrill hands={comboDrillRange.hands} onExit={...} />` (with a header + "Back to library")
  in the SAME view-switching chain as the range-vs-board / performance / action views. Wire the
  library button to open it; `onExit` returns to the library. Preflop flow must be untouched.
- Add an `App`-level test: opening the combo drill for a saved range shows the remaining-count UI;
  dealing a combo renders a combo. Keep it small.

Validation: `npm run lint`, `npm run test:run`, `npm run build`.

Constraints:
- UI in `src/components/`; reuse `ComboBlockerDrill`; no new deps. Follow the existing view-switch
  pattern (boardRange). Small, reversible, preflop trainer unaffected. After this, v4.1's
  blocker-aware practice is reachable end-to-end — note the v4.1 status in the progress write-up.

Suggested commit message:
- `feat: wire blocker-aware combo drill into the library`
