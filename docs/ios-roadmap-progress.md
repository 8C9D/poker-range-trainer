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

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). The next slice opens **M6 — Advanced training (postflop)**.

## Next slice

**Slice 39 — Board input + flop texture tagging (opens M6 — Advanced training / postflop)**

Milestone: M6 — Advanced training (web v4–v5). FIRST M6 slice. M6 is the postflop milestone:
board texture, made-hand/draw categorization, range-vs-board, postflop decision practice,
combo/blocker depth, mixed-frequency editor + quiz + notation, range diff, per-hand notes,
CSV import. All the domain logic already exists in `@core` (`src/domain/boardTexture.ts`,
`handCategory.ts`, `rangeVsBoard.ts`, `postflopScenario.ts`, `combos.ts`, `comboSelection.ts`,
`blockerPractice.ts`, `mixedStrategy.ts`, `mixedNotation.ts`) — M6 is a reuse-and-re-author
port, same as M2–M5.

⚠️ DESIGN DECISION (confirm before building — this opens a whole new app area): postflop is a
new surface the app has not had. TWO things to settle:
  1. **Where postflop lives.** A new top-level "Postflop" tab/section? A new entry from the
     practice-mode picker? A standalone "Board explorer" screen reached from the library? The
     later M6 slices (range-vs-board, postflop practice) build on this, so the placement should
     anticipate them. (Lean: a dedicated **"Board explorer" screen** — enter a flop, see its
     texture + later its range interaction — reachable from a top-level entry; revisit when
     range-vs-board lands.)
  2. **Board-card input UX.** Entering a 3-card flop on mobile (rank × suit pickers? a tappable
     card menu? text like "AhKd7s"?). `@core` likely has a card parser — check
     `src/domain/cards.ts` / `boardTexture.ts` for the `Card` type + any `parseCard`/`parseBoard`
     helper and reuse it; the slice's new work is the RN picker UI, not card logic.
Confirm both before building (and the broader M6 scope/appetite — it's a large milestone).

Reuse (verified, import — never copy):
- `@core/domain/boardTexture` `FLOP_TEXTURE_TAGS`, `type FlopTextureTag`,
  `tagFlopTexture(board: Card[]): FlopTextureTag[]`. Find the `Card` type and any card-parsing
  helper it imports (read `src/domain/boardTexture.ts` and follow the import) — reuse them.

Task (mobile-only; reuse `@core`, do not edit `src/`) — sketch (refine after the decision):
- A board-input control (3 cards) using the reused `Card` representation, and a display of
  `tagFlopTexture(board)` as labelled tags once a full, valid flop is entered. Placed per the
  decision (lean: new `mobile/app/board.tsx` "Board explorer", reachable from a top-level link).
- Tests: a unit test of the input→`tagFlopTexture` wiring (e.g. enter a known monotone/paired
  flop, assert the expected tags render); component test for the card picker.
- Reuse `@core` for ALL board/texture logic (no hand-rolled card parsing or texture rules).

Files: add `mobile/app/board.tsx` (+ a card-picker component) + tests; wire an entry point. No
`src/` edits unless a tiny behavior-preserving seam is unavoidable (then run the web trio too).

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass. (If `src/` is touched, also the web trio.)

Constraints: reuse `@core` board/texture domain; new RN UI in `mobile/components/`, screen in
`mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add board input and flop texture tagging`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
