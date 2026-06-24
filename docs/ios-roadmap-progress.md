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

## Next slice

**Slice 7 — `HandGrid` + `HandCell`: 13×13 tap-to-toggle grid reusing the core matrix**

Milestone: M2 — Core trainer MVP (parity with web v1).

Context: slice 6 added the dark theme (`mobile/theme/colors.ts`) and themed Stack
shell. This slice builds the central UI primitive — the 13×13 starting-hand grid —
as a **controlled, reusable** component. A later M2 slice (range editor) wires it
to range state; **drag-paint (slice 8) layers gesture support on top**, so keep
this slice **tap-only, with no new dependency**.

Reuse (verified): `@core/domain/pokerHands` exports
`generateHandMatrix(): PokerHand[][]` — 13 rows × 13 cols, row-major (pairs on the
diagonal, suited upper-right, offsuit lower-left) — and `type PokerHand = string`.
Build the grid from this matrix; never hardcode the 169 hands. (Pair/suited/offsuit
can be derived from the hand string if tinting is wanted: 2 chars = pair, trailing
`s` = suited, trailing `o` = offsuit — optional polish, not required here.)

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Create `mobile/components/HandGrid.tsx` — a controlled `HandGrid`:
  - Props: `selected: ReadonlySet<PokerHand>`, `onToggleHand: (hand: PokerHand) =>
    void`, optional `disabled?: boolean`.
  - Render 13 rows from `generateHandMatrix()`, each row 13 `HandCell`s. Keep it
    square/responsive (cells `flex: 1` within rows; rows fill the grid width).
  - Each cell: `accessibilityRole="button"`, `accessibilityState={{ selected }}`,
    and `testID={`hand-cell-${hand}`}` for testing.
- `HandCell` (same file or `mobile/components/HandCell.tsx`): a `Pressable` showing
  the hand label; selected = `colors.accent` bg + `colors.onAccent` text, unselected
  = `colors.surface` bg + `colors.text` text, `colors.border` hairline; calls
  `onToggleHand(hand)` on press. Wrap in `React.memo` so toggling one cell doesn't
  re-render all 169 (pass primitive props + a stable handler).
- Add `mobile/__tests__/hand-grid.test.tsx` (RNTL v14 — `await render(...)`, queries
  populate only after the await):
  - Renders all 169 cells (e.g. assert `hand-cell-AA`, `hand-cell-72o` exist, and
    `getAllByTestId(/^hand-cell-/)` has length 169).
  - `fireEvent.press(getByTestId('hand-cell-AA'))` calls `onToggleHand('AA')`.
  - A hand passed in `selected` reflects `accessibilityState.selected === true`.

Files to create/modify:
- Create: `mobile/components/HandGrid.tsx` (+ optional `mobile/components/HandCell.tsx`),
  `mobile/__tests__/hand-grid.test.tsx`.
- Modify: none required (the editor wires it up in a later slice).

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass.

Constraints: the grid is controlled/stateless (the parent owns selection); **no new
dependency** (tap only — gesture drag-paint is slice 8); reuse the core matrix; RN
UI lives in `mobile/components/`. Keep it minimal and reversible. Do not edit
anything under `src/`.

Suggested commit message:
`feat(ios): add 13x13 tap-to-toggle HandGrid reusing the core matrix`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
