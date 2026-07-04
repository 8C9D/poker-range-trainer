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
| 38 | Action notation import/export on the action editor | M5 | 2026-06-21 |
| 39 | Board explorer: board input + flop texture tagging (opens M6) | M6 | 2026-06-21 |
| 40 | Range-vs-board overlay on the board explorer | M6 | 2026-06-21 |
| 41 | Postflop decision practice (bet/check/call/raise/fold on a random spot) | M6 | 2026-06-22 |
| 42 | Combo explorer: enumerate a hand's combos + blocker-aware counts | M6 | 2026-06-22 |

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training** is underway: board explorer
(slice 39), range-vs-board overlay (slice 40), postflop decision practice (slice 41), and the
combo explorer (slice 42 — type a hand to see its concrete combos and how many survive a
board, reached from the board explorer's "Combos" header link). Next in the combo-level cluster:
combo selection (toggling individual combos into a range), then mixed frequencies.

## Next slice

**Slice 43 — `ComboSelector` RN component (toggle individual combos)**

Milestone: M6 — Advanced training (web v4.1 "combo-level precision"). Second unit of the
combo-level cluster, after the read-only combo explorer (slice 42). This slice builds the
controlled, presentational `ComboSelector` component — the combo equivalent of how `HandGrid`
(slice 7) was built as a component before the editor screen (slice 9) wired it up. Persisting
combo selections onto a saved range (`comboSelections`) is the NEXT slice; keep this one to the
component + its test, with no editor/storage integration.

Context: a hand class's concrete combos can each be individually on/off; the selection is a
`Set` of `comboKey`s (order-independent), owned by the parent. The web `ComboSelector`
(`src/components/ComboSelector.tsx`) is exactly this: a controlled grid of per-combo toggle
buttons reflecting on/off state, calling `onToggle(combo)`. Mirror it in RN primitives.

Reuse (verified — read `src/domain/comboSelection.ts` + `src/components/ComboSelector.tsx`
to confirm shapes before building):
- `@core/domain/comboSelection` `type ComboSelection` (= `Set<string>`),
  `isComboSelected(selection, combo): boolean`, `toggleCombo(selection, combo): ComboSelection`,
  `selectedComboCount(selection): number`, `allCombosForHand(hand): ComboSelection`.
- `@core/domain/combos` `handClassCombos(hand): Card[][]`, `comboKey(combo): string`.
- `@core/domain/cards` (`Card`, `formatCard`, `type Suit`); `@core/domain/pokerHands` (`PokerHand`).

Task (mobile-only; reuse `@core`, do not edit `src/`): a controlled `ComboSelector` RN component
in `mobile/components/ComboSelector.tsx` with props `{ hand: PokerHand; selection: ComboSelection;
onToggle: (combo: Card[]) => void }`. Render `handClassCombos(hand)` as a wrapped grid of toggle
`Pressable`s (suit-colored card text like the combos explorer / board screen), each keyed by
`comboKey`, showing on/off via style + `accessibilityState={{ selected }}` (from
`isComboSelected`), and a "selected/total combos" count (`selectedComboCount`). The component owns
no state — the parent passes `selection` and applies `toggleCombo` in `onToggle`.

Tests (RNTL render, mirroring `action-grid.test.tsx` / `hand-grid.test.tsx`): render with a hand
and an empty selection; assert the right number of combo cells (AKs→4); pressing a cell fires
`onToggle` with that combo; a cell whose combo is in the passed selection reports
`selected: true`.

Files: add `mobile/components/ComboSelector.tsx` + `mobile/__tests__/combo-selector.test.tsx`.
No `src/` edits, no new dependency, no screen wiring yet.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/comboSelection` + `combos` for all combo logic (no hand-rolled
toggling/keys); component is controlled (no internal selection state); lives in
`mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add controlled ComboSelector component`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
