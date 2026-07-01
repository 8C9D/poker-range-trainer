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
| 30 | Timed drill practice mode | M5 | 2026-06-21 |
| 31 | Swipe-to-answer + haptics on recognition practice | M5 | 2026-06-21 |
| 32 | Practice session history (record on explicit End session + view) | M5 | 2026-06-21 |

## Next slice

**Slice 33 — Advance the spaced-repetition schedule on End session**

Milestone: M5 — Practice depth (web v2–v2.3). Reuses the now-established explicit
"End session" trigger (slice 32, user-confirmed — see [[ios-session-end-trigger]]). This is
the *recording* half of spaced repetition; the *viewing* half (due-today + streak on the
library) is the next slice (34). Behavior slice — no visible UI change on this screen; the
payoff is the due-today/streak view in slice 34 (like slices 24–25 persisted data before a
later view consumed it).

Context: `mobile/app/practice.tsx`'s `endSession` callback already records session history
and resets the session. The web's `handleEndPractice` additionally advances the range's
spaced-repetition review state from the session's accuracy
(`scheduleNextReview(prev, summary.accuracyPercentage, reviewedAt)`), persisted via
`saveReviewState`. Mobile must do the same in `endSession`.

Reuse (verified, import — never copy):
- `@core/domain/spacedRepetition` `seedReviewState(rangeId): RangeReviewState` (first
  review) and `scheduleNextReview(prev: RangeReviewState, accuracyPercentage: number,
  reviewedAt: string): RangeReviewState` (low `<50` shrinks ease + 1-day interval; medium
  `50–79` holds; high `>=80` grows ease + multiplies interval; sets `dueAt`).
- `@core/storage/reviewStateStorage` `loadReviewStates(): Record<string, RangeReviewState>`
  and `saveReviewState(state: RangeReviewState): void`.
- `RangeReviewState` from `@core/types/practice` (`{ rangeId, ease, intervalDays, dueAt,
  lastReviewedAt }`). Read `src/domain/spacedRepetition.ts` + `src/App.tsx` (handleEndPractice)
  to mirror.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `endSession`, compute the summary once
  (`const summary = summarizePracticeAttempts(attempts)`), record history with it, and —
  only when `summary.totalQuestions > 0` (don't schedule an empty session) — advance the
  schedule: `const reviewedAt = new Date().toISOString(); const prev =
  loadReviewStates()[range.id] ?? seedReviewState(range.id);
  saveReviewState(scheduleNextReview(prev, summary.accuracyPercentage, reviewedAt));`
- Keep the existing history recording + session reset. No new UI, no changed testIDs.

Test (extend `mobile/__tests__/practice-screen.test.tsx`; import `loadReviewStates` from
`@core/storage/reviewStateStorage`):
- All-169-hands range: answer `answer-in` once (100% accuracy), `await` `stat-total`=1,
  press `end-session`, then assert `loadReviewStates().r1` exists with a non-empty `dueAt`
  and `intervalDays >= 1` (a high-accuracy first review schedules ~1 day out). Optionally
  assert `lastReviewedAt` is non-empty.
- RNTL hygiene: `await render`; `await` each press before the next.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`. No
`src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `scheduleNextReview` + `seedReviewState` + review storage (no
hand-rolled scheduling); schedule only on End session with answered questions; UI/screen
logic stays in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): advance spaced-repetition schedule on session end`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
