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

_None yet — the next invocation builds slice 1._

| # | Slice | Roadmap | Date |
|---|-------|---------|------|

## Next slice

- **Number:** 1
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Search saved ranges by name

### Prompt

You are implementing roadmap slice 1, the first slice of **v1.4 — Range library and
filtering**.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. It currently
  lists every saved range with no way to narrow the list.
- v1.4's goal is to help users manage many ranges. This slice adds the first piece:
  searching saved ranges by name.

Task:
- Add a text search input to the range library that filters the listed ranges by
  name, case-insensitively, matching names that contain the query as a substring.
- An empty query shows all ranges.
- When the query matches nothing, show a clear "no ranges match" empty state rather
  than a blank list.
- Keep the search query in local component state; it does not need to be persisted.

Keep domain logic separate:
- Put the matching logic in a small, pure, tested helper under `src/domain/` (e.g.
  `rangeLibrary.ts` exporting `filterRangesByName(ranges, query)`), rather than
  inlining non-trivial logic in the component.

Files to create or modify:
- `src/domain/rangeLibrary.ts` (new) — `filterRangesByName` helper.
- `src/domain/rangeLibrary.test.ts` (new) — unit tests for the helper.
- `src/components/RangeLibrary.tsx` — render the search input and filter through the
  helper.
- `src/components/RangeLibrary.css` — styling for the input, if needed.
- `src/components/RangeLibrary.test.tsx` — test that typing narrows the rendered
  list, is case-insensitive, that an empty query shows all, and that a no-match query
  shows the empty state.

Tests to add:
- `filterRangesByName`: case-insensitive substring match; empty query returns all;
  no match returns an empty array; the original array is not mutated.
- Library component: search narrows the visible ranges and shows the empty state on
  no match.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope — only name search in this slice. Filters (position, action,
  stack depth, game type), sorting, duplicate/archive/favorite, and richer range
  cards are later slices.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library name search`
