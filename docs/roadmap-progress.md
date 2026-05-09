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

## Next slice

- **Number:** 7
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Sort saved ranges by recently edited

### Prompt

You are implementing roadmap slice 7, the second **sorting** slice of **v1.4 — Range
library and filtering**. The sort control now exists with two options — "Default
order" and "Name (A–Z)" — added in slice 6. This slice adds the next sort key in the
roadmap's "Sort by" group: **Recently edited**, ordering by `updatedAt` descending
(most recently edited first). Like Name, it is backed only by data the app already
persists, so no new storage is needed.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. It composes
  five pure filter helpers from `src/domain/rangeLibrary.ts` into a `filtered` list,
  then derives `visibleRanges` from it via a sort branch:
  `const visibleRanges = sort === 'name' ? sortRangesByName(filtered) : filtered`.
  The sort selection lives in local state typed `'' | 'name'` (`const [sort, setSort]
  = useState<'' | 'name'>('')`), bound to a `<select>` with aria-label "Sort ranges"
  (options: "Default order" = `""`, "Name (A–Z)" = `"name"`). The select sits last in
  the `.range-library-filters` flex row, reusing the `.range-library-filter` class.
- The sort helper `sortRangesByName(ranges)` in `src/domain/rangeLibrary.ts` is a
  pure, decoupled helper constrained to `{ name: string }` that returns
  `ranges.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, {
  sensitivity: 'base' }))`. Mirror its shape for the new helper.
- `SavedRange` (see `src/types/range.ts`) has `name`, `createdAt`, and `updatedAt`
  (ISO-8601 strings) plus optional `metadata`. `updatedAt` is written on every
  save/edit, so sorting by it descending gives a "most recently edited first" order
  using existing data. **Recently practiced** and **Accuracy** sorts still need
  per-range practice history that the app does NOT persist yet — do NOT build those
  here (see Constraints).

Task:
- Add a third option to the existing sort `<select>`: "Recently edited" with value
  `"recent"`, placed after "Name (A–Z)". Keep "Default order" first.
- Widen the sort state type to `'' | 'name' | 'recent'`, and update the change
  handler cast accordingly (`event.target.value as '' | 'name' | 'recent'`).
- When "Recently edited" is selected, render the filtered ranges sorted by
  `updatedAt` **descending** (newest first). "Default order" and "Name (A–Z)" keep
  their current behavior.
- Sorting still applies to the **result of filtering**: keep the five-filter
  composition and the `filtered` const exactly as they are, and extend only the sort
  branch that derives `visibleRanges`. The existing empty states must still show when
  nothing matches. Keep the selection in local component state; it is not persisted.

Keep domain logic separate:
- Add a pure helper `sortRangesByUpdatedAt(ranges)` to `src/domain/rangeLibrary.ts`,
  next to `sortRangesByName`. Constrain the element type to `{ updatedAt: string }`.
  Return a new array sorted by `updatedAt` descending using
  `b.updatedAt.localeCompare(a.updatedAt)` (ISO-8601 strings sort chronologically as
  plain strings, and `b` vs `a` gives descending). Do NOT mutate the input — call
  `ranges.slice()` before `.sort()`. `Array.prototype.sort` is stable, so ranges with
  equal `updatedAt` keep their input order. Keep it decoupled (no app-type imports),
  mirroring the existing helpers.

Component typing:
- Extend the sort branch to a three-way: `sort === 'name' ? sortRangesByName(filtered)
  : sort === 'recent' ? sortRangesByUpdatedAt(filtered) : filtered`.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `sortRangesByUpdatedAt`.
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper.
- `src/components/RangeLibrary.tsx` — add the "Recently edited" option, widen the sort
  state type, extend the sort branch, and update the component doc comment to mention
  the recently-edited sort.
- `src/components/RangeLibrary.css` — only if needed; the select reuses
  `.range-library-filter`, so likely no change.
- `src/components/RangeLibrary.test.tsx` — tests for sorting by recently edited and
  for it composing with a filter.

Tests to add:
- `sortRangesByUpdatedAt`: sorts by `updatedAt` descending (newest first); preserves
  input order for equal timestamps (stable); returns an empty array for empty input;
  does not mutate the input; returns a fresh array (not the same reference).
- Library component: selecting "Recently edited" orders the visible ranges by
  `updatedAt` descending (use ranges with distinct `updatedAt` values via the
  `makeRange` override, in a non-sorted input order, and assert the rendered order);
  recently-edited sort composes with a filter (filter by a position, then sort by
  recent, and assert both membership and order). Assert DOM order by reading the
  `.range-item-name` spans in document order
  (`container.querySelectorAll('.range-item-name')` mapped to `textContent`), not
  `getByText`. Target the sort control by its accessible name (`/sort ranges/i`).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope, and within this slice: only the Recently-edited sort key.
  **Recently practiced** and **Accuracy** sorts are BLOCKED: the app does not persist
  practice history yet, so a prior slice must add practice-result persistence before
  those keys can be built. Do not add that persistence here, and do not add sort
  options the app cannot back with real data.
- Duplicate / archive / favorite range and richer range cards remain later v1.4
  slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library recently-edited sort`
