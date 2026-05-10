# Roadmap slice progress

State file for the `roadmap-slice` skill. The skill reads this file on every
invocation to find the next slice to build, and rewrites it as part of each
committed slice. You can hand-edit the **Next slice** prompt below to steer what
gets built next — the skill uses whatever is here.

- Scope and ordering come from [`roadmap.md`](./roadmap.md).
- Project rules (validation, commit style, what's out of scope) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken in
  roadmap order — never a whole version at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline (built before this skill existed)

As of commit `f8f4e83`, these roadmap versions are complete:

- **v1** — 13×13 grid, click-to-toggle, named ranges, local save/view/edit/delete,
  practice mode, session stats.
- **v1.1** — drag-select painting, range shortcut buttons, live range percentage and
  combo counts.
- **v1.2** — range notation parser/exporter (import, export, copy, dash ranges).
- **v1.3** — optional scenario metadata and the metadata editor fields.

The next roadmap target is **v1.4 — Range library and filtering**.

## Completed slices

| # | Slice | Roadmap | Date |
|---|-------|---------|------|
| 1 | Search saved ranges by name | v1.4 — Range library and filtering | 2026-06-03 |
| 2 | Filter saved ranges by position | v1.4 — Range library and filtering | 2026-06-03 |
| 3 | Filter saved ranges by action type | v1.4 — Range library and filtering | 2026-06-03 |
| 4 | Filter saved ranges by stack depth | v1.4 — Range library and filtering | 2026-06-03 |
| 5 | Filter saved ranges by game type | v1.4 — Range library and filtering | 2026-06-03 |
| 6 | Sort saved ranges by name | v1.4 — Range library and filtering | 2026-06-05 |
| 7 | Sort saved ranges by recently edited | v1.4 — Range library and filtering | 2026-06-05 |
| 8 | Duplicate a saved range | v1.4 — Range library and filtering | 2026-06-05 |
| 9 | Archive / unarchive a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |
| 10 | Hide archived ranges by default behind a "Show archived" toggle | v1.4 — Range library and filtering | 2026-06-05 |

## Next slice

- **Number:** 11
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Favorite / unfavorite a saved range (persisted flag)

### Prompt

You are implementing roadmap slice 11 of **v1.4 — Range library and filtering**. The
library already supports archive: slice 9 added a persisted `archived?: boolean` flag with
an Archive/Unarchive toggle button and an "Archived" badge, and slice 10 hid archived
ranges behind a "Show archived" toggle. This slice adds the **Favorite** feature's first
half, mirroring slice 9 exactly but for a new `favorite?: boolean` flag: a persisted flag,
a per-card Favorite/Unfavorite toggle button, and a "Favorite" badge. A later slice will
add favorites-only filtering / favorites-first sorting — **do not** add that here.

Context (mirror the archive implementation — favorite is structurally identical):
- `SavedRange` (`src/types/range.ts`) already has `archived?: boolean`. Archive's data
  path is the template to copy:
  - Type: `archived?: boolean` is documented as "absent/false = active".
  - Storage (`src/storage/rangeStorage.ts`): `parseSavedRange` destructures `archived`
    and appends `...(archived === true ? { archived: true } : {})`; `saveSavedRange`
    pulls `archived` out of `rest` and re-adds it the same way. Only a strict `true` is
    ever persisted — `false`/`undefined` drops the key — so reading `=== true` (or
    `!== true` for "not set") is reliable.
  - Domain helper (`src/domain/rangeArchive.ts`): `setRangeArchived(range, archived)`
    returns `{ ...range, archived: true }` when true and a copy with the key `delete`d
    when false; it copies only the top level and never mutates the source. Its tests are
    `src/domain/rangeArchive.test.ts`.
  - Component (`src/components/RangeLibrary.tsx`): an `onArchive: (range: SavedRange) =>
    void` prop, a per-card button whose aria-label is `Archive range <name>` /
    `Unarchive range <name>` (text "Archive"/"Unarchive"), and a `{range.archived &&
    <span className="range-item-badge">Archived</span>}` badge rendered right after the
    `range-item-name` span.
  - App (`src/App.tsx`): `handleArchive` calls `saveSavedRange(setRangeArchived(range,
    !range.archived))` then `setSavedRanges(loadSavedRanges())`, and is passed as
    `onArchive` to `<RangeLibrary>`.
- `favorite` and `archived` are independent flags — a range may be neither, either, or
  both. The `.range-item-badge` CSS class already exists and is reused as-is.

Task — add a `favorite` flag everywhere `archived` lives:
- Type: add `favorite?: boolean` to `SavedRange` in `src/types/range.ts`, documented in
  the style of `archived` (absent/false = not favorited; this is library state, not an
  edit).
- Storage: in `src/storage/rangeStorage.ts`, normalize `favorite` exactly like `archived`
  — destructure it in `parseSavedRange`, strip it from `rest` in `saveSavedRange`, and in
  both append `...(favorite === true ? { favorite: true } : {})` so only a strict `true`
  persists.
- Domain: create `src/domain/rangeFavorite.ts` with `setRangeFavorite(range: SavedRange,
  favorite: boolean): SavedRange`, mirroring `setRangeArchived` (set `favorite: true`, or
  return a copy with the key deleted; top-level copy only; never mutate the source).
- Component: in `src/components/RangeLibrary.tsx`, add an `onFavorite: (range: SavedRange)
  => void` prop. Render a "Favorite" badge (`{range.favorite && <span
  className="range-item-badge">Favorite</span>}`) immediately BEFORE the existing
  "Archived" badge, and add a Favorite/Unfavorite button to `.range-item-actions` placed
  immediately BEFORE the Archive button, with aria-label `Favorite range <name>` when not
  favorited and `Unfavorite range <name>` when favorited (button text "Favorite" /
  "Unfavorite"). Update the component doc comment to list favorite alongside archive.
- App: in `src/App.tsx`, add `handleFavorite(range)` calling
  `saveSavedRange(setRangeFavorite(range, !range.favorite))` then
  `setSavedRanges(loadSavedRanges())`, and pass it as `onFavorite` to `<RangeLibrary>`.

Tests to add (mirror the archive tests):
- `src/domain/rangeFavorite.test.ts`: sets `favorite: true` when favoriting; omits the key
  when unfavoriting; keeps `favorite: true` when favoriting an already-favorited range;
  leaves id/name/hands/timestamps/metadata unchanged; returns a new object without
  mutating the source.
- `src/storage/rangeStorage.test.ts`: a `favorite: true` range round-trips through
  save/load; `favorite: false`/absent persists no `favorite` key (assert via the stored
  JSON or `'favorite' in loaded`); `favorite` and `archived` coexist on one range.
- `src/components/RangeLibrary.test.tsx`: a non-favorited range shows a "Favorite" button
  (aria-label `Favorite range <name>`) and no "Favorite" badge; clicking it calls
  `onFavorite` once with the range; a `favorite: true` range shows the "Favorite" badge
  and an "Unfavorite" button. Update every existing `render(<RangeLibrary .../>)` call in
  this file (and any other test rendering `<RangeLibrary>`) to pass an `onFavorite` prop,
  e.g. `onFavorite={vi.fn()}`, so the new required prop does not break them.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the persisted `favorite` flag, the per-card
  Favorite/Unfavorite button, and the "Favorite" badge. Do NOT add a favorites-only
  filter, favorites-first sorting, or any hide/show behavior — those are a later slice
  (just as archive's filtering was split from its flag).
- **Recently practiced** and **Accuracy** sorts, plus the "Last practiced" / accuracy
  fields on richer range cards, remain BLOCKED until a future slice adds
  practice-result persistence. Do not add that persistence here.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library favorite toggle`
