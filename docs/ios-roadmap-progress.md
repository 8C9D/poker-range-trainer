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

## Next slice

**Slice 17 — Library metadata filters (position / action / game)**

Milestone: M4 — Library & organization (web v1.3–v1.4).

Context: the library (`mobile/app/index.tsx`) has name search (slice 16) over the
focus-reloaded `ranges`. This slice adds metadata filters that compose with search,
reusing the tested library helpers. (Sorts are the next slice; the stack-depth filter
is a value/range input — defer it or add minimally.)

Reuse (verified, import — never copy) from `@core/domain/rangeLibrary`:
`filterRangesByPosition`, `filterRangesByActionType`, `filterRangesByGameType` (each
`<T extends { metadata?: {...} }>(ranges: T[], value): T[]`). **First read
`src/domain/rangeLibrary.ts`** to confirm the exact param type and the "no filter"
sentinel (e.g. blank/`''`/`undefined` returns all) so the UI passes the right
"unset" value. Option constants + labels come from `@core/types/range` (`POSITIONS`,
`ACTION_TYPES`, `GAME_TYPES`, `POSITION_LABELS`, `ACTION_TYPE_LABELS`,
`GAME_TYPE_LABELS`).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add filter state for position / actionType / gameType (each `… | undefined`). Build
  a compact, collapsible/scrollable filter UI of single-select chips (reuse the chip
  pattern from `RangeMetadataEditor`; consider extracting a shared `FilterChips`/
  `ChipRow` if it reduces duplication — optional). Tapping a chip sets the filter;
  tapping the active chip clears it. `testID`s e.g. `filter-position-btn`,
  `filter-action-<value>`, `filter-game-<value>`.
- Compose the visible list (chain after search), e.g.:
  `visible = filterRangesByGameType(filterRangesByActionType(
  filterRangesByPosition(filterRangesByName(ranges, query), position), action), game)`
  in a `useMemo`. Keep the "no ranges match" empty state when filters/search exclude
  everything.
- Tests (extend `mobile/__tests__/library-screen.test.tsx`): seed two ranges with
  different metadata (e.g. one `metadata.position: 'btn'`, one `'utg'` — set via
  `saveSavedRange`); render; tap `filter-position-btn`; assert only the BTN range
  shows. Single interaction per assertion → `fireEvent` is fine.

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`;
optionally add `mobile/components/ChipRow.tsx` (shared with the metadata editor) +
its test. No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/rangeLibrary` filters + `@core/types/range`
constants (no hand-rolled metadata matching); filters compose with search as view
filters over the focus-reloaded list; UI in `mobile/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add position/action/game filters to the range library`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
