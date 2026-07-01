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

## Next slice

**Slice 31 — Swipe-to-answer + haptics on recognition practice (native upgrade)**

Milestone: M5 — Practice depth (web v2–v2.3). The roadmap explicitly calls for "swipe-to-
answer (RN gestures) and `expo-haptics` feedback — the native upgrade over the web swipe."
Self-contained; no session-boundary trigger needed. (Remaining M5 after this: weakness-
focused drill — note it overlaps the slice-27 mistakes-only toggle, so reconsider its value;
session history and spaced repetition + due-today + streak — both still need a session-end
trigger decision on mobile [explicit "End session" button vs. expo-router `useFocusEffect`
blur]; and the multi-action editor + action palette + per-action accuracy + action notation,
a larger multi-slice feature. After M5, M6 advanced training begins.)

Context: `mobile/app/practice.tsx` answers via two `Pressable`s (`answer-in`/`answer-out`)
calling `answer(boolean)`. This slice adds a horizontal swipe over the hand card as a second
way to answer — swipe right = in range, swipe left = out of range — with a light haptic tap
on each answer. Keep the buttons (accessibility + testability); the swipe is additive.

New dependency: `expo-haptics` (Expo module; bundles via `expo export`). Run `npm install`
in `mobile/` after adding it. Haptics cannot be verified headlessly (no device) — test the
swipe-decision logic and wiring, and rely on the bundle-check for integration; do not claim
the haptic itself was verified.

Reuse / structure (reuse `@core`; new UI logic is mobile-only):
- Add a small pure helper, e.g. `mobile/components/swipeAnswer.ts`
  `resolveSwipeAnswer(translationX: number, threshold = 60): 'in' | 'out' | null` — right
  past +threshold ⇒ `'in'`, left past −threshold ⇒ `'out'`, otherwise `null`. Pure and
  unit-tested (mirrors how `HandGrid`'s `handAtPoint` is extracted + tested while the
  gesture itself is not).
- In `practice.tsx`, wrap the hand card in a `GestureDetector` with a `Gesture.Pan()` (use
  `activeOffsetX([-20, 20])` so it doesn't fight vertical scroll / button taps). On end,
  `const a = resolveSwipeAnswer(e.translationX); if (a) { answer(a === 'in'); }` and fire
  `Haptics.selectionAsync()` (or `impactAsync(ImpactFeedbackStyle.Light)`). Follow
  `HandGrid`'s ref pattern (`onSetSelectedRef`) so the long-lived gesture reads the latest
  `answer` without rebuilding each render, and the existing `react-hooks/refs` eslint-disable
  block style. The root already has `GestureHandlerRootView` (in `_layout.tsx`).
- Keep all scoring/recording in the existing `answer` callback — the swipe just calls it.

Tests:
- New `mobile/__tests__/swipe-answer.test.ts`: assert `resolveSwipeAnswer(100)==='in'`,
  `resolveSwipeAnswer(-100)==='out'`, `resolveSwipeAnswer(10)===null`,
  `resolveSwipeAnswer(-10)===null`, and the threshold boundary.
- `mobile/__tests__/practice-screen.test.tsx` already covers `answer()` via the buttons;
  no gesture simulation needed. If you mock `expo-haptics`, add
  `jest.mock('expo-haptics')` (or a manual mock under `__mocks__/expo-haptics.ts` returning
  no-op async fns) so the import resolves under Jest. Verify the existing practice tests
  still pass.

Files: add `mobile/components/swipeAnswer.ts`, `mobile/__tests__/swipe-answer.test.ts`
(+ `mobile/__mocks__/expo-haptics.ts` if needed); modify `mobile/app/practice.tsx`,
`mobile/package.json` (+ `package-lock.json`). No `src/` edits.

Validation (mobile only): `npm install` (new dep), then `npm run lint`, `npm run typecheck`,
`npm run test:run`, `npm run bundle-check` — all must pass.

Constraints: the swipe is additive (buttons stay); decision logic is a pure tested helper;
gesture wiring follows `HandGrid`'s ref pattern; haptics via `expo-haptics`. Do not edit
`src/`. Report honestly that the haptic feedback itself is not headlessly verifiable.

Suggested commit message:
`feat(ios): add swipe-to-answer and haptics to practice`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
