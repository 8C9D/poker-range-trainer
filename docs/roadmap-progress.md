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

## Next slice

- **Number:** 6
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Sort saved ranges by name

### Prompt

You are implementing roadmap slice 6, the first **sorting** slice of **v1.4 — Range
library and filtering**. v1.4's filter list (name search + Position, Action type,
Stack depth, Game type) is now complete (slices 1–5). The next feature group is
**Sort by: Recently edited, Recently practiced, Accuracy, Name**. This slice
introduces the sort control with its first, simplest key — **Name (A–Z)** — backed
only by data the app already has.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. It currently
  composes five pure filter helpers from `src/domain/rangeLibrary.ts` into a
  `visibleRanges` list, then renders that list in array order (the order returned by
  storage). The filter helpers are `filterRangesByName`, `filterRangesByPosition`,
  `filterRangesByActionType`, `filterRangesByStackDepth`, and
  `filterRangesByGameType`, composed as
  `filterRangesByGameType(filterRangesByStackDepth(filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType), stackDepth === '' ? null : stackDepth), gameType)`.
- The filter controls sit in a `.range-library-filters` flex row (`flex-wrap: wrap`):
  a `searchbox` input plus four `<select>`s sharing the `.range-library-filter` CSS
  class, each with a distinguishing aria-label ("Filter ranges by position", "Filter
  ranges by action type", "Filter ranges by stack depth", "Filter ranges by game
  type"). A generalized empty state — "No ranges match the selected filters." —
  shows when the combined filters match nothing (and a query-specific message shows
  when a name search matches nothing).
- `SavedRange` (see `src/types/range.ts`) has `name`, `createdAt`, and `updatedAt`
  (ISO-8601 strings) plus optional `metadata`. **Name** and **Recently edited**
  (`updatedAt`) sorts need only existing fields. **Recently practiced** and
  **Accuracy** sorts need per-range practice history that the app does NOT yet
  persist — there is no practice-history storage today. Do NOT build those two keys
  in this slice; they are blocked until a future slice adds practice-result
  persistence (see Constraints).

Task:
- Add a **sort `<select>`** to the filter row, after the game-type select, reusing
  the `.range-library-filter` class. Give it the accessible name "Sort ranges"
  (aria-label) so it is distinct from the four "Filter ranges by …" comboboxes —
  there are now five comboboxes.
- Options: a default "Default order" (value `""`) that preserves the current
  (filtered, storage) order, and "Name (A–Z)" (value `"name"`).
- When "Name (A–Z)" is selected, render the filtered ranges sorted case-insensitively
  by `name` ascending. "Default order" leaves the filtered order untouched.
- Sorting applies to the **result of filtering**: keep the five-filter composition
  exactly as it is, then sort the filtered list for display. Sorting must compose
  with every filter, and the existing empty states must still show when nothing
  matches. Keep the selection in local component state; it is not persisted.

Keep domain logic separate:
- Add a pure helper `sortRangesByName(ranges)` to `src/domain/rangeLibrary.ts`, next
  to the filters. Constrain the element type to `{ name: string }`. Return a new
  array sorted ascending by `name` using
  `a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })` for
  case-insensitive ordering. Do NOT mutate the input — call `ranges.slice()` before
  `.sort()`. `Array.prototype.sort` is stable, so ranges with equal names keep their
  input order. Keep it decoupled (no app-type imports), mirroring the filter helpers.

Component typing:
- Type the select's state as `'' | 'name'` (empty string = default order). On
  change, set `event.target.value as '' | 'name'`. After computing the filtered
  list, branch: `sort === 'name' ? sortRangesByName(filtered) : filtered` to produce
  the rendered list. (You may keep the filter composition in a `filtered` const and
  derive `visibleRanges` from it.)

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `sortRangesByName`.
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper.
- `src/components/RangeLibrary.tsx` — render the sort `<select>`, apply sorting after
  filtering, and update the component doc comment to mention sorting.
- `src/components/RangeLibrary.css` — only if the sort select needs layout tweaks; it
  should reuse `.range-library-filter`.
- `src/components/RangeLibrary.test.tsx` — tests for sorting by name, default order,
  and sorting combined with a filter.

Tests to add:
- `sortRangesByName`: sorts by name ascending; is case-insensitive ("apple" sorts
  before "Banana"); preserves input order for names that compare equal (stable);
  returns an empty array for an empty input; does not mutate the input; returns a
  fresh array (not the same reference).
- Library component: with the sort at "Default order", ranges render in their given
  (input) order; selecting "Name (A–Z)" reorders the visible ranges alphabetically;
  sorting composes with a filter (e.g. filter by a position, then sort by name, and
  assert both membership and order). Assert DOM order by reading the
  `.range-item-name` spans in document order (e.g.
  `container.querySelectorAll('.range-item-name')` mapped to `textContent`) rather
  than `getByText`, which is order-insensitive. There are now five `<select>`s, so
  target the sort control by its accessible name (`/sort ranges/i`) and keep
  targeting the filters by theirs.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope, and within this slice: only the Name sort and the
  sort-control scaffolding. The next sort slice should add **Recently edited** (sort
  by `updatedAt` descending — also backed by existing data). **Recently practiced**
  and **Accuracy** sorts are BLOCKED: the app does not persist practice history yet,
  so a prior slice must add practice-result persistence before those keys can be
  built. Do not add that persistence here, and do not add sort options the app cannot
  back with real data.
- Duplicate / archive / favorite range and richer range cards remain later v1.4
  slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library name sort`
