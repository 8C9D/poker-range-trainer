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

## Next slice

- **Number:** 3
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Filter saved ranges by action type

### Prompt

You are implementing roadmap slice 3, the third slice of **v1.4 — Range library and
filtering**.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. Slice 1 added a
  name search backed by `filterRangesByName(ranges, query)`; slice 2 added a position
  filter backed by `filterRangesByPosition(ranges, position)` in
  `src/domain/rangeLibrary.ts`. The component composes them as
  `filterRangesByPosition(filterRangesByName(ranges, query), position)`.
- The filter controls sit in a `.range-library-filters` flex row: a `searchbox` input
  and a position `<select>` (aria-label "Filter ranges by position", state typed
  `Position | ''`, options from `POSITIONS` via `POSITION_LABELS`). Selects share the
  `.range-library-filter` CSS class. A "no ranges match" empty state already shows
  when the combined filters match nothing.
- v1.4's filter list is Position (done), Action type (this slice), Stack depth, Game
  type. This slice adds the action-type filter, parallel to the position filter.
- Action-type values and labels already exist in `src/types/range.ts` as the
  `ACTION_TYPES` tuple, the `ActionType` type, and the `ACTION_TYPE_LABELS` record.
  Saved ranges carry an optional `metadata.actionType` (see `RangeMetadata`); many
  ranges have no metadata at all.

Task:
- Add an action-type filter `<select>` to the filter row. Its first option is a
  default "All actions" that does not filter; the remaining options are one per entry
  in `ACTION_TYPES`, labelled via `ACTION_TYPE_LABELS`. Give it the accessible name
  "Filter ranges by action type" (aria-label) so it is distinguishable from the
  position select — there are now two comboboxes.
- When a specific action is selected, show only ranges whose `metadata.actionType`
  equals it. Ranges with no metadata, or with metadata but no actionType, are excluded
  while a specific action is selected. "All actions" shows everything.
- The action-type filter must compose with BOTH existing filters: name search, then
  position, then action type all apply together.
- When the combined filters match nothing, the "no ranges match" empty state must
  still show. Keep the selection in local component state; it is not persisted.
- The current no-query empty message reads "No ranges match the selected position." —
  generalize it (e.g. "No ranges match the selected filters.") so it is accurate when
  only the action filter, or the position filter, excludes everything.

Keep domain logic separate:
- Add a pure helper `filterRangesByActionType(ranges, actionType)` to
  `src/domain/rangeLibrary.ts`, next to `filterRangesByPosition`. Treat a `null`/empty
  actionType as "all" (return a fresh copy of every range); otherwise return only the
  ranges whose `metadata?.actionType` matches. Keep it generic and decoupled in the
  same style as the existing helpers — constrain the element type to
  `{ metadata?: { actionType?: string } }` and accept `actionType: string | null`, so
  the helper does not need to import app types. Do not mutate the input.
- In the component, type the select's state as `ActionType | ''` (empty string = all)
  so only valid actions are selectable, and pass it through to the string-typed
  helper. Compose as
  `filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType)`.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `filterRangesByActionType`.
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper.
- `src/components/RangeLibrary.tsx` — render the action-type `<select>`, compose the
  three filters, and generalize the no-query empty message.
- `src/components/RangeLibrary.css` — only if the second select needs layout tweaks;
  it should reuse `.range-library-filter`.
- `src/components/RangeLibrary.test.tsx` — tests for filtering by action type and for
  combining it with the name search and position filter.

Tests to add:
- `filterRangesByActionType`: a `null` or empty actionType returns all (as a fresh
  array); a specific action returns only matching `metadata.actionType`; ranges
  without metadata or without an actionType are excluded; the input array is not
  mutated.
- Library component: choosing an action narrows the visible ranges; selecting "All
  actions" restores them; the action filter composes with the name search and the
  position filter; the no-match empty state shows when the combination matches
  nothing. There are now two `<select>`s, so target each combobox by its accessible
  name (`/filter ranges by position/i`, `/filter ranges by action type/i`) rather than
  a bare `getByRole('combobox')`.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope — only the action-type filter in this slice. The remaining
  filters (stack depth, game type), sorting, duplicate/archive/favorite, and richer
  range cards are later slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library action-type filter`
