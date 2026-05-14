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

Still to come in v2: mode 6 ("Weakness-focused drill"), which prioritizes hands the
user keeps getting wrong. Mode 2 ("Pick the correct action") stays deferred until the
multi-action range model arrives in v2.3. The next slice begins mode 6 with its pure
domain foundation — an in-session weighted draw that biases prompts toward hands missed
so far — mirroring how modes 3 and 5 started with a pure helper before the UI. (Note:
this is an *in-session* weakness signal derived from the current session's attempts;
cross-session per-hand accuracy tracking is the separate v2.1 mistake-tracking work.)

## Next slice

- **Number:** 25
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Weakness-focused draw domain foundation (mode 6)

### Prompt

You are implementing roadmap slice 25, continuing **v2 — Improved practice modes**.
Modes 3, 4, and 5 are delivered. This slice begins the final v2 mode, mode 6
("Weakness-focused drill"), which prioritizes hands the user keeps getting wrong.
Following the rhythm that worked for modes 3 and 5 (pure helper first, then component,
then wiring), THIS slice adds ONLY the pure domain foundation: an in-session weighted
draw that biases the next prompt toward hands missed so far. Do NOT build a component or
touch the picker/App in this slice.

Design note (scope): this is an *in-session* weakness signal computed from the current
session's `PracticeAttempt[]` — every hand stays possible, but each incorrect attempt on
a hand increases how often that hand is drawn. This is intentionally NOT the persisted,
cross-session per-hand accuracy tracking, which is the separate **v2.1** mistake-tracking
work; do not build persistence here.

Context (read these before starting):
- `src/domain/practice.ts` — `getRandomPracticeHand(random = Math.random)` shows the
  prompt-draw idiom to mirror, including the `Math.min(len - 1, Math.floor(random() *
  len))` clamp so an input of exactly 1 still yields a valid hand. The new draw reuses
  this exact clamping idiom.
- `src/domain/pokerHands.ts` — `ALL_HANDS` (the 169 canonical hands in order) and
  `type PokerHand`.
- `src/domain/timedDrill.ts` / `timedDrill.test.ts` — the per-mode pure-module + test
  style to mirror (focused exports, module doc comment, deterministic inputs).
- `src/types/practice.ts` — `PracticeAttempt` (has `hand` and `correct`).

Task — add a new pure domain module `src/domain/weaknessDrill.ts`:
- Export `WEAKNESS_MISTAKE_WEIGHT = 3` — extra pool copies added per incorrect attempt
  on a hand.
- Export `buildWeaknessPool(attempts: PracticeAttempt[], mistakeWeight =
  WEAKNESS_MISTAKE_WEIGHT): PokerHand[]`:
  - Count incorrect attempts (`!attempt.correct`) per hand.
  - Return an array that, iterating `ALL_HANDS` in canonical order, contains each hand
    once PLUS `mistakeWeight * (incorrect count for that hand)` extra copies. So with no
    attempts the pool is exactly `ALL_HANDS` (length 169); a hand missed twice with the
    default weight appears `1 + 3*2 = 7` times. Ignore the attempt's `hand` if it is not
    a canonical hand is unnecessary — attempts always carry canonical hands — but only
    count hands that appear in `ALL_HANDS` so a stray value never inflates the pool.
- Export `getWeaknessFocusedHand(attempts: PracticeAttempt[], random: () => number =
  Math.random, mistakeWeight = WEAKNESS_MISTAKE_WEIGHT): PokerHand`:
  - Build the pool, then index it with `Math.min(pool.length - 1, Math.floor(random() *
    pool.length))` (same clamp as `getRandomPracticeHand`). With no attempts this is a
    uniform draw over all 169 hands; with mistakes, missed hands are proportionally more
    likely.
- Module doc comment in the `timedDrill.ts` style (pure; randomness/now injected;
  explain the in-session weighting and that it is not persisted cross-session).

Tests to add (`src/domain/weaknessDrill.test.ts`):
- `buildWeaknessPool([])` equals `ALL_HANDS` (same length and contents/order).
- a single incorrect attempt on a hand adds exactly `mistakeWeight` extra copies (e.g.
  count occurrences of that hand in the pool === `1 + mistakeWeight`); a correct attempt
  adds none.
- multiple incorrect attempts on the same hand stack (`1 + mistakeWeight * n`), and the
  pool length grows by `mistakeWeight * (total incorrect attempts)`.
- `getWeaknessFocusedHand` with no attempts behaves like a uniform draw: `random => 0`
  yields `ALL_HANDS[0]` ("AA") and `random => 0.999...`/`1` yields the last hand
  (clamped), matching `getRandomPracticeHand`'s boundary behavior.
- `getWeaknessFocusedHand` biases toward a missed hand: construct attempts where one
  hand has many mistakes, and assert a `random` value lands on that hand where a uniform
  draw would not (pick a deterministic `random` using the known pool layout), or simpler:
  with a heavily-missed hand, assert the hand at the computed weighted index is that hand.
- default RNG always returns a canonical hand (loop a handful of draws, assert each is in
  `ALL_HANDS`).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY `src/domain/weaknessDrill.ts` and its test. Do NOT add a
  component, modify `App`/the picker, or add persistence.
- Keep it pure and in `src/domain/`; inject `random`, never call it at module scope.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add weakness-focused draw domain helper`
