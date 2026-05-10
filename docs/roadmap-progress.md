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
| 11 | Favorite / unfavorite a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |

## Next slice

- **Number:** 12
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Filter to favorited ranges only behind a "Favorites only" toggle

### Prompt

You are implementing roadmap slice 12 of **v1.4 — Range library and filtering**. Slice 11
added the persisted `favorite?: boolean` flag with a per-card Favorite/Unfavorite toggle
button and a "Favorite" badge, but favorites currently have no effect on which ranges are
listed. This slice adds the **second half**, mirroring slice 10 (which hid archived ranges
behind a "Show archived" toggle): a "Favorites only" checkbox that, when on, narrows the
list to favorited ranges. Where archive's toggle is an *exclusion* that hides archived
ranges unless revealed, favorites is an *inclusion* that shows only favorites when the box
is checked and everything otherwise.

Context (slice 10 is the structural template — read it before starting):
- The archive-visibility partition lives in `src/domain/rangeLibrary.ts` as
  `filterArchivedRanges<T extends { archived?: boolean }>(ranges, showArchived)`: returns
  `ranges.slice()` when `showArchived` is true, else `ranges.filter((r) => r.archived !==
  true)`. It is a pure helper over a minimal structural shape, never mutates the input, and
  always returns a fresh array. Its tests are in `src/domain/rangeLibrary.test.ts`.
- `src/components/RangeLibrary.tsx` owns a `const [showArchived, setShowArchived] =
  useState(false)` and applies `filterArchivedRanges(ranges, showArchived)` as the
  innermost step of the filter pipeline (the result is then wrapped by
  `filterRangesByName`, the metadata selects, and finally the sort). The checkbox is a
  `<label className="range-library-toggle">` containing a `<input type="checkbox" checked=
  {showArchived} onChange={...}>` and the text "Show archived", rendered inside
  `.range-library-filters`. The `.range-library-toggle` CSS class already exists and is
  reused as-is.
- `SavedRange` already has `favorite?: boolean` (slice 11); storage only ever persists
  `favorite: true`, so `favorite === true` reliably means favorited and `!== true` means
  not.

Task — add a favorites-only inclusion filter mirroring the archive partition:
- Domain: in `src/domain/rangeLibrary.ts`, add `filterFavoriteRanges<T extends { favorite?:
  boolean }>(ranges: T[], favoritesOnly: boolean): T[]`. When `favoritesOnly` is false
  return `ranges.slice()` (every range, fresh copy); when true return `ranges.filter((r) =>
  r.favorite === true)`. Never mutate the input; always return a fresh array. Document it in
  the style of `filterArchivedRanges`, noting the inverted sense (true = keep only
  favorites).
- Component: in `src/components/RangeLibrary.tsx`, add `const [favoritesOnly,
  setFavoritesOnly] = useState(false)`. Apply `filterFavoriteRanges(..., favoritesOnly)` in
  the pipeline right after `filterArchivedRanges` (i.e. wrap it:
  `filterFavoriteRanges(filterArchivedRanges(ranges, showArchived), favoritesOnly)`, with
  `filterRangesByName` then wrapping that), so archived ranges drop out first, then the
  favorites narrowing, then name/metadata, then sort. Add a second
  `<label className="range-library-toggle">` checkbox with the text "Favorites only" next to
  the "Show archived" toggle, bound to `favoritesOnly`/`setFavoritesOnly`. Update the
  component doc comment to describe the favorites-only step alongside the archived step.
- No `src/types/range.ts`, `src/storage/`, or `src/App.tsx` changes are needed — the flag
  and its persistence already exist.

Tests to add:
- `src/domain/rangeLibrary.test.ts`: `filterFavoriteRanges` returns every range (a fresh
  array, input order preserved) when `favoritesOnly` is false; returns only `favorite ===
  true` ranges when true; treats absent/`false` favorite as not-favorited; returns an empty
  array when true and nothing is favorited; never mutates the input. Mirror the existing
  `filterArchivedRanges` test cases.
- `src/components/RangeLibrary.test.tsx`: by default (box off) both favorited and
  non-favorited ranges are listed; after clicking the "Favorites only" checkbox
  (`getByRole('checkbox', { name: /favorites only/i })`), only the favorited range remains
  and the non-favorited one is gone; toggling it back off restores the full list. Add a case
  where every range is non-favorited and "Favorites only" is on, asserting the existing
  "No ranges match the selected filters." empty state shows. (Existing renders already pass
  `onFavorite`; no prop changes are needed.)

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the favorites-only inclusion filter and its checkbox. Do NOT
  add favorites-first sorting, a new sort option, or any change to the persisted flag/badge/
  button from slice 11.
- **Recently practiced** and **Accuracy** sorts, plus the "Last practiced" / accuracy
  fields on richer range cards, remain BLOCKED until a future slice adds
  practice-result persistence. Do not add that persistence here.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library favorites-only filter`
