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

v2.1 status: per-hand accuracy tracking (FP/FN), the range performance page, the heatmap
overlay, mistake review (mode 4 + performance view), and "practice mistakes only" are all
done. The remaining v2.1 feature is **session history**. Slice 39 added its storage
foundation: the `PracticeSessionRecord` type and `src/storage/sessionHistoryStorage.ts`
(`loadSessionHistory`, `recordPracticeSessionHistory` — an append-only per-range log,
oldest-first, mirroring `practiceStatsStorage`'s defensive validation). Slice 40 wired the recording: `App.handleEndPractice` now appends a
`recordPracticeSessionHistory(id, summary)` alongside the per-range and per-hand recorders
(summary computed once and shared). The next slice surfaces the log in the performance view
as a session timeline — the last piece of v2.1.

NOTE ON CADENCE: the user approved continuing the run past the 20-slice checkpoint (after
slice 38). The loop resumed at slice 39 and continues through v2.1 → v2.2 → v2.3; the next
safety pause is after ~20 more slices (≈ slice 58) or when the queued slice crosses into
v3, whichever comes first.

## Next slice

- **Number:** 41
- **Roadmap target:** v2.1 — Mistake tracking and review
- **Working title:** Session history timeline in the performance view (completes v2.1)

### Prompt

You are implementing roadmap slice 41, continuing **v2.1 — Mistake tracking and review**.
The session-history log is persisted (slice 39) and recorded each session (slice 40). This
slice surfaces it in the `RangePerformance` view as a session timeline. Completing this
**completes v2.1**; the next slice begins **v2.2 — Spaced repetition system**.

Scope of THIS slice: pass each range's history into `RangePerformance` from `App` and
render it; small App state + a component section + tests.

Context (read these before starting):
- `src/storage/sessionHistoryStorage.ts` — `loadSessionHistory(): Record<string,
  PracticeSessionRecord[]>` (oldest-first per range).
- `src/types/practice.ts` — `PracticeSessionRecord` (`rangeId`, `playedAt` ISO-8601,
  `totalQuestions`, `correctAnswers`).
- `src/App.tsx` — already keeps `handAccuracy` state (loaded via `loadHandAccuracy`,
  refreshed in `handleEndPractice`) and renders `<RangePerformance range
  accuracy={handAccuracy[id] ?? {}} onClose onPracticeMistakes />`. Mirror that for history:
  add a `sessionHistory` state from `loadSessionHistory()`, refresh it in
  `handleEndPractice` next to `setHandAccuracy(...)`, and pass `history={sessionHistory[
  performanceRange.id] ?? []}` to `RangePerformance`.
- `src/components/RangePerformance.tsx` — currently shows an empty state when
  `rankHandAccuracy` is empty, else a heatmap + per-hand table. Add a `history:
  PracticeSessionRecord[]` prop and render a session timeline section when
  `history.length > 0`, after the table. Show each session newest-first (reverse a copy —
  do NOT mutate the prop) with its date (`new Date(playedAt).toLocaleDateString()`), score
  (`{correctAnswers}/{totalQuestions}`), and accuracy %
  (`Math.round(correctAnswers / totalQuestions * 100)` — records always have
  `totalQuestions > 0`). Use a `<table>` or list with an `aria-label` like "Session history".
  Reuse existing CSS (e.g. the `.hand-accuracy-table` styling) where it fits.
- `src/components/RangePerformance.test.tsx` — add the new required `history` prop to every
  render (default `history={[]}`); mirror existing table/region assertions.

Task:
- `RangePerformance`: add the `history` prop and the "Session history" section (newest
  first; date, score, accuracy). Empty/`[]` history → no section.
- `App`: add `sessionHistory` state (load + refresh in `handleEndPractice`), pass `history`
  to `RangePerformance`.

Tests:
- `RangePerformance.test.tsx`: with a `history` of two records, the "Session history"
  region shows both, newest first; with `history={[]}`, no such region. Add `history` to all
  existing renders so they keep compiling.
- `App.test.tsx`: after finishing a session and opening "View stats", the session-history
  section shows a row (reuse the recognition flow). Keep existing tests green.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: the `RangePerformance` history section + `App` wiring + tests. Do
  NOT change practice flows, storage, or domain. Do NOT mutate the `history` prop (reverse a
  copy for newest-first).
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: show a session history timeline in the performance view`
