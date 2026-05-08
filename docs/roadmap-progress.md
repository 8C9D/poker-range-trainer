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

## Next slice

- **Number:** 4
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Filter saved ranges by stack depth

### Prompt

You are implementing roadmap slice 4, the fourth slice of **v1.4 — Range library and
filtering**.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. Slices 1–3 added
  three filters, all backed by pure helpers in `src/domain/rangeLibrary.ts`: a name
  search (`filterRangesByName(ranges, query)`), a position filter
  (`filterRangesByPosition(ranges, position)`), and an action-type filter
  (`filterRangesByActionType(ranges, actionType)`). The component composes them as
  `filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType)`.
- The filter controls sit in a `.range-library-filters` flex row (`flex-wrap: wrap`):
  a `searchbox` input plus two `<select>`s that share the `.range-library-filter` CSS
  class, each with a distinguishing aria-label ("Filter ranges by position", "Filter
  ranges by action type"). A generalized empty state — "No ranges match the selected
  filters." — already shows when the combined filters match nothing (and a
  query-specific message shows when a name search matches nothing).
- v1.4's filter list is Position (done), Action type (done), Stack depth (this slice),
  Game type (next). This slice adds the stack-depth filter.
- Stack depth differs from position and action type: `metadata.stackDepthBb` is a
  free-form **positive number** (see `RangeMetadata` in `src/types/range.ts`), not a
  fixed enum — there is no tuple or label map for it, and the editor accepts any
  positive value. Do NOT invent a fixed vocabulary (e.g. a hardcoded 20/40/100 list);
  derive the selectable depths from the saved ranges themselves so the filter always
  reflects the user's actual data.

Task:
- Add a stack-depth filter `<select>` to the filter row, after the action-type select.
  Its first option is a default "All stack depths" (value `""`) that does not filter.
  The remaining options are the **distinct** `metadata.stackDepthBb` values actually
  present across `ranges`, sorted ascending, each labelled `"{n}bb"` (e.g. "20bb",
  "40bb", "100bb"). Two ranges at the same depth must yield only one option. Give it
  the accessible name "Filter ranges by stack depth" (aria-label) so it is
  distinguishable from the other two selects — there are now three comboboxes.
- When a specific depth is selected, show only ranges whose `metadata.stackDepthBb`
  strictly equals it. Ranges with no metadata, or with metadata but no stack depth,
  are excluded while a depth is selected. "All stack depths" shows everything.
- The stack-depth filter must compose with all existing filters: name search, then
  position, then action type, then stack depth all apply together.
- When the combined filters match nothing, the existing "No ranges match the selected
  filters." empty state must still show. Keep the selection in local component state;
  it is not persisted.

Keep domain logic separate:
- Add a pure helper `filterRangesByStackDepth(ranges, stackDepthBb)` to
  `src/domain/rangeLibrary.ts`, next to the other filters. Constrain the element type
  to `{ metadata?: { stackDepthBb?: number } }` and accept `stackDepthBb: number | null`.
  Treat `null` as "all" (return a fresh copy of every range); otherwise return only the
  ranges whose `metadata?.stackDepthBb` strictly equals the argument. Do not mutate the
  input; keep it decoupled (no app-type imports), matching the existing helpers.
- The select needs the distinct sorted depths. Either add a second pure helper to the
  same file — e.g. `distinctStackDepths<T extends { metadata?: { stackDepthBb?: number } }>(ranges): number[]`
  returning the unique `stackDepthBb` values present, sorted numerically ascending,
  ignoring ranges without a depth — and unit-test it; or derive the list inline in the
  component (e.g. with `useMemo`). Prefer the domain helper for testability and to keep
  the component free of data-shaping logic.

Component typing:
- `<select>` option values are strings, but `stackDepthBb` is a number. Type the
  select's state as `number | ''` (empty string = all). Set the control's value with
  `String(stackDepth)` (note `String('') === ''`, so the empty option still matches).
  On change, map `''` → `''` and otherwise `Number(event.target.value)`. Pass
  `stackDepth === '' ? null : stackDepth` to the helper. Compose as
  `filterRangesByStackDepth(filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType), stackDepth === '' ? null : stackDepth)`.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `filterRangesByStackDepth` (and optionally
  `distinctStackDepths`).
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper(s).
- `src/components/RangeLibrary.tsx` — render the stack-depth `<select>` with the
  derived options and compose the four filters.
- `src/components/RangeLibrary.css` — only if the third select needs layout tweaks; it
  should reuse `.range-library-filter`.
- `src/components/RangeLibrary.test.tsx` — tests for filtering by stack depth and for
  combining it with the other filters.

Tests to add:
- `filterRangesByStackDepth`: a `null` stackDepthBb returns all (as a fresh array); a
  specific depth returns only ranges whose `metadata.stackDepthBb` strictly equals it;
  ranges without metadata or without a stack depth are excluded; the input array is not
  mutated; a fresh array is returned.
- `distinctStackDepths` (if added): returns the unique depths present, sorted ascending;
  collapses duplicates to one entry; ignores ranges with no metadata or no depth;
  returns an empty array when no range has a depth.
- Library component: only the distinct present depths appear as options (two ranges at
  100bb produce a single "100bb" option); choosing a depth narrows the visible ranges;
  selecting "All stack depths" restores them; the stack-depth filter composes with the
  name search, position, and action-type filters; the no-match empty state shows when
  the combination matches nothing. There are now three `<select>`s, so target each
  combobox by its accessible name (`/filter ranges by position/i`,
  `/filter ranges by action type/i`, `/filter ranges by stack depth/i`) rather than a
  bare `getByRole('combobox')`.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope — only the stack-depth filter in this slice. The remaining
  game-type filter, sorting, duplicate/archive/favorite, and richer range cards are
  later slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library stack-depth filter`
