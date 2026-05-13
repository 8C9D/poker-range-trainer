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

Still to come in v2: wiring the timed drill into the picker, then mode 6
("Weakness-focused drill"). Mode 2 ("Pick the correct action") stays deferred until the
multi-action range model arrives in v2.3. The next slice wires the timed drill into the
practice-mode picker as a third mode, recording its summary into per-range stats (it is
the same in/out recognition metric).

## Next slice

- **Number:** 24
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Wire the timed drill into the practice-mode picker

### Prompt

You are implementing roadmap slice 24, continuing **v2 — Improved practice modes**.
Slice 23 delivered the standalone, fully tested `TimedDrillSession` component (mode 5),
which is not yet reachable by the user. This slice wires it into `App`'s practice-mode
picker as a third mode, so clicking "Practice" → "Timed drill" launches it. Completing
this slice fully delivers mode 5.

Scope of THIS slice: extend the `App` picker/routing only. No component changes.

Context (read these before starting):
- `src/App.tsx` — the practice picker added in slice 21. Relevant pieces:
  - state `practiceMode: 'recognize' | 'build' | null` (extend this union with
    `'timed'`).
  - `handlePractice` sets `practicingRange` and `practiceMode = null` (picker shows).
  - `exitPractice()` clears `practicingRange` and `practiceMode`.
  - `handleEndPractice(summary)` records the summary into per-range stats
    (`recordPracticeSession` + refresh) then calls `exitPractice()`. The timed drill is
    the SAME in/out recognition metric, so it should record too — route the timed
    drill's `onExit` to `handleEndPractice` (do NOT invent a separate stats path).
  - The picker is the `practiceMode === null` branch: a `<section
    aria-label="Choose practice mode">` with "Recognize hands (in/out)" and
    "Build from memory" buttons (both setting `practiceMode`) plus a "Back to library"
    cancel. Add a third button "Timed drill" that sets `practiceMode('timed')`.
  - The routing is a nested ternary on `practiceMode`; add a `practiceMode === 'timed'`
    branch rendering `<TimedDrillSession range={practicingRange}
    onExit={handleEndPractice} />`.
  - `headerSubtitle` switches on state; add a 'timed' case (short copy, e.g.
    "Race the clock.").
- `src/components/TimedDrillSession.tsx` — `TimedDrillSession({ range, onExit, random?
  })`, `onExit: (summary: PracticeSessionSummary) => void`. Import it like
  `BuildFromMemoryPractice` is imported.
- `src/App.test.tsx` — the "Practice mode" describe block. Mirror its patterns. NOTE
  the picker tests there assume exactly the existing buttons; keep them green and add
  new coverage for the timed option.

Task — wire timed drill into `App`:
- Add `'timed'` to the `practiceMode` union.
- Add a "Timed drill" button to the picker (sets `practiceMode('timed')`).
- Add the routing branch: `practiceMode === 'timed'` → `<TimedDrillSession
  range={practicingRange} onExit={handleEndPractice} />` (records stats via the same
  path recognition uses).
- Add a 'timed' `headerSubtitle` case.

Tests to add/update (`src/App.test.tsx`):
- the picker now also shows a "Timed drill" button;
- choosing "Timed drill" shows the timed-drill setup (e.g. the "30s"/"60s"/"120s"
  duration buttons and a "Timed drill: <name>" heading);
- (optional but preferred) finishing a timed drill records into per-range stats — you
  can use Vitest fake timers + `fireEvent` (NOT userEvent, which deadlocks under fake
  timers) to start a drill, answer the shown hand, advance past the duration, and assert
  `loadPracticeStats()` updated. If this proves fiddly within App, at minimum assert the
  timed-drill view is reachable and the existing recognition/stats tests still pass.
- keep all existing picker tests passing (the cancel test, recognition test, build
  test, and the mode-reset test).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the picker/routing wiring in `App` and its tests. Do NOT
  modify `TimedDrillSession`, `PracticeSession`, or `BuildFromMemoryPractice`.
- Reuse `handleEndPractice` for the timed drill's exit so stats recording stays in one
  place; do not duplicate the recording logic.
- If a test mixes fake timers with clicks, use `fireEvent` (userEvent + fake timers
  deadlocks in this project — see `TimedDrillSession.test.tsx`).
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add timed drill to the practice-mode picker`
