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

Still to come in v2.1: persist per-hand accuracy across sessions (storage + recording);
a range-specific performance page; a heatmap overlay on the grid; a "practice mistakes
only" mode; and session history. The next slice adds the per-hand-accuracy storage
foundation (load + record-a-session), mirroring how slice 13 added per-range stats
storage before its UI; wiring the recording into the end-of-session flow follows in the
slice after.

## Next slice

- **Number:** 29
- **Roadmap target:** v2.1 — Mistake tracking and review
- **Working title:** Per-hand accuracy storage foundation (persist + record)

### Prompt

You are implementing roadmap slice 29, continuing **v2.1 — Mistake tracking and review**.
Slice 28 added the pure per-hand aggregation (`HandAccuracyStat` + `summarizeHandAccuracy`).
This slice adds the LOCAL PERSISTENCE for cumulative per-hand accuracy across sessions, so
later slices (performance page, heatmap, "practice mistakes only") can read it. This
mirrors how slice 13 landed the per-range stats storage before its UI.

Scope of THIS slice (storage foundation only): a new storage module that loads cumulative
per-hand accuracy and folds one finished session into it, plus tests. Do NOT wire it into
`App`/the end-of-session flow yet (that needs the practice components to surface per-hand
data and is the NEXT slice), and do NOT build any UI.

Context (read these before starting):
- `src/storage/practiceStatsStorage.ts` — THE pattern to mirror exactly: a single
  versioned `localStorage` key, a `parse…`/validate helper that returns `null` for
  malformed entries, a `write…` serializer, a `load…` that returns `{}` on
  missing/corrupt/non-object JSON and skips malformed entries, and a `record…` that folds
  one session in (no-op when there is nothing to record). Match its structure, naming,
  doc-comment style, and defensive validation.
- `src/storage/practiceStatsStorage.test.ts` — mirror its test patterns (clear
  `localStorage` in `beforeEach`; cover load-empty, round-trip, corrupt JSON, malformed
  entries skipped, recording folds/accumulates, and the no-op case).
- `src/types/practice.ts` — `HandAccuracyStat` (from slice 28: `hand`, `attempts`,
  `correct`, `falsePositives`, `falseNegatives`). The persisted shape is per range, a map
  of hand → cumulative `HandAccuracyStat`.

Task:
- In `src/types/practice.ts`, add a small alias for readability:
  `export type RangeHandAccuracy = Record<PokerHand, HandAccuracyStat>` (cumulative
  per-hand stats for one range, keyed by hand).
- Create `src/storage/handAccuracyStorage.ts`:
  - `export const HAND_ACCURACY_STORAGE_KEY = 'poker-range-trainer.hand-accuracy.v1'`.
  - `loadHandAccuracy(): Record<string, RangeHandAccuracy>` — outer key is `rangeId`.
    Return `{}` on missing/corrupt/non-object JSON. Validate each inner `HandAccuracyStat`
    (a non-null object with a non-empty string `hand` and the four counts being
    non-negative finite numbers); skip malformed hand entries, and skip a range entry that
    ends up with no valid hands. Re-key the inner maps by each stat's own `hand` so the
    structure is self-consistent (like `loadPracticeStats` re-keys by `rangeId`).
  - `recordHandAccuracy(rangeId: string, handStats: HandAccuracyStat[], )` — fold a
    finished session's per-hand stats (the output of `summarizeHandAccuracy`) into the
    stored cumulative map for `rangeId`: for each stat, add its counts onto the prior
    entry for that hand (starting from zeros when absent). An empty `handStats` array is a
    no-op (never creates a record). Persist via a private `writeHandAccuracy` serializer.
- Keep it side-effect-only with all reads/writes funneled through the exported functions,
  exactly like `practiceStatsStorage.ts`.

Tests to add (`src/storage/handAccuracyStorage.test.ts`):
- `loadHandAccuracy()` is `{}` when nothing is stored and when the stored JSON is corrupt;
- `recordHandAccuracy` then `loadHandAccuracy` round-trips one range's per-hand stats;
- recording a second session accumulates onto the first (counts add per hand; new hands
  are added);
- an empty `handStats` array records nothing (no key created);
- a malformed stored entry (e.g. a hand stat missing a count or with a negative count) is
  skipped on load without discarding the valid entries;
- recording is isolated per `rangeId` (two ranges don't interfere).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY the `RangeHandAccuracy` alias, `handAccuracyStorage.ts`,
  and its test. Do NOT modify `App`, the practice components, or add UI.
- Storage logic in `src/storage/`; type in `src/types/`. Mirror `practiceStatsStorage`.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: persist cumulative per-hand accuracy stats`
