# iOS roadmap slice progress

State file for the [`build-ios-app`](../.claude/skills/build-ios-app/SKILL.md)
skill. The skill reads this file on every invocation to find the next slice to
build, and rewrites it as part of each committed slice. You can hand-edit the
**Next slice** prompt below to steer what gets built next — the skill uses
whatever is here.

- Scope and ordering come from [`ios-roadmap.md`](./ios-roadmap.md).
- Project rules (validation, commit style, separation of concerns) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- This is a **separate track** from the web roadmap's
  [`roadmap-progress.md`](./roadmap-progress.md); the two never collide.
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken
  in milestone order — never a whole milestone at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline

Nothing built yet. The web app (`src/`) is complete through web-roadmap v6 and is
the source of the reusable `@core` logic. The iOS app does not exist; `mobile/`
has not been created.

The first target is **M0 — Foundation: Expo app + shared-core reuse**.

## Completed slices

| # | Slice | Milestone | Date |
|---|-------|-----------|------|
| 1 | Scaffold Expo app in `mobile/` with isolated toolchain | M0 | 2026-06-13 |
| 2 | Wire `@core/*` alias + bundle-check; prove shared-core reuse bundles | M0 | 2026-06-13 |
| 3 | Synchronous `localStorage` shim over MMKV (+ `@core/storage` round-trip test) | M1 | 2026-06-13 |
| 4 | Hermes `crypto.randomUUID` polyfill for identity, installed at entry | M1 | 2026-06-13 |
| 5 | Storage parity test: web keys + full backup round-trip through the shim | M1 | 2026-06-13 |
| 6 | Dark theme tokens + themed navigation shell | M2 | 2026-06-14 |
| 7 | 13×13 tap-to-toggle `HandGrid`/`HandCell` reusing the core matrix | M2 | 2026-06-14 |
| 8 | Drag-paint `HandGrid` via gesture handler (+ fix react/renderer version skew) | M2 | 2026-06-14 |
| 9 | Range editor screen: name + grid + live save via `@core` storage | M2 | 2026-06-14 |
| 10 | Range library screen: list / open / edit / delete (home screen) | M2 | 2026-06-14 |
| 11 | Recognition practice screen + session stats (completes M2) | M2 | 2026-06-14 |
| 12 | Live hand/combo/percentage stats bar in the range editor | M3 | 2026-06-14 |
| 13 | Range shortcut buttons (pairs / broadways) in the editor | M3 | 2026-06-14 |
| 14 | Range notation import/export (clipboard) + clear-range (completes M3) | M3 | 2026-06-14 |
| 15 | Scenario metadata editor in the range editor | M4 | 2026-06-14 |
| 16 | Library search by name | M4 | 2026-06-14 |
| 17 | Library metadata filters (position / action / game) | M4 | 2026-06-14 |
| 18 | Library sorts (name / recent / practiced / accuracy) | M4 | 2026-06-14 |
| 19 | Duplicate a range from the library | M4 | 2026-06-14 |
| 20 | Favorite toggle + favorites filter in the library | M4 | 2026-06-14 |
| 21 | Archive ranges (hide-by-default + show-archived toggle) | M4 | 2026-06-15 |
| 22 | Per-range practice stats on library cards (completes M4) | M4 | 2026-06-15 |
| 23 | End-of-session mistakes review in recognition practice (opens M5) | M5 | 2026-06-15 |
| 24 | Persist recognition practice results into per-range practice stats | M5 | 2026-06-15 |
| 25 | Persist per-hand accuracy from recognition practice | M5 | 2026-06-15 |
| 26 | Weakest-hands view on the practice screen | M5 | 2026-06-15 |
| 27 | "Practice mistakes only" drill toggle on the practice screen | M5 | 2026-06-15 |
| 28 | Per-hand accuracy heatmap (`HandHeatmap`) on the practice screen | M5 | 2026-06-15 |
| 29 | Build-from-memory practice mode + practice-mode picker | M5 | 2026-06-21 |

## Next slice

**Slice 30 — Timed drill practice mode**

Milestone: M5 — Practice depth (web v2–v2.3). Next roadmap M5 item after build-from-memory.
Adds a third mode to the already-built practice-mode picker (slice 29) — no new navigation
decision. (Later M5 slices: weakness-focused drill, session history, spaced repetition +
due-today + streak, multi-action editor, and swipe-to-answer + haptics. Session-boundary
features — history, spaced repetition — still need an explicit session-end trigger on
mobile; defer them.)

Context: recognition practice (`mobile/app/practice.tsx`) shows a random hand and the user
answers in/out, scoring via `@core/domain/practice` and recording per answer. A timed
drill is the same answer loop under a fixed countdown: "answer as many as you can before
the clock runs out." The countdown math is a pure, tested `@core` module driven by an
injected `now`, so the screen owns only a 1-second tick.

