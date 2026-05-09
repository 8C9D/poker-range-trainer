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

## Next slice

- **Number:** 10
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Hide archived ranges by default behind a "Show archived" toggle

### Prompt

You are implementing roadmap slice 10 of **v1.4 — Range library and filtering**. Slice 9
added a persisted `archived` flag (`SavedRange.archived?: boolean`), an Archive/Unarchive
toggle button on each range card, and an "Archived" badge — but archived ranges still
appear in the list. This slice **hides archived ranges by default** and adds a "Show
archived" toggle that reveals them. Favorite is a later slice; **Recently practiced** and
**Accuracy** sorts remain BLOCKED (no practice-result persistence yet).

Context:
- `SavedRange` (`src/types/range.ts`) has an optional top-level `archived?: boolean`
  (absent/false = active). Storage normalizes it: `parseSavedRange`/`saveSavedRange` in
  `src/storage/rangeStorage.ts` only ever persist/return `archived: true`, never `false`,
  so reading `archived === true` (or `!== true` for "active") is reliable.
- `src/domain/rangeLibrary.ts` holds the pure, generically-constrained filter/sort
  helpers (`filterRangesByName`, `filterRangesByPosition`, `filterRangesByActionType`,
  `filterRangesByGameType`, `filterRangesByStackDepth`, `distinctStackDepths`,
  `sortRangesByName`, `sortRangesByUpdatedAt`). Each constrains `T` to the minimal shape
  it needs (e.g. `T extends { name: string }`), returns a fresh array (`.slice()` /
  `.filter()`), and never mutates its input. Its tests are `src/domain/rangeLibrary.test.ts`.
- `src/components/RangeLibrary.tsx` composes those filters into `filtered`, then sorts
  into `visibleRanges`. The filter controls live in a `.range-library-filters` row (the
  search `<input type="search">` plus the `<select>`s); the whole filter UI and list are
  only rendered when `ranges.length > 0`. The no-match empty state already reads "No
  ranges match the selected filters." The per-card badge and Archive/Unarchive button
  from slice 9 stay as-is.
- The library currently shows ALL ranges, including archived ones.

Task:
- Domain: add `filterArchivedRanges<T extends { archived?: boolean }>(ranges: T[],
  showArchived: boolean): T[]` to `rangeLibrary.ts`. When `showArchived` is true it
  returns a copy of all ranges (`.slice()`); when false it returns only ranges where
  `archived !== true`, preserving input order. Never mutate the input; always return a
  fresh array. Document it in the style of the neighbouring helpers.
- Component:
  - Add `showArchived` boolean state, default `false`.
  - Apply `filterArchivedRanges(ranges, showArchived)` as the OUTERMOST (first) step of
    the filter pipeline, so archived ranges are dropped before the name/metadata filters
    unless the toggle is on. Sorting still applies last, to the filtered result.
  - Add a "Show archived" checkbox to the `.range-library-filters` row: a `<label>`
    wrapping `<input type="checkbox">` wired to `showArchived`. Ensure the input has the
    accessible name "Show archived" (associated label text) so it is reachable via
    `getByRole('checkbox', { name: /show archived/i })`.
  - Leave the badge and Archive/Unarchive button behavior unchanged. Update the
    component doc comment to describe the default-hide + toggle behavior.
- Empty states: when every range is archived and `showArchived` is off, the existing
  "No ranges match the selected filters." empty state should render (the filtered list
  is empty but `ranges.length > 0`). Do not add a new special-case message this slice.

Keep domain logic separate: the active/archived partition lives in `rangeLibrary.ts`;
the component only owns the `showArchived` checkbox state and rendering.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `filterArchivedRanges`.
- `src/domain/rangeLibrary.test.ts` — tests for `filterArchivedRanges`.
- `src/components/RangeLibrary.tsx` — `showArchived` state, the checkbox, apply the
  filter as the outermost step, update the doc comment.
- `src/components/RangeLibrary.test.tsx` — archived hidden by default; toggling reveals
  them; badge/Unarchive button still present when revealed; all-archived empty state.
- `src/components/RangeLibrary.css` — optional styling for the checkbox label; reuse
  existing tokens.

Tests to add:
- `filterArchivedRanges`: with `showArchived=false`, ranges with `archived: true` are
  dropped while active ones (absent flag) are kept in order; with `showArchived=true`,
  all ranges are returned; the input array is not mutated and a fresh array is returned.
- Component: a range with `archived: true` is NOT listed by default; after clicking the
  "Show archived" checkbox it appears (with its "Archived" badge and "Unarchive range
  <name>" button); active ranges are always listed; when every range is archived and the
  toggle is off, the "No ranges match the selected filters." empty state shows.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the default-hide behavior and the "Show archived" toggle.
  Do NOT add favorite, a dedicated archive-only view, or archived-specific sorting.
- **Recently practiced** and **Accuracy** sorts, plus the "Last practiced" / accuracy
  fields on richer range cards, remain BLOCKED until a future slice adds
  practice-result persistence. Do not add that persistence here.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: hide archived ranges behind show-archived toggle`
