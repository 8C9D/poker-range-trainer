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

Still to come in v2: mode 5 ("Timed drill") and mode 6 ("Weakness-focused drill").
Mode 2 ("Pick the correct action") stays deferred until the multi-action range model
arrives in v2.3. The next slice begins mode 5 with its pure timed-drill domain
foundation (countdown math + duration options), mirroring how mode 3 started with a
pure helper before its UI.

## Next slice

- **Number:** 22
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Timed-drill domain foundation (countdown math + durations)

### Prompt

You are implementing roadmap slice 22, continuing **v2 — Improved practice modes**.
Mode 3 ("Build from memory") is fully delivered (slices 19–21). This slice begins
mode 5 ("Timed drill"), where the user answers as many in/out-of-range hands as
possible before a countdown expires. Following the rhythm that worked for mode 3
(pure helper in slice 19, component in 20, wiring in 21), THIS slice adds only the
pure timed-drill domain foundation; the timed-drill component and its picker wiring
are the next slices.

Scope of THIS slice (foundation only): a new pure domain module for the countdown
math and the selectable drill durations. Do NOT build the timed-drill UI, a timer
component, `setInterval` logic, or any picker change in this slice — those come next.
Keeping the time math pure and tested first keeps the later component slice small and
lets the countdown be unit-tested without fake timers.

Context (read these before starting):
- `src/domain/practice.ts` and `src/domain/rangeMath.ts` show the established
  pure-domain module style (focused exported functions, a module doc comment, clamp
  helpers, no React/DOM). Put the new module beside them in `src/domain/`.
- `src/domain/practice.test.ts` shows the pure-domain test patterns to mirror
  (descriptive `describe`/`it`, boundary cases, deterministic inputs — here pass
  explicit epoch-millisecond numbers so no real clock is used).
- Recognition scoring (`createPracticeAttempt`, `summarizePracticeAttempts`) already
  exists and will be reused by the timed-drill COMPONENT later; this slice does not
  touch it.

Task — add one pure domain module `src/domain/timedDrill.ts`:
- Export `DRILL_DURATION_OPTIONS: readonly number[]` — the selectable drill lengths in
  seconds, `[30, 60, 120]`.
- Export `DEFAULT_DRILL_SECONDS = 60` (must be one of the options).
- Export `getRemainingSeconds(startEpochMs: number, durationSeconds: number,
  nowEpochMs: number): number`:
  - elapsed = `nowEpochMs - startEpochMs`; remaining seconds =
    `Math.ceil((durationSeconds * 1000 - elapsed) / 1000)`, then clamp into the
    integer range `[0, durationSeconds]`.
  - At `nowEpochMs === startEpochMs` it returns `durationSeconds`; once elapsed ≥
    duration it returns `0`; a `nowEpochMs` before `startEpochMs` (clock skew) still
    clamps to `durationSeconds`, never above.
- Export `isDrillOver(startEpochMs: number, durationSeconds: number, nowEpochMs:
  number): boolean` = `getRemainingSeconds(...) === 0`.
- Add a module doc comment in the same style as `practice.ts` (pure, UI-agnostic,
  takes `nowEpochMs` explicitly so it is testable without a real clock).

Tests to add (`src/domain/timedDrill.test.ts`):
- `DRILL_DURATION_OPTIONS` contains `DEFAULT_DRILL_SECONDS`;
- at start (`now === start`) remaining equals the full duration;
- partway through (e.g. 60s drill, 25s elapsed) remaining is the expected ceil value
  (36) and counts down to 1 in the final whole second;
- at and past expiry remaining is `0` and `isDrillOver` is `true`;
- a `now` before `start` clamps remaining to the full duration (never above) and
  `isDrillOver` is `false`;
- `isDrillOver` is `false` while time remains and flips to `true` exactly at expiry.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY `src/domain/timedDrill.ts` and its test. Do NOT add a
  timed-drill component, timers/`setInterval`, or any change to `App`/the picker — those
  are the next slices.
- Keep the module pure and in `src/domain/`; take the current time as a parameter, do
  not call `Date.now()` inside it.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add timed-drill countdown domain helpers`
