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

The roadmap now moves to **v2.1 — Mistake tracking and review** (track per-hand accuracy
/ false positives / false negatives per range; review mistakes; "practice mistakes only"
mode; heatmap overlay; session history; range-specific performance page). The next slice
begins v2.1 with its pure domain foundation: aggregating a session's attempts into
per-hand accuracy stats, mirroring how each prior feature began with a pure, tested
helper.

## Next slice

- **Number:** 28
- **Roadmap target:** v2.1 — Mistake tracking and review
- **Working title:** Per-hand accuracy aggregation (v2.1 domain foundation)

### Prompt

You are implementing roadmap slice 28, beginning **v2.1 — Mistake tracking and review**.
v2 is complete. v2.1 adds per-hand mistake tracking (per-hand accuracy, false positives,
false negatives), session review, a "practice mistakes only" mode, a heatmap overlay, a
session history, and a range-specific performance page. Following the established rhythm,
THIS slice adds ONLY the pure domain foundation that the later v2.1 UI/storage slices
build on: aggregating a session's `PracticeAttempt[]` into per-hand accuracy stats.

Scope of THIS slice (foundation only): one pure aggregation function + its result type.
Do NOT add persistence, a performance page, a heatmap, a "mistakes only" mode, or any
component in this slice — those are later v2.1 slices.

Context (read these before starting):
- `src/domain/practice.ts` — already has `reviewSessionMistakes(attempts)` (splits a
  session into `missed` / `wronglyIncluded` hand LISTS) and `summarizePracticeAttempts`.
  The new function generalizes the mistake split into per-hand COUNTS. Add it here beside
  `reviewSessionMistakes`. It imports `type PokerHand` from `./pokerHands` already.
- `src/types/practice.ts` — `PracticeAttempt` (`hand`, `expectedInRange`,
  `userAnsweredInRange`, `correct`). Add the new result type here next to
  `PracticeSessionSummary`/`RangePracticeStats`.
- A false positive = out of range (`!expectedInRange`) but answered in range
  (`userAnsweredInRange`); a false negative = in range (`expectedInRange`) but answered
  out (`!userAnsweredInRange`). Note: `falsePositives + falseNegatives === attempts -
  correct` per hand (every incorrect attempt is exactly one of the two).
- `src/domain/practice.test.ts` — mirror its pure-domain test patterns (the
  `reviewSessionMistakes` and `summarizePracticeAttempts` describes are the closest
  models).

Task — add the type and one pure function:
- In `src/types/practice.ts`, add:
  ```ts
  export interface HandAccuracyStat {
    hand: PokerHand           // canonical hand
    attempts: number          // times this hand was answered this session
    correct: number           // of those, how many were correct
    falsePositives: number    // out of range, answered "in range"
    falseNegatives: number    // in range, answered "out of range"
  }
  ```
  (import `PokerHand` is already present in that file.)
- In `src/domain/practice.ts`, add
  `summarizeHandAccuracy(attempts: PracticeAttempt[]): HandAccuracyStat[]`:
  - Tally per hand: `attempts`, `correct`, `falsePositives`, `falseNegatives` using the
    definitions above.
  - Return one `HandAccuracyStat` per hand that has at least one attempt, in canonical
    13×13 order (reuse `ALL_HANDS` for ordering, as `getRandomPracticeHand` already
    imports it; do not include hands with zero attempts).
  - Pure — no Date, no random. Doc comment in the same style as `reviewSessionMistakes`,
    noting the canonical ordering and that hands without attempts are omitted.

Tests to add (`src/domain/practice.test.ts`, new `describe('summarizeHandAccuracy', …)`):
- an empty session yields `[]`;
- a single correct attempt yields one stat with `attempts: 1, correct: 1,
  falsePositives: 0, falseNegatives: 0`;
- a false positive (out of range, answered in) and a false negative (in range, answered
  out) are each counted in the right field with `correct: 0`;
- repeated attempts on the same hand accumulate into one stat (e.g. two correct + one
  false negative → `attempts: 3, correct: 2, falseNegatives: 1`);
- multiple distinct hands are returned in canonical order (e.g. attempts on "KK" then
  "AA" come back as `["AA", "KK"]`);
- invariant: for every returned stat, `falsePositives + falseNegatives === attempts -
  correct`.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY the `HandAccuracyStat` type and the
  `summarizeHandAccuracy` function plus tests. No persistence, no UI, no new mode.
- Keep the helper pure and in `src/domain/`; keep the type in `src/types/`.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add per-hand accuracy aggregation for mistake tracking`
