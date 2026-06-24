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

## Next slice

**Slice 8 — Drag-paint the `HandGrid` via gesture handler (+ align API to the web's `onSetSelected`)**

Milestone: M2 — Core trainer MVP (parity with web v1).

Context: slice 7 shipped the controlled 13×13 `HandGrid`
(`mobile/components/HandGrid.tsx`) with tap-to-toggle via `onToggleHand` and a
memoized `HandCell` (`testID=hand-cell-<hand>`, `accessibilityState.selected`).
This slice adds **drag-to-paint** and aligns the grid's API to the web reference
so the two stay behavior-identical. The grid is still unused by any screen, so the
API change is low-cost.

Web reference (`src/components/HandGrid.tsx`, verified): props are
`{ selected: ReadonlySet<PokerHand>; onSetSelected: (hand, selected: boolean) =>
void }`. **Paint model:** the first cell pressed decides the gesture's mode —
press an *unselected* hand ⇒ mode `select`, a *selected* hand ⇒ mode `deselect`;
every cell crossed during the drag is **set** to that one target state (an
idempotent set, not a toggle), so re-entering a hand mid-drag never flips it. A
plain tap sets the cell to the opposite of its current state (`onSetSelected(hand,
!selected.has(hand))`).

`react-native-gesture-handler` is already present (v3.0.1, transitive via
expo-router); declare it directly with `npx expo install
react-native-gesture-handler`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- **API alignment:** change `HandGrid`'s prop `onToggleHand` →
  `onSetSelected: (hand: PokerHand, selected: boolean) => void`. Tap path:
  `onPress={() => onSetSelected(hand, !selected.has(hand))}`. Update
  `mobile/__tests__/hand-grid.test.tsx` for the new prop (assert
  `onSetSelected('AA', true)` when AA is unselected, and `('AA', false)` when AA is
  in `selected`).
- **Coordinate mapping:** add a pure exported helper, e.g.
  `handAtPoint(x: number, y: number, gridSize: number): PokerHand | null`, that maps
  a touch point within the square grid to a hand using the module's
  `generateHandMatrix()` (cell = `gridSize / 13`; `col = floor(x / cell)`,
  `row = floor(y / cell)`; clamp/return `null` when `gridSize <= 0` or indices fall
  outside 0..12). Keep it independent of React so it is easily unit-tested.
- **Drag-paint:** measure the grid square via `onLayout` (store side length), wrap
  the grid in `<GestureDetector>` with a `Gesture.Pan()`. Use
  `.activeOffsetX([-10, 10])` / `.activeOffsetY([-10, 10])` so a stationary tap
  stays a `Pressable` tap and only real movement activates the pan (prevents
  double-application). `onStart`: compute the first hand from the gesture x/y,
  set paint mode = `!selected.has(firstHand)`, paint it, and record it.
  `onUpdate`: compute the hand under the finger; if it changed and was not yet
  painted this drag, set it to the paint mode. `onEnd`/`onFinalize`: reset the
  per-drag state. Track paint mode + the painted set in refs. Note: keep the
  gesture callbacks on the JS thread (no reanimated worklets) so `onSetSelected`
  can be called directly; if RNGH requires it, wrap calls in `runOnJS`.
- **Root view:** wrap the app root in `<GestureHandlerRootView style={{ flex: 1 }}>`
  in `mobile/app/_layout.tsx` (required for gestures on iOS); keep the
  storage/crypto side-effect imports first and the themed Stack inside it.
- **Tests** (`mobile/__tests__/hand-grid.test.tsx`): unit-test `handAtPoint`
  thoroughly (each corner → AA / A2s / A2o-region / 22 per the matrix, the center,
  and out-of-bounds → null). Keep/adjust the tap + selected-state + disabled tests
  for the new API. (Full pan simulation is optional — RNGH ships
  `react-native-gesture-handler/jest-utils` `fireGestureHandler` if you want it, but
  the pure `handAtPoint` test is the reliable coverage for the paint mapping.)

Files to create/modify:
- Modify: `mobile/components/HandGrid.tsx` (API + gesture + `handAtPoint`),
  `mobile/__tests__/hand-grid.test.tsx`, `mobile/app/_layout.tsx`
  (`GestureHandlerRootView`), `mobile/package.json` + `mobile/package-lock.json`
  (declare react-native-gesture-handler).

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- Run `npm install` in `mobile/` first, then `npm run lint`, `npm run typecheck`,
  `npm run test:run`, and `npm run bundle-check` — all must pass. Confirm
  `bundle-check` still produces the iOS bundle (gesture-handler is bundled once a
  screen imports the grid; importing it in the test/graph is enough to typecheck).

Constraints: grid stays controlled (parent owns selection); reuse the core matrix;
match the web paint semantics exactly; RN UI in `mobile/components/`. Keep it
minimal and reversible. Do not edit anything under `src/`.

Suggested commit message:
`feat(ios): add drag-paint to HandGrid via gesture handler`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
