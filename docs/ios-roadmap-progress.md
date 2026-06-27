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

## Next slice

**Slice 16 — Library search by name**

Milestone: M4 — Library & organization (web v1.3–v1.4).

Context: the library (`mobile/app/index.tsx`) lists all saved ranges with a
per-row summary, open/edit, practice, and delete. Ranges now carry scenario
metadata (slice 15). This slice adds a search box to filter the list by name,
reusing the tested library helper. (Metadata filters + sorts are the next slices.)

Reuse (verified, import — never copy) from `@core/domain/rangeLibrary`:
`filterRangesByName<T extends { name: string }>(ranges: T[], query: string): T[]`
(case-insensitive, trims, returns all on a blank query). The module also exports the
filters/sorts the next slices will use (`filterRangesByPosition`,
`filterRangesByActionType`, `filterRangesByGameType`, `filterRangesByStackDepth`,
`filterArchivedRanges`, `filterFavoriteRanges`, `sortRangesByName`,
`sortRangesByUpdatedAt`, `sortRangesByLastPracticed`) — don't build those here.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `mobile/app/index.tsx`, add a `query` state + a themed search `TextInput`
  (`testID="library-search"`, placeholder "Search ranges", `autoCorrect={false}`,
  `clearButtonMode` if handy) above the list. Derive the displayed list as
  `filterRangesByName(ranges, query)` (compute in render or `useMemo` on
  `[ranges, query]`). Keep `ranges` as the full loaded set (reloaded on focus);
  search only narrows what's shown.
- When the filtered list is empty but ranges exist, show a "No ranges match" state
  (distinct from the existing "no ranges yet" empty state). Keep delete/practice/edit
  working on the filtered rows.
- Tests (extend `mobile/__tests__/library-screen.test.tsx`): seed e.g. "UTG Open" and
  "BTN 3-bet"; render; assert both show; `fireEvent.changeText(getByTestId(
  'library-search'), 'btn')` and assert only "BTN 3-bet" remains (and "UTG Open" is
  gone). A single changeText is one interaction, so `fireEvent` is fine; if you chain
  multiple interactions, switch to `userEvent`.

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/rangeLibrary` for the name match (no hand-rolled
filtering); the list stays read-from-storage + reload-on-focus with search as a view
filter; UI in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add name search to the range library`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
