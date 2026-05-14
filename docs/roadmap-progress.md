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

Slice 26 added the standalone `WeaknessFocusedDrill` component: a recognition loop
(prompt → answer → feedback → next) whose next prompt is drawn with
`getWeaknessFocusedHand(attempts)`, so missed hands resurface; it reports a summary via
`onExit`. It is fully tested but not yet wired into `App`.

Still to come in v2: wiring the weakness drill into the picker — the LAST piece of v2.
After that, **v2 is complete** and the roadmap moves to **v2.1 — Mistake tracking and
review**. Mode 2 ("Pick the correct action") stays deferred until the multi-action range
model arrives in v2.3. The next slice wires the weakness drill into the practice-mode
picker as a fourth mode, recording its summary into per-range stats (same recognition
metric).

## Next slice

- **Number:** 27
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Wire the weakness drill into the picker (completes v2)

### Prompt

You are implementing roadmap slice 27, continuing **v2 — Improved practice modes**.
Slice 26 delivered the standalone, tested `WeaknessFocusedDrill` component (mode 6),
not yet reachable by the user. This slice wires it into `App`'s practice-mode picker as
a fourth mode. Completing this slice **completes v2** — the next slice begins
**v2.1 — Mistake tracking and review**.

Scope of THIS slice: extend the `App` picker/routing only. No component changes. This is
the exact same wiring shape used for the timed drill in slice 24 — follow that pattern.

Context (read these before starting):
- `src/App.tsx` — practice picker. Relevant pieces:
  - state `practiceMode: 'recognize' | 'build' | 'timed' | null` (extend with
    `'weakness'`).
  - `handleEndPractice(summary)` records the summary into per-range stats then exits.
    The weakness drill is the SAME in/out recognition metric, so route its `onExit` to
    `handleEndPractice` (do NOT add a separate stats path).
  - the picker (`practiceMode === null` branch) has buttons for the three current modes
    plus a "Back to library" cancel. Add a fourth button "Weakness drill" that sets
    `practiceMode('weakness')`. Also extend the picker's description paragraph with a
    one-line note on the weakness mode.
  - the routing nested-ternary on `practiceMode`; add a `practiceMode === 'weakness'`
    branch rendering `<WeaknessFocusedDrill range={practicingRange}
    onExit={handleEndPractice} />`.
  - `headerSubtitle` switch; add a 'weakness' case (short copy, e.g.
    "Drill your weak spots.").
- `src/components/WeaknessFocusedDrill.tsx` — `WeaknessFocusedDrill({ range, onExit,
  random? })`, `onExit: (summary: PracticeSessionSummary) => void`. Import it like the
  other practice components.
- `src/App.test.tsx` — the "Practice mode" describe block and its picker tests. Mirror
  the timed-drill wiring tests added in slice 24.

Task — wire the weakness drill into `App`:
- Add `'weakness'` to the `practiceMode` union.
- Add a "Weakness drill" button to the picker (sets `practiceMode('weakness')`) and a
  short description line.
- Add the routing branch: `practiceMode === 'weakness'` → `<WeaknessFocusedDrill
  range={practicingRange} onExit={handleEndPractice} />`.
- Add a 'weakness' `headerSubtitle` case.

Tests to add/update (`src/App.test.tsx`):
- the picker now also shows a "Weakness drill" button (extend the existing
  "shows a practice-mode picker" assertions);
- choosing "Weakness drill" shows the weakness-drill view (heading
  "Weakness drill: <name>" and the In range / Out of range buttons);
- (preferred) finishing a weakness drill records into per-range stats — userEvent works
  here (no fake timers needed): start it, read the shown `.practice-prompt-hand`, answer
  truthfully, "End practice", then assert `loadPracticeStats()` updated (mirror the
  recognition stats test);
- keep ALL existing picker tests green (cancel, recognition, build, timed, mode-reset).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the picker/routing wiring in `App` and its tests. Do NOT
  modify any practice component.
- Reuse `handleEndPractice` for the weakness drill's exit so stats recording stays in
  one place.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add weakness drill to the practice-mode picker`
