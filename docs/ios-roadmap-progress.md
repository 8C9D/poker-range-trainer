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

## Next slice

**Slice 20 — Favorite toggle + Favorites filter in the library**

Milestone: M4 — Library & organization (web v1.3–v1.4).

Context: the library rows have edit/practice/copy/delete actions plus search,
filters, and sort. This slice adds a per-row favorite toggle and a "Favorites only"
filter, reusing the tested helper. (Archive is the next slice; per-row stat summaries
close M4 after that.)

Reuse (verified, import — never copy): `@core/domain/rangeLibrary`
`filterFavoriteRanges<T extends { favorite?: boolean }>(ranges, favoritesOnly:
boolean): T[]` (confirm the arg/sentinel in `src/domain/rangeLibrary.ts` — likely
returns all when `false`). `SavedRange.favorite?: boolean`; `saveSavedRange`
persists it (a strict `true` is stored, false/undefined drops the key).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add a `toggleFavorite(range)` to `mobile/app/index.tsx`:
  `saveSavedRange({ ...range, favorite: !range.favorite })` then `reload()`. Add a
  star toggle to each row (`testID="favorite-<id>"`, `accessibilityState={{ selected:
  !!range.favorite }}`) — put it at the row START (before the name) to avoid crowding
  the trailing actions; show a filled vs outline star (or ★ vs ☆) by `range.favorite`.
- Add a "Favorites" filter toggle (`testID="filter-favorites"`) near the sort row that
  flips a `favoritesOnly` boolean; fold `filterFavoriteRanges(list, favoritesOnly)`
  into the `filtered` memo (compose with search + metadata filters).
- Tests (extend `mobile/__tests__/library-screen.test.tsx`): (a) seed a range; render;
  press `favorite-<id>`; assert `loadSavedRanges()[0].favorite === true`. (b) seed two
  ranges, favorite one (via `saveSavedRange({...favorite:true})` in the seed), press
  `filter-favorites`, assert only the favorited one shows. Single interaction per
  assertion → `fireEvent` is fine.

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/rangeLibrary` + `saveSavedRange` (no hand-rolled
favorite filtering/persistence); favorites filter composes with the others; UI in
`mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add favorite toggle and favorites filter to the library`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
