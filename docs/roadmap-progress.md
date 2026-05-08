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

## Next slice

- **Number:** 5
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Filter saved ranges by game type

### Prompt

You are implementing roadmap slice 5, the fifth slice of **v1.4 — Range library and
filtering**. This is the **last filter** in v1.4's filter list (Position, Action type,
Stack depth, Game type); after it, v1.4 moves on to sorting, duplicate/archive/favorite,
and richer range cards.

Context:
- The saved-range library lives in `src/components/RangeLibrary.tsx`. Slices 1–4 added
  four filters, all backed by pure helpers in `src/domain/rangeLibrary.ts`: a name
  search (`filterRangesByName(ranges, query)`), a position filter
  (`filterRangesByPosition(ranges, position)`), an action-type filter
  (`filterRangesByActionType(ranges, actionType)`), and a stack-depth filter
  (`filterRangesByStackDepth(ranges, stackDepthBb)` plus `distinctStackDepths(ranges)`).
  The component composes them as
  `filterRangesByStackDepth(filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType), stackDepth === '' ? null : stackDepth)`.
- The filter controls sit in a `.range-library-filters` flex row (`flex-wrap: wrap`):
  a `searchbox` input plus three `<select>`s that share the `.range-library-filter` CSS
  class, each with a distinguishing aria-label ("Filter ranges by position", "Filter
  ranges by action type", "Filter ranges by stack depth"). A generalized empty state —
  "No ranges match the selected filters." — already shows when the combined filters
  match nothing (and a query-specific message shows when a name search matches nothing).
- Game type is **enum-backed**, like position and action type — and unlike stack depth.
  `metadata.gameType` is a `GameType` (see `src/types/range.ts`), whose values come from
  the `GAME_TYPES` tuple (`'cash' | 'tournament' | 'sitAndGo'`) with display strings in
  `GAME_TYPE_LABELS`. So this slice mirrors the position/action-type filters exactly:
  use the empty-string/`null` "all" sentinel and string equality, and iterate the fixed
  `GAME_TYPES` tuple for the options. Do NOT derive the options from the data the way the
  stack-depth filter does, and do NOT add a new vocabulary — reuse `GAME_TYPES` and
  `GAME_TYPE_LABELS`.

Task:
- Add a game-type filter `<select>` to the filter row, after the stack-depth select. Its
  first option is a default "All game types" (value `""`) that does not filter. The
  remaining options are the `GAME_TYPES` values, each labelled via `GAME_TYPE_LABELS`
  ("Cash", "Tournament", "Sit & Go"). Give it the accessible name "Filter ranges by game
  type" (aria-label) so it is distinguishable from the other selects — there are now four
  comboboxes.
- When a specific game type is selected, show only ranges whose `metadata.gameType`
  equals it. Ranges with no metadata, or with metadata but no game type, are excluded
  while a game type is selected. "All game types" shows everything.
- The game-type filter must compose with all existing filters: name search, then
  position, then action type, then stack depth, then game type all apply together.
- When the combined filters match nothing, the existing "No ranges match the selected
  filters." empty state must still show. Keep the selection in local component state; it
  is not persisted.

Keep domain logic separate:
- Add a pure helper `filterRangesByGameType(ranges, gameType)` to
  `src/domain/rangeLibrary.ts`, next to the other filters, mirroring
  `filterRangesByPosition` / `filterRangesByActionType` exactly. Constrain the element
  type to `{ metadata?: { gameType?: string } }` and accept `gameType: string | null`.
  A `null` or empty-string `gameType` means "all" (return a fresh copy of every range);
  otherwise return only the ranges whose `metadata?.gameType` equals the argument (use
  the `if (!gameType) return ranges.slice()` guard like the sibling helpers). Do not
  mutate the input; keep it decoupled (no app-type imports).

Component typing:
- Type the select's state as `GameType | ''` (empty string = all), matching how
  `position` (`Position | ''`) and `actionType` (`ActionType | ''`) are typed. Import
  `GameType`, `GAME_TYPES`, and `GAME_TYPE_LABELS` from `../types/range` (the component
  already imports `GAME_TYPE_LABELS`). On change, set
  `event.target.value as GameType | ''`. Pass the value straight to the helper (empty
  string is treated as "all" by the guard). Compose as
  `filterRangesByGameType(filterRangesByStackDepth(filterRangesByActionType(filterRangesByPosition(filterRangesByName(ranges, query), position), actionType), stackDepth === '' ? null : stackDepth), gameType)`.

Files to create or modify:
- `src/domain/rangeLibrary.ts` — add `filterRangesByGameType`.
- `src/domain/rangeLibrary.test.ts` — unit tests for the new helper.
- `src/components/RangeLibrary.tsx` — render the game-type `<select>` (iterating
  `GAME_TYPES`/`GAME_TYPE_LABELS`) and compose the five filters; update the component
  doc comment to mention the fifth filter.
- `src/components/RangeLibrary.css` — only if the fourth select needs layout tweaks; it
  should reuse `.range-library-filter`.
- `src/components/RangeLibrary.test.tsx` — tests for filtering by game type and for
  combining it with the other filters.

Tests to add:
- `filterRangesByGameType`: returns only ranges whose `metadata.gameType` matches;
  excludes ranges without metadata or without a game type; a `null` gameType returns all
  (as a fresh array); an empty-string gameType returns all; returns an empty array when
  nothing matches; preserves input order; does not mutate the input; returns a fresh
  array. Mirror the existing `filterRangesByActionType` test block.
- Library component: choosing a game type narrows the visible ranges; ranges without a
  game type are excluded while one is selected; selecting "All game types" restores them;
  the game-type filter composes with the name search, position, action-type, and
  stack-depth filters; the no-match empty state shows when the combination matches
  nothing; the game-type filter is not rendered when there are no saved ranges. There are
  now four `<select>`s, so target each combobox by its accessible name
  (`/filter ranges by position/i`, `/filter ranges by action type/i`,
  `/filter ranges by stack depth/i`, `/filter ranges by game type/i`) rather than a bare
  `getByRole('combobox')`. The game-type options ("Cash", "Tournament", "Sit & Go") now
  always appear in the select; no existing test does a bare `getByText` on one of those
  labels (the scenario-line test matches the full "Cash · 6-max · …" string), but keep an
  eye out for that collision and scope by `.range-item-scenario` if needed.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope — only the game-type filter in this slice. Sorting (recently
  edited / recently practiced / accuracy / name), duplicate/archive/favorite, and richer
  range cards are later slices. Note that "recently practiced" and "accuracy" sorting
  will need practice history that the app does not yet persist — flag that when the
  sorting slice comes up, not now.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library game-type filter`
