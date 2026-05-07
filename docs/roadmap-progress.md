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

## Next slice

- **Number:** 2
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Filter saved ranges by position

### Prompt

You are implementing roadmap slice 2, the second slice of **v1.4 — Range library and
filtering**.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. Slice 1 added a
  name search backed by `filterRangesByName(ranges, query)` in
  `src/domain/rangeLibrary.ts`, with a `searchbox` input and a "no ranges match"
  empty state.
- v1.4 lets users narrow a large library. This slice adds the first metadata filter:
  filtering by hero position.
- Position values and labels already exist in `src/types/range.ts` as the `POSITIONS`
  tuple, the `Position` type, and the `POSITION_LABELS` record. Saved ranges carry an
  optional `metadata.position` (see `RangeMetadata`); many ranges have no metadata at
  all.

Task:
- Add a position filter `<select>` to the range library. Its first option is a
  default "All positions" that does not filter; the remaining options are one per
  entry in `POSITIONS`, labelled via `POSITION_LABELS`.
- When a specific position is selected, show only ranges whose `metadata.position`
  equals it. Ranges with no metadata, or with metadata but no position, are excluded
  while a specific position is selected. "All positions" shows everything.
- The position filter must compose with the existing name search: both apply together
  (search narrows by name, the select narrows by position).
- When the combined filters match nothing, the existing "no ranges match" empty state
  must show. Keep the filter selection in local component state; it is not persisted.

Keep domain logic separate:
- Add a pure helper `filterRangesByPosition(ranges, position)` to
  `src/domain/rangeLibrary.ts`, next to `filterRangesByName`. Treat a `null`/empty
  position as "all" (return a fresh copy of every range); otherwise return only the
  ranges whose `metadata?.position` matches. Keep it generic and decoupled in the same
  style as `filterRangesByName` — constrain the element type to
  `{ metadata?: { position?: string } }` and accept `position: string | null`, so the
  helper does not need to import app types. Do not mutate the input.
- In the component, type the select's state as `Position | ''` (empty string = all)
  so only valid positions are selectable, and pass it through to the string-typed
  helper.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `filterRangesByPosition`.
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper.
- `src/components/RangeLibrary.tsx` — render the position `<select>` and compose
  `filterRangesByPosition(filterRangesByName(ranges, query), position)`.
- `src/components/RangeLibrary.css` — styling for the select / filter row, if needed.
- `src/components/RangeLibrary.test.tsx` — tests for filtering by position and for
  combining the position filter with the name search.

Tests to add:
- `filterRangesByPosition`: a `null` or empty position returns all (as a fresh array);
  a specific position returns only matching `metadata.position`; ranges without
  metadata or without a position are excluded; the input array is not mutated.
- Library component: choosing a position narrows the visible ranges; selecting "All
  positions" restores them; the position filter and name search apply together; the
  no-match empty state shows when the combination matches nothing.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope — only the position filter in this slice. The remaining
  filters (action type, stack depth, game type), sorting, duplicate/archive/favorite,
  and richer range cards are later slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library position filter`
