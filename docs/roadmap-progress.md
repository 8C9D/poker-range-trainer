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

Still to come in v2: the timed-drill component (mode 5 UI) and its picker wiring, then
mode 6 ("Weakness-focused drill"). Mode 2 ("Pick the correct action") stays deferred
until the multi-action range model arrives in v2.3. The next slice builds the
timed-drill practice component on top of the recognition scoring helpers and the new
countdown helpers.

## Next slice

- **Number:** 23
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Timed-drill practice component (mode 5 UI)

### Prompt

You are implementing roadmap slice 23, continuing **v2 — Improved practice modes**.
Slice 22 delivered the pure timed-drill domain foundation (`src/domain/timedDrill.ts`:
`DRILL_DURATION_OPTIONS`, `DEFAULT_DRILL_SECONDS`, `getRemainingSeconds`,
`isDrillOver`). This slice builds the timed-drill practice **UI component** (mode 5) on
top of those helpers and the existing recognition scoring. Do NOT wire it into the
picker yet — that is the NEXT slice (24). Keeping it standalone and fully tested first
(its test file exercises it, so it is not dead code) mirrors how mode 3 landed (slice
20 component, slice 21 wiring).

Scope of THIS slice: a self-contained `TimedDrillSession` component that lets the user
pick a duration, then answer in/out-of-range prompts as fast as they can until the
countdown expires, then see a summary. No picker change, no App change.

Context (read these before starting):
- `src/components/PracticeSession.tsx` and `.css` — the recognition component to mirror
  closely. Reuse its scoring approach: `createPracticeAttempt(hand, range.hands,
  answeredInRange)`, accumulate `PracticeAttempt[]`, and `summarizePracticeAttempts`
  for the final stats. Reuse `getRandomPracticeHand(random)` for prompts and an
  injectable `random` prop defaulting to `Math.random` (see how `PracticeSession`
  takes `random` and how `PracticeSession.test.tsx` builds a deterministic
  `sequenceRandom`). Reuse `PracticeSession.css` classes (`practice-session`,
  `practice-header`, `practice-stats`/`practice-stat`, `practice-prompt`*,
  `practice-answers`/`.primary`, `practice-review`*) — no new CSS file unless needed.
- `src/domain/timedDrill.ts` — `getRemainingSeconds(startMs, durationSeconds, nowMs)`
  and `isDrillOver(...)` (pure; tested in slice 22). Use these for the countdown rather
  than re-deriving time math; drive `nowMs` from `Date.now()` plus a `setInterval`.
- `src/domain/practice.ts` — `createPracticeAttempt`, `summarizePracticeAttempts`,
  `getRandomPracticeHand`.
- `src/types/practice.ts` — `PracticeAttempt`, `PracticeSessionSummary`.
- `src/types/range.ts` — `SavedRange`.

Task — add `src/components/TimedDrillSession.tsx` exporting
`TimedDrillSession({ range, onExit, random = Math.random }: { range: SavedRange;
onExit: (summary: PracticeSessionSummary) => void; random?: () => number })`:
- Phase state `'config' | 'running' | 'done'`.
- CONFIG: a header naming the range, one button per `DRILL_DURATION_OPTIONS` value
  (label e.g. "30s" / "60s" / "120s") that starts the drill at that duration, and a
  "Back to library" button that calls `onExit(summarizePracticeAttempts([]))` (a
  zero summary; the wiring slice's recorder is a no-op for zero attempts).
- RUNNING (on start): record `startMs = Date.now()` and the chosen duration; keep a
  `nowMs` state updated by a `setInterval` (~250ms) so the countdown re-renders.
  Display the remaining seconds via `getRemainingSeconds(startMs, duration, nowMs)`, a
  running tally (answered / correct from the accumulated attempts), the current prompt
  hand, and "In range" / "Out of range" buttons. Answering scores via
  `createPracticeAttempt`, appends the attempt, and IMMEDIATELY advances to a new
  `getRandomPracticeHand(random)` (timed mode shows no per-answer feedback pause — speed
  matters). When `isDrillOver(startMs, duration, nowMs)` becomes true, stop accepting
  answers and move to DONE. Clear the interval on expiry and on unmount (return a
  cleanup from `useEffect`); do not accept answers once over.
- DONE: show the final summary (total / correct / accuracy via
  `summarizePracticeAttempts`), a "Back to library" button calling `onExit(summary)`,
  and a "New drill" button returning to CONFIG (reset attempts/phase).
- Keep all time math in `timedDrill.ts` and all scoring in `practice.ts`; the component
  only orchestrates state, the interval, and rendering.

Tests to add (`src/components/TimedDrillSession.test.tsx`, RTL + Vitest fake timers):
- use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`, and
  set up userEvent with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` so
  clicks work under fake timers;
- CONFIG shows the duration buttons and the range name; "Back to library" calls
  `onExit` (summary with `totalQuestions: 0`);
- starting a drill shows the countdown (e.g. "60" remaining) and the In/Out buttons;
- answering a known in-range hand (use a `random` sequence to force the prompt) updates
  the running correct tally and advances to the next prompt;
- advancing time past the duration with `vi.advanceTimersByTime(...)` moves to the DONE
  summary and the In/Out buttons disappear;
- from DONE, "Back to library" calls `onExit` with the accumulated summary.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY `TimedDrillSession.tsx`, its CSS (if needed), and its
  test. Do NOT modify `App.tsx` or the picker (wiring is slice 24), and do NOT touch
  `PracticeSession`/`BuildFromMemoryPractice`.
- Reuse the `timedDrill` and `practice` domain helpers — do not duplicate time math or
  scoring in the component.
- Always clean up the interval (no leaked timers); guard against scoring after expiry.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add timed-drill practice component`
