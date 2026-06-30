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

## Next slice

**Slice 28 — Per-hand accuracy heatmap (`HandHeatmap`) on the practice screen**

Milestone: M5 — Practice depth (web v2–v2.3). (Builds on slices 25–27. Later M5 slices:
session history, spaced repetition, multi-action editor, build-from-memory, timed/weakness
drills, and swipe/haptics. Session-boundary features — history, spaced repetition — still
need an explicit session-end trigger on mobile, since this RNTL setup does not run effect
cleanup on unmount and a killed app won't either; defer those until that trigger exists.)

Context: the practice screen holds the range's cumulative per-hand accuracy in
`handAccuracy` state (refreshed after each answer). The web surfaces accuracy as a
read-only 13×13 **heatmap** in a separate component (`src/components/HandHeatmap.tsx`,
non-interactive, colored by `accuracyHeatLevel`). This slice authors the RN parallel and
shows it on the practice screen.

Reuse (verified, import — never copy):
- `@core/domain/pokerHands` `generateHandMatrix()` (13×13 order; `.flat()` for the 169
  hands) — already used by `HandGrid`.
- `@core/domain/practice` `accuracyHeatLevel(stat: HandAccuracyStat | undefined):
  'untested' | 'low' | 'medium' | 'high'` and `handAccuracyRate(stat): number`. Read
  `src/domain/practice.ts` + `src/components/HandHeatmap.tsx` to mirror behavior.
- Type `RangeHandAccuracy` from `@core/types/practice`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- New component `mobile/components/HandHeatmap.tsx`: props `{ accuracy: RangeHandAccuracy }`.
  Render a 13×13 grid (full width, `aspectRatio: 1`, like `HandGrid`'s container) of
  non-interactive `Text`/`View` cells in `generateHandMatrix()` order. Each cell colored
  by `accuracyHeatLevel(accuracy[hand])`. Mirror the web's dark heat palette: untested →
  `colors.surface` bg / `colors.text`; low → `#da3633` bg, `#fff`; medium → `#bb8009` bg,
  `#1c1400`; high → `#238636` bg, `#fff`. Each cell `testID={`heat-cell-${hand}`}` and
  expose the level for tests/a11y via `accessibilityValue={{ text: level }}` (and
  `accessibilityLabel={hand}`). Keep heat colors local to this component (UI only).
- In `practice.tsx`, render `<HandHeatmap accuracy={handAccuracy} />` inside a titled
  "Accuracy heatmap" section (container `testID="accuracy-heatmap"`) shown only when the
  range has at least one attempted hand (`Object.keys(handAccuracy).length > 0`), e.g.
  below the weakest-hands section.
- Presentational; no change to scoring/draw/record logic or existing testIDs.

Tests:
- New `mobile/__tests__/hand-heatmap.test.tsx`: render `HandHeatmap` with an accuracy map
  where one hand (e.g. `AA`) has `{ hand:'AA', attempts:2, correct:0, falsePositives:0,
  falseNegatives:2 }` (rate 0 ⇒ low) and another (e.g. `KK`) has `{ ..., attempts:2,
  correct:2, ... }` (rate 100 ⇒ high). Assert `getAllByTestId(/^heat-cell-/)` has length
  169; assert `heat-cell-AA` accessibilityValue.text is `'low'`, `heat-cell-KK` is
  `'high'`, and an absent hand (e.g. `heat-cell-72o`) is `'untested'`.
- Extend `mobile/__tests__/practice-screen.test.tsx`: assert `accuracy-heatmap` is absent
  before any answer; after one `answer-out` (single press + `waitFor` on `stat-total`),
  assert `accuracy-heatmap` is present. (Test hygiene: await each press before the next.)

Files: add `mobile/components/HandHeatmap.tsx`, `mobile/__tests__/hand-heatmap.test.tsx`;
modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`. No `src/`
edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `accuracyHeatLevel` + `handAccuracyRate` + `generateHandMatrix`
(no hand-rolled heat bucketing or matrix); the new component is presentational RN UI in
`mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add a per-hand accuracy heatmap to practice`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
