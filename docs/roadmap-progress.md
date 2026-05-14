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

Still to come in v2: the weakness-drill component and its picker wiring. Mode 2 ("Pick
the correct action") stays deferred until the multi-action range model arrives in v2.3.
The next slice builds the weakness-drill practice component on top of
`getWeaknessFocusedHand` and the recognition scoring helpers.

## Next slice

- **Number:** 26
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Weakness-focused drill practice component (mode 6 UI)

### Prompt

You are implementing roadmap slice 26, continuing **v2 — Improved practice modes**.
Slice 25 delivered the pure weakness-focused draw foundation
(`src/domain/weaknessDrill.ts`: `getWeaknessFocusedHand(attempts, random)` and
`buildWeaknessPool`). This slice builds the weakness-focused drill **UI component**
(mode 6) on top of it and the existing recognition scoring. Do NOT wire it into the
picker yet — that is the NEXT slice (27). Keep it standalone and fully tested first,
mirroring how modes 3 and 5 landed (component, then wiring).

Scope of THIS slice: a self-contained `WeaknessFocusedDrill` component — a recognition
loop (prompt → answer → immediate feedback → next) whose NEXT prompt is drawn with
`getWeaknessFocusedHand(attempts)` so hands missed earlier this session resurface more
often. Keep it focused: prompt + In/Out answer + per-answer feedback + running stats +
"End practice" that reports the summary. It does NOT need the full end-of-session
mistake-review screen (that is mode 4, already on `PracticeSession`); ending reports the
summary directly via `onExit`.

Context (read these before starting):
- `src/components/PracticeSession.tsx` and `.css` — mirror its recognition flow and
  reuse its CSS classes (`practice-session`, `practice-header`, `practice-stats`/
  `practice-stat`, `practice-prompt`*, `practice-answers`/`.primary`,
  `practice-feedback`, `practice-result`/`.correct`/`.incorrect`, `practice-expected`).
  Reuse its scoring: `createPracticeAttempt(hand, range.hands, answeredInRange)`,
  accumulate `PracticeAttempt[]`, `summarizePracticeAttempts`. Note how it takes an
  injectable `random` prop and how `PracticeSession.test.tsx` uses `sequenceRandom`.
- `src/domain/weaknessDrill.ts` — `getWeaknessFocusedHand(attempts, random)`. Use it for
  BOTH the initial prompt (`getWeaknessFocusedHand([], random)`) and each subsequent
  prompt, passing the attempts accumulated so far so the weighting reflects this
  session's mistakes. Do not re-derive the weighting in the component.
- `src/domain/practice.ts` — `createPracticeAttempt`, `summarizePracticeAttempts`.
- `src/types/practice.ts`, `src/types/range.ts` — `PracticeAttempt`,
  `PracticeSessionSummary`, `SavedRange`.

Task — add `src/components/WeaknessFocusedDrill.tsx` exporting
`WeaknessFocusedDrill({ range, onExit, random = Math.random }: { range: SavedRange;
onExit: (summary: PracticeSessionSummary) => void; random?: () => number })`:
- Header `Weakness drill: {range.name}` and an "End practice" button that calls
  `onExit(summarizePracticeAttempts(attempts))`.
- State: `currentHand` (init `getWeaknessFocusedHand([], random)`), `currentAttempt`
  (null until answered), `attempts`.
- Show running stats (total / correct / accuracy via `summarizePracticeAttempts`).
- Prompt the current hand with In range / Out of range buttons. Answering scores via
  `createPracticeAttempt`, stores the scored attempt (for feedback), and appends it to
  `attempts`. Ignore extra clicks once answered (mirror `PracticeSession`'s guard).
- After answering, show feedback (Correct!/Incorrect + the expected answer) and a
  "Next hand" button that draws `getWeaknessFocusedHand(attempts, random)` using the
  current attempts (which now include the just-answered one, so missed hands are
  weighted up) and clears the feedback.
- Keep the weighting in `getWeaknessFocusedHand` and scoring in `practice.ts`; the
  component only orchestrates state and rendering. No timers, no persistence.

Tests to add (`src/components/WeaknessFocusedDrill.test.tsx`, RTL + userEvent — NO fake
timers needed here):
- shows the range name, the first prompt, and both answer buttons (force the prompt with
  a `random` sequence; with no attempts the draw is uniform, so `() => 0` yields "AA");
- answering updates the running stats and shows feedback with the expected answer;
- "Next hand" advances to a new prompt and clears the feedback;
- a missed hand is weighted up on the next draw: answer the first hand incorrectly, then
  assert the next prompt is the missed hand for a `random` value that — given the now
  heavier pool — lands on it (compute via `buildWeaknessPool`, or pick a `random`
  sequence whose second value targets the missed hand's enlarged block; keep it
  deterministic);
- "End practice" calls `onExit` with the accumulated summary.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY `WeaknessFocusedDrill.tsx`, its CSS (if needed), and its
  test. Do NOT modify `App.tsx`/the picker (wiring is slice 27) and do NOT modify
  `PracticeSession`/`TimedDrillSession`/`BuildFromMemoryPractice`.
- Reuse the `weaknessDrill` and `practice` domain helpers — no duplicated weighting or
  scoring logic in the component.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add weakness-focused drill practice component`
