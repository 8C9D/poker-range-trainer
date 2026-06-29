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

## Next slice

**Slice 24 — Persist recognition practice results to per-range stats on session end**

Milestone: M5 — Practice depth (web v2–v2.3). (Later M5 slices: per-hand accuracy +
weakest-hands view + heatmap, "practice mistakes only", session history, spaced
repetition, multi-action, build-from-memory, timed/weakness drills, a practice-mode
picker, and swipe/haptics. This slice is the foundational persistence step those build
on — the mobile equivalent of the web's `handleEndPractice` recording.)

Context: `mobile/app/practice.tsx` runs recognition practice, keeps the session's
`PracticeAttempt[]` in component state, and shows live stats plus (slice 23) an
end-of-session mistakes review — but it **persists nothing**. The library home screen
(`mobile/app/index.tsx`) already reads `loadPracticeStats()` to show per-range stat
cards (slice 22) and to power the "Practiced"/"Accuracy" sorts (slice 18), yet nothing
in mobile ever calls `recordPracticeSession`, so those are always empty on device. The
web persists in `App.tsx`'s `handleEndPractice` by folding
`summarizePracticeAttempts(attempts)` into `recordPracticeSession(rangeId, summary)`
when leaving practice. This slice mirrors just that one recorder on mobile (per-hand
accuracy, session history, and spaced repetition are separate later M5 slices).

Reuse (verified, import — never copy):
- `@core/storage/practiceStatsStorage` `recordPracticeSession(rangeId: string, summary:
  Pick<PracticeSessionSummary, 'totalQuestions' | 'correctAnswers'>, timestamp?:
  string): void` — folds one finished session's totals into cumulative per-range stats;
  **no-op when `summary.totalQuestions <= 0`** (so leaving without answering records
  nothing). It *adds* the session totals, so it must be called exactly once per session.
  Read `src/storage/practiceStatsStorage.ts` to confirm.
- `@core/domain/practice` `summarizePracticeAttempts` (already imported in `practice.tsx`).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `practice.tsx`, persist the finished session **exactly once when the screen is
  left** (unmount). Keep a ref holding the latest `attempts` (assign
  `attemptsRef.current = attempts` on each render), and add a
  `useEffect(() => () => { … }, [])` whose cleanup, when a `range` exists, calls
  `recordPracticeSession(range.id, summarizePracticeAttempts(attemptsRef.current))`.
  Because the recorder is a no-op at 0 questions, mounting and leaving without answering
  writes nothing. Do NOT record on every attempt (that double-counts).
- Do not change scoring/draw/review logic or any existing testIDs.

Test (extend `mobile/__tests__/practice-screen.test.tsx`; import `loadPracticeStats`
from `@core/storage/practiceStatsStorage`):
- With the all-169-hands range, render, answer twice (one `answer-in`, one `answer-out`),
  then `unmount()`; assert `loadPracticeStats()['r1']` has `totalAttempts: 2` and
  `correctAttempts: 1` (in-range "in" is correct; in-range "out" is wrong).
- Assert a no-answer session records nothing: render then `unmount()` with no presses,
  and assert `loadPracticeStats()` has no `r1` entry.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `recordPracticeSession` + `summarizePracticeAttempts` (no
hand-rolled stat folding); record once on session-end only; persistence goes through the
reused storage module; UI/screen logic stays in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): persist practice session results to per-range stats`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
