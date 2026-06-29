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

## Next slice

**Slice 26 — Weakest-hands view on the practice screen**

Milestone: M5 — Practice depth (web v2–v2.3). (Slice 25 now persists cumulative per-hand
accuracy; this surfaces it. Later M5 slices: the editor-grid accuracy heatmap, a
"practice mistakes only" drill, session history, spaced repetition, multi-action,
build-from-memory, timed/weakness drills, and swipe/haptics.)

Context: `mobile/app/practice.tsx` records each answer into cumulative per-hand accuracy
(slice 25) and shows live session stats + an end-of-session mistakes review (slice 23).
This slice adds a "Weakest hands" section showing the range's lowest-accuracy hands
*cumulatively* (across all sessions, including this one), so the user knows what to drill.
Because answers are recorded per-answer, storage is current after every answer — reload
it after each answer and rank.

Reuse (verified, import — never copy):
- `@core/storage/handAccuracyStorage` `loadHandAccuracy(): Record<string,
  RangeHandAccuracy>` (already used elsewhere; `RangeHandAccuracy` = `Record<PokerHand,
  HandAccuracyStat>`).
- `@core/domain/practice` `rankHandAccuracy(rangeStats: RangeHandAccuracy):
  HandAccuracyStat[]` — ranks attempted hands weakest-first (ascending accuracy, then
  more attempts, then canonical order). And `handAccuracyRate(stat): number` — 0–100
  accuracy for display. Read `src/domain/practice.ts` to confirm.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add state `const [handAccuracy, setHandAccuracy] = useState<RangeHandAccuracy>(() =>
  range ? (loadHandAccuracy()[range.id] ?? {}) : {})` (type from `@core/types/practice`).
  NOTE: `range` comes from a `useState` initializer above; keep hook order stable (no
  early return before this hook — the existing `if (!range)` return is already after the
  hooks).
- In the `answer` handler, after the existing `recordHandAccuracy(...)` call, refresh:
  `setHandAccuracy(loadHandAccuracy()[range.id] ?? {})` (storage is current because
  recording is per-answer).
- Compute `const weakest = useMemo(() => rankHandAccuracy(handAccuracy).slice(0, 6),
  [handAccuracy])`. Render a "Weakest hands" section (e.g. below the session review) when
  `weakest.length > 0`: a wrapping row of chips, each showing the hand and its
  `handAccuracyRate(stat).toFixed(0)`% (reuse the slice-23 review chip styles). Container
  `testID="weakest-hands"`. Render nothing when empty.
- Presentational + a storage reload; do not change scoring/draw/record logic or existing
  testIDs.

Test (extend `mobile/__tests__/practice-screen.test.tsx`):
- With the all-169-hands range, render, read `practice-hand`, press `answer-out` (wrong),
  wait for `stat-total` = "Total: 1", then assert `weakest-hands` is shown and contains
  the just-answered hand and "0%". (Pattern: read the hand string before pressing, like
  the existing per-hand-accuracy test.)
- Assert `weakest-hands` is absent before any answer (`queryByTestId('weakest-hands')`
  is null).
- IMPORTANT (test hygiene): when a test presses the answer buttons more than once, `await`
  each press to settle (e.g. `waitFor` on `stat-total`) before the next — back-to-back
  un-awaited `fireEvent.press` calls overlap React `act()` scopes and can corrupt the
  scheduler for *later* tests in the file (this caused a slice-25 failure; the fix was to
  await between presses). Single press + `waitFor` is fine.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `rankHandAccuracy` + `handAccuracyRate` (no hand-rolled
ranking); cumulative data comes from `loadHandAccuracy()`; UI/screen logic stays in
`mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): show weakest hands on the practice screen`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
