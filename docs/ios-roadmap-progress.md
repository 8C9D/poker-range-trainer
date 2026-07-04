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

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training (postflop)** is underway: board
explorer (slice 39), range-vs-board overlay (slice 40), and postflop decision practice
(slice 41 — reached from the practice-mode picker; deals a random hand-from-range on a
random flop, grades bet/check/call/raise/fold against the `@core` heuristic). The combo-level
cluster (enumeration, blocker counts, mixed frequencies) is next.

## Next slice

**Slice 42 — Combo enumeration + blocker-aware counts**

Milestone: M6 — Advanced training (web v4.1 "combo-level precision"). Opens the combo-level
cluster that follows the board/postflop work (slices 39–41). This slice is the foundation:
*displaying* the concrete 2-card combos of a hand and how many survive a board (blockers).
Combo *selection* (toggling individual combos into a range) is a deliberately separate later
slice — keep this one to enumeration + counts.

Context: a preflop hand class expands to concrete combos (AA→6, AKs→4, AKo→12). Dead cards
(a board, or specific blockers) remove combos that use those cards. All of this math is in
`@core`; this slice is a read-only explorer over it.

Reuse (verified — read `src/domain/combos.ts` to confirm shapes before building):
- `@core/domain/combos` `handClassCombos(hand: PokerHand): Card[][]`,
  `comboKey(combo: Card[]): string`, `removeDeadCards(combos: Card[][], dead: Card[]): Card[][]`,
  `availableComboCount(hands: PokerHand[], dead?: Card[]): number`.
- `@core/domain/cards` (`Card`, `parseBoard`, `formatCard`, `RANKS`, `SUITS`).
- `@core/domain/pokerHands` (`PokerHand`) and `@core/storage/rangeStorage` if the hand is picked
  from a saved range; otherwise a free-text hand input is fine.

DESIGN NOTE (resolve when building): decide the entry point + how dead cards are supplied —
either a standalone `mobile/app/combos.tsx` reached from the home/library screen (mirrors how
the board explorer is reached; user enters a hand + optional dead-card string), or a section on
the board explorer reusing its already-entered flop as the dead cards. Pick the simplest that
reuses `@core/domain/combos`. Check the web combo enumeration component (grep `handClassCombos`
under `src/components/`) and mirror its presentation.

Task (mobile-only; reuse `@core`, do not edit `src/`): given a hand, list its concrete combos
(formatted, e.g. "A♠K♠") and the total; given an optional dead-card input, show the surviving
combos + count via `removeDeadCards` / `availableComboCount`. Extract the parse-and-filter glue
into a small pure helper in `mobile/components/` (mirroring `swipeAnswer.ts` / `postflopDrill.ts`)
so it is unit-testable without rendering. Tests (on the helper): AA→6, AKs→4, AKo→12 combos with
no dead cards; and that supplying a dead card that touches the hand removes exactly the combos
using it (e.g. AKs with dead `As` → 3 surviving combos).

Files: add `mobile/app/combos.tsx` + `mobile/components/<comboHelper>.ts` (+ entry-point link)
+ test. No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/combos` for all combo math (no hand-rolled enumeration or
blocker logic); screen in `mobile/app/`, pure helper in `mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add combo enumeration with blocker-aware counts`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
