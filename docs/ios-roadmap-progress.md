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
| 43 | Controlled `ComboSelector` component (per-combo toggles) | M6 | 2026-06-22 |

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training** is underway: board explorer
(slice 39), range-vs-board overlay (slice 40), postflop decision practice (slice 41), the
combo explorer (slice 42), and the controlled `ComboSelector` component (slice 43 —
presentational per-combo toggles, not yet wired into the editor). Next in the combo-level
cluster: wire `ComboSelector` into the editor + persist `comboSelections`, then mixed frequencies.

## Next slice

**Slice 44 — Wire `ComboSelector` into the editor + persist `comboSelections`**

Milestone: M6 — Advanced training (web v4.1 "combo-level precision"). Third unit of the
combo-level cluster: integrate the `ComboSelector` component (slice 43) into the binary range
editor so a user can refine which concrete combos of an in-range hand are selected, and persist
that onto the saved range as `comboSelections`. This completes combo selection (component +
screen + storage), the combo analogue of how the editor screen (slice 9) wired up `HandGrid`.

Context: in the binary editor, a hand is either in or out of the range (`hands`). Combo-level
precision lets an in-range hand keep only a subset of its combos. The web stores this as
`SavedRange.comboSelections: Record<PokerHand, string[]>` — a per-hand serialized list of
`comboKey`s; a hand WITHOUT an entry means "all combos in" (absence = all selected). Read how the
web editor opens `ComboSelector` and reads/writes `comboSelections` before building, and mirror
its semantics exactly (especially: only write an entry when a hand is actually refined; full
selection should stay absent / be cleaned up so hands-only ranges stay byte-compatible).

Reuse (verified — confirm against `src/` before building):
- `mobile/components/ComboSelector` (slice 43).
- `@core/domain/comboSelection` `toggleCombo`, `allCombosForHand(hand): ComboSelection`,
  `serializeComboSelection(selection): string[]`, `deserializeComboSelection(keys): ComboSelection`.
- `@core/domain/combos` `comboKey`, `handClassCombos`; `@core/types/range` `SavedRange`
  (`comboSelections?`); `@core/storage/rangeStorage` `saveSavedRange` / `findSavedRangeById`.

DESIGN NOTE (resolve when building): decide how a hand's combo editor is opened from the mobile
binary editor — e.g. long-press an in-range cell on the `HandGrid` to open that hand's
`ComboSelector` (inline panel or modal), or a dedicated "Refine combos" affordance. Pick the
simplest that fits the existing `editor.tsx` layout and reuses `ComboSelector`. Check the web
editor's UX and mirror where reasonable, but native trigger conventions may differ — document the
choice in a comment.

Task (mobile-only; reuse `@core`, do not edit `src/`): in `mobile/app/editor.tsx`, manage a
`comboSelections` map in editor state (seeded from the loaded range via
`deserializeComboSelection`); when a hand's `ComboSelector` toggles a combo, update that hand's
selection (`toggleCombo`) and reserialize; on save, write `comboSelections` onto the `SavedRange`
(omitting hands whose selection is full, to match web). Toggling a hand OUT of the range should
drop any stored combo refinement for it.

Tests (RNTL, mirroring `editor-screen.test.tsx` / `editor-preserves-overlay.test.tsx`): opening a
hand's combo editor and deselecting a combo persists a `comboSelections` entry with the remaining
combo keys on save; a hand left fully selected writes NO entry; removing the hand from the range
clears its entry. Reuse the existing editor test harness (storage shim + expo-router mocks).

Files: edit `mobile/app/editor.tsx`; add `mobile/__tests__/editor-combo-selection.test.tsx`
(or extend `editor-screen.test.tsx`). No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/comboSelection` for all selection logic + serialization (no
hand-rolled combo-key persistence); keep `comboSelections` byte-compatible with the web (absence =
all combos in). Screen logic in `mobile/app/`, reuse the slice-43 component. Do not edit `src/`.

Suggested commit message:
`feat(ios): refine and persist per-hand combo selections in the editor`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
