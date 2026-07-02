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
| 33 | Advance spaced-repetition schedule on End session | M5 | 2026-06-21 |

## Next slice

**Slice 34 — Due-for-review badge + practice streak on the library**

Milestone: M5 — Practice depth (web v2–v2.3). The *viewing* half of spaced repetition
(slice 33 records the schedule; this surfaces it). Completes the spaced-repetition feature.

Context: `mobile/app/index.tsx` (the library/home screen) already loads `practiceStats` and
renders per-range cards with sorts/filters. Slice 33 now writes per-range review states
(`dueAt`) on End session, and session history holds per-session `playedAt` timestamps. This
slice surfaces two spaced-repetition signals: a **streak** header and a **"Due"** badge on
cards that are scheduled and now due.

Reuse (verified, import — never copy):
- `@core/domain/spacedRepetition` `isReviewDue(state: RangeReviewState, now: string):
  boolean` (a never-scheduled `dueAt:''` is never due) and `currentStreak(reviewTimestamps:
  string[], today: string): number` (consecutive UTC days with ≥1 review; empty ⇒ 0). Read
  `src/domain/spacedRepetition.ts` to confirm.
- `@core/storage/reviewStateStorage` `loadReviewStates()`; `@core/storage/sessionHistoryStorage`
  `loadSessionHistory()` (flatten all records' `playedAt` for the streak).

Design note (intentional): use `isReviewDue` for the per-card badge — NOT `selectDueRanges`,
which also counts never-reviewed ranges as "due" and would badge nearly every card on a
fresh install. The badge should mean "you've practiced this and it's due again," the
meaningful spaced-rep reminder. (If a "Due today" *filter* is wanted later, that can use
`selectDueRanges`.)

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `index.tsx`, load review states + session history alongside `practiceStats` (add to the
  same `useState` initializers and the `reload` callback so they refresh on focus). Compute
  `now = new Date().toISOString()` per render.
- Streak: `const streak = currentStreak(Object.values(loadSessionHistory()).flat().map(r =>
  r.playedAt), now)` (memoize on the loaded history). When `streak > 0`, show a header line
  (`testID="practice-streak"`) like "🔥 {streak}-day streak" above the list.
- Due badge: for each card, when `reviewStates[item.id]` exists and `isReviewDue(it, now)`,
  render a small "Due" badge (`testID={`due-${item.id}`}`) in the row. Style like the
  existing stat/favorite accents; keep it unobtrusive.
- Presentational + loads; do not change existing list/sort/filter logic or testIDs.

Tests (extend `mobile/__tests__/library-screen.test.tsx`; it already mocks mmkv + expo-router;
import what you need from `@core`):
- Due badge: seed a range, then write a review state with a past `dueAt` (import
  `saveReviewState` + `seedReviewState`/build a `RangeReviewState` with `dueAt` =
  `'2020-01-01T00:00:00.000Z'`, `lastReviewedAt` set). Render; assert `due-<id>` is shown.
  Seed a second range with a far-future `dueAt`; assert its `due-<id>` is absent.
- Streak: record two session-history entries (`recordPracticeSessionHistory`) dated today and
  yesterday (pass explicit `playedAt`), render, and assert `practice-streak` shows. (Compute
  "today"/"yesterday" from `new Date()` so it isn't clock-fragile, or assert the element is
  present + contains "streak".)
- RNTL hygiene: `await render`; `fireEvent` is fine for single interactions here.

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`. No `src/`
edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `isReviewDue` + `currentStreak` + review/history storage (no
hand-rolled due/streak logic); badge uses `isReviewDue` (not `selectDueRanges`); UI stays in
`mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): show due-for-review badge and practice streak in the library`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