Reuse (verified, import — never copy):
- `@core/domain/timedDrill` `DRILL_DURATION_OPTIONS` (`[30,60,120]` seconds),
  `DEFAULT_DRILL_SECONDS` (`60`), `getRemainingSeconds(startEpochMs, durationSeconds,
  nowEpochMs): number` (whole seconds left, rounds up, clamped to [0, duration]), and
  `isDrillOver(startEpochMs, durationSeconds, nowEpochMs): boolean`. Read
  `src/domain/timedDrill.ts` to confirm.
- `@core/domain/practice` `createPracticeAttempt`, `getRandomPracticeHand`,
  `summarizePracticeAttempts` (as in `practice.tsx`).
- `@core/storage/practiceStatsStorage` `recordPracticeSession` and
  `@core/storage/handAccuracyStorage` `recordHandAccuracy` +
  `@core/domain/practice summarizeHandAccuracy` — record each answer per-answer exactly as
  recognition does (slices 24–25), so timed practice also feeds library stats/heatmaps.
- `@core/storage/rangeStorage` `findSavedRangeById`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- New screen `mobile/app/timed.tsx` (Expo Router route `/timed`, param `id`). States:
  `range` (from `findSavedRangeById`, once), a chosen `durationSeconds` (default
  `DEFAULT_DRILL_SECONDS`), `startEpochMs: number | null` (null = not started), `nowEpochMs`
  (drives the displayed countdown), `hand`, `attempts`, `lastAttempt`.
- Pre-start: render duration chips from `DRILL_DURATION_OPTIONS` (testID
  `duration-<n>`, selected style) and a "Start" button (`testID="timed-start"`) that sets
  `startEpochMs = Date.now()`, `nowEpochMs = Date.now()`, and draws the first hand.
- Running: a `useEffect` (deps `[startEpochMs, durationSeconds]`) starts a
  `setInterval(() => setNowEpochMs(Date.now()), 250)` and clears it on cleanup; guard so it
  only runs while started and not over. Show `getRemainingSeconds(startEpochMs,
  durationSeconds, nowEpochMs)` as `testID="timed-remaining"`. Answer buttons (`answer-in`,
  `answer-out`) score via `createPracticeAttempt`, append to `attempts`, set `lastAttempt`,
  draw the next hand, and record per-answer (recordPracticeSession + recordHandAccuracy) —
  but ignore answers once `isDrillOver(...)`.
- Over (`isDrillOver(startEpochMs, durationSeconds, nowEpochMs)`): stop the interval, hide
  the answer buttons, and show final `summarizePracticeAttempts(attempts)` (reuse the
  `stat-total`/`stat-correct`/`stat-accuracy` labels) plus a `testID="timed-over"` "Time's
  up" note and a "Practice again" button (`testID="timed-restart"`) that resets to the
  pre-start state.
- Add a third mode to `mobile/app/practice-modes.tsx`: a `Link` to `/timed?id=` with
  `testID="mode-timed"`, title "Timed drill", desc "Answer as many as you can before the
  clock runs out."
- Reuse `@core`; no new dependency.

Tests:
- New `mobile/__tests__/timed-screen.test.tsx` (mock `react-native-mmkv` + `expo-router`
  like `practice-screen.test.tsx`; seed the all-169-hands range so every prompt is in
  range). Use fake timers + a controlled clock:
  - `jest.useFakeTimers()` and `jest.setSystemTime(0)` in `beforeEach`; restore real timers
    in `afterEach`. The screen reads `Date.now()`, which fake timers control.
  - Render, press `timed-start`, answer `answer-in` once and `await waitFor` that
    `stat-total` shows 1 (await before any further press — RNTL act hygiene).
  - Advance the clock past the drill: wrap `jest.setSystemTime(durationMs + 1000)` then
    `jest.advanceTimersByTime(300)` in `act(...)`, and `await waitFor` that `timed-over`
    appears and `answer-in` is gone (`queryByTestId` null).
  - Assert `loadPracticeStats().r1.totalAttempts === 1` (the one answer was recorded).
- Extend `mobile/__tests__/practice-modes-screen.test.tsx` to assert `mode-timed` renders.

RNTL/timer test hygiene (learned slices 24–28, applies here):
- `render(...)` is async — `await` it; `await` each `fireEvent.press` to settle before the
  next (back-to-back un-awaited presses overlap React `act()` and corrupt the scheduler for
  later tests). `toHaveTextContent(str)` is an exact normalized match — assert full text.
- With fake timers, advance the clock inside `act(() => { ... })` so React flushes the
  interval's state update; combine `setSystemTime` (controls `Date.now()`) with
  `advanceTimersByTime` (fires the interval).

Files: add `mobile/app/timed.tsx`, `mobile/__tests__/timed-screen.test.tsx`; modify
`mobile/app/practice-modes.tsx`, `mobile/__tests__/practice-modes-screen.test.tsx`. No
`src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `timedDrill` for all countdown math (no hand-rolled remaining/
over logic) and `@core` practice/storage for scoring + recording; screen in `mobile/app/`.
Do not edit `src/`.

Suggested commit message:
`feat(ios): add a timed drill practice mode`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
