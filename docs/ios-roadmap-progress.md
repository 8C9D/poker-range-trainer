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
| 34 | Due-for-review badge + practice streak on the library | M5 | 2026-06-21 |

## Next slice

**Slice 35 — Multi-action editor foundation: action palette + action grid (opens the M5
multi-action cluster)**

Milestone: M5 — Practice depth (web v2–v2.3). This is the FIRST slice of the multi-action
cluster (later slices: per-action accuracy practice / "ActionQuiz"; action notation
import/export; and the mixed-frequency editor + quiz belong to M6). It lets a range tag each
hand with a `RangeAction` (raise/call/fold/3-bet/…) — the `handActions` overlay — beyond the
binary in/out grid.

⚠️ DESIGN DECISION (confirm before building — flagged for the user): WHERE does action
editing live on mobile? The binary editor (`mobile/app/editor.tsx`) is already long (name,
stats bar, shortcuts, grid, notation, metadata, clear). Options: (1) **a dedicated "Edit
actions" screen** reached from a button in the editor (RECOMMENDED — keeps each grid full-
width and uncluttered; mirrors the web's separate `MultiActionEditor`); (2) integrate a
second action grid + palette inline below the binary grid in `editor.tsx` (everything in one
place, but a very long screen); (3) make actions a separate top-level entry from the library
card. Recommended: option 1. Confirm before building; the components below are the same
regardless of entry point.

Reuse (verified, import — never copy):
- `@core/types/range` `RANGE_ACTIONS`, `RANGE_ACTION_LABELS`, `type RangeAction`, and
  `SavedRange.handActions?: Record<PokerHand, RangeAction>`.
- `@core/domain/actionRange` `assignedHands(handActions)`, `handsForAction(handActions,
  action)`, `actionRangePercentage(...)` (for live counts). Read `src/domain/actionRange.ts`
  + `src/components/ActionPalette.tsx` / `ActionGrid.tsx` / `MultiActionEditor.tsx` to mirror.
- `@core/domain/pokerHands` `generateHandMatrix` (reuse, as `HandGrid`/`HandHeatmap` do);
  `@core/storage/rangeStorage` `findSavedRangeById` + `saveSavedRange`.

Task (mobile-only; reuse `@core`, do not edit `src/`) — recommended (option 1):
- New `mobile/components/ActionPalette.tsx`: a labelled row of action chips from
  `RANGE_ACTIONS`/`RANGE_ACTION_LABELS`; one is the active action (selected style); tapping
  selects it. testIDs `action-chip-<action>`. (Model on `ChipRow`, but single-select with a
  required value.)
- New `mobile/components/ActionGrid.tsx`: a controlled 13×13 grid (reuse `generateHandMatrix`,
  mirror `HandGrid`'s layout) where each cell shows the hand colored by its assigned action
  (a per-action color map kept local to the component, UI-only); tapping a cell assigns the
  active action, tapping an already-that-action cell clears it. Props: `{ handActions,
  activeAction, onAssign(hand, action|null) }`. testIDs `action-cell-<hand>`. (Drag-paint can
  come later; tap-to-assign is enough for this slice.)
- New screen `mobile/app/action-editor.tsx` (route `/action-editor`, param `id`): load the
  range, hold a `handActions` map in state, render `ActionPalette` + `ActionGrid` + a live
  "N hands assigned" line (`assignedHands(...).length`), and live-save `handActions` onto the
  range via `saveSavedRange` (preserve all other fields). Add an "Edit actions" `Link`
  (`testID="edit-actions"`) in `editor.tsx` to `/action-editor?id=<draft.id>`.
- Reuse `@core` for all action math; colors/labels are UI-only mobile.

Tests:
- `mobile/__tests__/action-palette.test.tsx`: renders all `RANGE_ACTIONS` chips; tapping one
  calls `onSelect` with that action.
- `mobile/__tests__/action-grid.test.tsx`: tapping `action-cell-AA` calls `onAssign('AA',
  activeAction)`; tapping it again (when already that action) calls `onAssign('AA', null)`.
- `mobile/__tests__/action-editor-screen.test.tsx` (mock mmkv + expo-router; seed a range):
  select an action, tap a hand cell, and assert the range's `handActions` persisted via
  `loadSavedRanges`/`findSavedRangeById`. Use `userEvent` for multi-interaction (per the
  editor test) and the RNTL hygiene notes ([[ios-mobile-toolchain]]).

Files: add `mobile/components/ActionPalette.tsx`, `mobile/components/ActionGrid.tsx`,
`mobile/app/action-editor.tsx`, the three test files; modify `mobile/app/editor.tsx`. No
`src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` action types + `actionRange` domain (no hand-rolled action math);
new RN UI in `mobile/components/`, screen in `mobile/app/`; `handActions` persists through
`@core` storage. Do not edit `src/`.

Suggested commit message:
`feat(ios): add a multi-action range editor (palette + action grid)`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
