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
| 35 | Multi-action editor foundation (palette + action grid + screen) | M5 | 2026-06-21 |
| 36 | Preserve overlay fields when saving from the binary editor (fix) | M5 | 2026-06-21 |
| 37 | Action quiz practice mode (per-action accuracy) | M5 | 2026-06-21 |

## Next slice

**Slice 38 — Action notation import/export on the action editor (completes M5)**

Milestone: M5 — Practice depth (web v2–v2.3). Last slice of the multi-action cluster; with it,
**M5 is complete** (the next slice opens M6 — Advanced training).

Context: `mobile/app/action-editor.tsx` (slice 35) edits `handActions` via the palette + grid.
This adds a text import/export panel for the action overlay, the action-grouped parallel of
the binary `RangeNotation` component (slice 14). Reuse the existing `RangeNotation` mobile
component as the structural template.

Reuse (verified, import — never copy):
- `@core/domain/actionRange` `formatActionNotation(handActions): string` (one
  `"{Label}: {hands}"` line per action with hands, canonical order; "" when empty) and
  `parseActionNotation(input): Record<PokerHand, RangeAction>` (inverse; THROWS on a line
  without a colon, an unknown action label, invalid hand notation, or a hand assigned to two
  actions — surface the message). Read `src/domain/actionRange.ts`.
- `expo-clipboard` (already a dependency, used by `mobile/components/RangeNotation.tsx`).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- New `mobile/components/ActionNotation.tsx` modeled on `RangeNotation.tsx`: props
  `{ handActions: Record<PokerHand, RangeAction>; onReplaceActions: (handActions:
  Record<PokerHand, RangeAction>) => void }`. Read-only "Current actions" = `formatActionNotation`
  (`testID="action-notation-current"`, with a `action-notation-copy` button). A multiline input
  (`testID="action-notation-input"`), a `action-notation-paste` button, and an
  `action-notation-apply` button that runs `parseActionNotation(input)` and calls
  `onReplaceActions` on success, or shows the thrown message in `action-notation-error` on
  failure (leaving the current overlay untouched, exactly like `RangeNotation`).
- In `action-editor.tsx`, render `<ActionNotation handActions={handActions}
  onReplaceActions={setHandActions} />` (below the grid / count). Applying notation replaces
  the overlay, which the existing live-save effect then persists.
- Reuse `@core` for all formatting/parsing; clipboard wiring mirrors `RangeNotation`.

Tests:
- New `mobile/__tests__/action-notation.test.tsx` (mock `expo-clipboard` like
  `editor-screen.test.tsx`): render with a `handActions` map; assert `action-notation-current`
  shows the formatted text (e.g. contains "Raise:"). Type valid notation (e.g. "Call: 22\nRaise:
  AA") into the input, press Apply, and assert `onReplaceActions` was called with the parsed map
  (`{ '22': 'call', AA: 'raise' }`). Type invalid notation (e.g. "Nonsense") and assert
  `action-notation-error` appears and `onReplaceActions` was NOT called again.
- RNTL hygiene ([[ios-mobile-toolchain]]): `await render`; `fireEvent.changeText` + press;
  `toHaveTextContent` is exact (assert a substring via a scoped element or a regex matcher).

Files: add `mobile/components/ActionNotation.tsx`, `mobile/__tests__/action-notation.test.tsx`;
modify `mobile/app/action-editor.tsx`. No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `formatActionNotation` + `parseActionNotation` (no hand-rolled
action notation); model on `RangeNotation`; UI in `mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add action notation import/export to the action editor`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- After M5, **M6 — Advanced training** (board texture, made-hand/draw categorization,
  range-vs-board, postflop practice, combo/blocker depth, mixed-frequency editor + quiz +
  notation, range diff, per-hand notes, CSV import).
