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

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training (postflop)** has begun with the
board explorer (slice 39).

## Next slice

**Slice 40 — Range-vs-board overlay on the board explorer**

Milestone: M6 — Advanced training (web v4–v5). Builds directly on slice 39 (the board
explorer) — the payoff its preview promised ("later: range-vs-board overlay"). User confirmed
the board-explorer direction for M6.

Context: `mobile/app/board.tsx` enters a 3-card flop and shows its texture tags. This slice
adds: pick one saved range, and once a full valid flop is entered, show how that range hits
the board — combo counts per made-hand/draw category — reusing the tested bucketer.

Reuse (verified, import — never copy):
- `@core/domain/rangeVsBoard` `bucketRangeOnBoard(hands: PokerHand[], flop: Card[]):
  Record<HandCategory, number>` — expands each hand class to combos, drops board-blocked
  combos, categorizes the rest, and tallies per category (a combo can count to several). Read
  `src/domain/rangeVsBoard.ts`.
- `@core/domain/handCategory` `HAND_CATEGORIES` (order: set, trips, twoPair, overpair, topPair,
  middlePair, bottomPair, pair, flushDraw, straightDraw, air), `type HandCategory`.
- `@core/storage/rangeStorage` `loadSavedRanges`; the `Card`/board state already in `board.tsx`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `board.tsx`, add a range picker: `loadSavedRanges()` into state (or `useFocusEffect`
  reload like the library), and a row/list of selectable range chips (`testID={`board-range-
  <id>`}`), one selected at a time (`selectedRangeId`). Keep it compact (the screen already has
  the card pickers); a horizontal wrapping chip row is fine. Show nothing special when no
  ranges exist.
- When a range is selected AND the flop is full + not duplicate, compute
  `bucketRangeOnBoard(range.hands, flop)` (memoize on `[range, cards]`) and render a breakdown
  (`testID="range-vs-board"`): for each `HAND_CATEGORIES` entry with a non-zero count, a labelled
  row "Label: N" (`testID={`category-<cat>`}`). A label map (UI-only) like set→"Set",
  twoPair→"Two pair", topPair→"Top pair", flushDraw→"Flush draw", etc.
- Presentational + a storage load; do not change the texture logic or existing testIDs.

Tests (extend `mobile/__tests__/board-screen.test.tsx`; it currently stubs only expo-router —
now it also reads storage, so add `jest.mock('react-native-mmkv')` + `installLocalStorage()` +
`localStorageShim.clear()` and seed a range with `saveSavedRange`):
- Seed a range (e.g. hands `['AA','KK','AKs']`). Render, select it (`board-range-<id>`), enter a
  known flop (e.g. As Kd 7s via the rank/suit taps), and assert `range-vs-board` shows with at
  least one expected non-zero category (e.g. `category-topPair` or `category-set` present — pick
  one the bucketer actually returns for that range+flop; if unsure, assert `range-vs-board` is
  shown and contains a known category by computing `bucketRangeOnBoard` in the test to derive the
  expectation). Assert `range-vs-board` is absent before a range is selected.
- RNTL hygiene ([[ios-mobile-toolchain]]): `await render`; `userEvent` for the multi-tap
  sequence; `toHaveTextContent` is exact.

Files: modify `mobile/app/board.tsx`, `mobile/__tests__/board-screen.test.tsx`. No `src/`
edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `bucketRangeOnBoard` + `HAND_CATEGORIES` (no hand-rolled combo
bucketing); UI in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): overlay how a range hits the board in the board explorer`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
