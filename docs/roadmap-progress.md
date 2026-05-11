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
| 12 | Filter to favorited ranges only behind a "Favorites only" toggle | v1.4 — Range library and filtering | 2026-06-05 |
| 13 | Persist per-range practice stats (type + storage foundation) | v1.4 — Range library and filtering | 2026-06-05 |
| 14 | Record finished practice sessions into per-range stats | v1.4 — Range library and filtering | 2026-06-05 |
| 15 | Show per-range practice stats (last practiced + accuracy) on library cards | v1.4 — Range library and filtering | 2026-06-05 |

## Next slice

- **Number:** 16
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Sort saved ranges by recently practiced

### Prompt

You are implementing roadmap slice 16 of **v1.4 — Range library and filtering**. The
library can already sort by "Name (A–Z)" and "Recently edited" (slices 6–7), and as of
slices 13–15 each range now carries cumulative practice stats that are persisted
(`recordPracticeSession`), threaded into `RangeLibrary` as the `practiceStats` prop, and
shown on each card. This slice adds the **"Recently practiced"** sort option from v1.4's
"Sort by" list, ordering the filtered library by each range's `lastPracticedAt` (most
recently practiced first), with never-practiced ranges sorting last. **No "Accuracy" sort
this slice** — that is the next slice and stays out of scope here.

Context (read these before starting):
- `src/domain/rangeLibrary.ts` holds the existing sort helpers. `sortRangesByUpdatedAt` is
  the closest model: it `.slice()`-copies, sorts ISO-8601 strings with
  `b.updatedAt.localeCompare(a.updatedAt)` for newest-first, never mutates the input, and
  relies on stable sort for ties. The new helper differs in one way: the timestamp to sort
  by lives in a separate `practiceStats` map keyed by range id, not on the range itself, so
  the helper takes that map as a second argument and looks up `practiceStats[range.id]`.
- `src/types/practice.ts` — `RangePracticeStats` has `lastPracticedAt` (ISO-8601). The
  helper only needs `{ lastPracticedAt }`, so type its map parameter structurally (e.g.
  `Record<string, { lastPracticedAt: string }>`) to stay decoupled, matching how the other
  helpers constrain `T` to minimal shapes.
- `src/components/RangeLibrary.tsx` already receives `practiceStats` (slice 15) and owns the
  `sort` state as a `'' | 'name' | 'recent'` union, choosing the sort via a ternary over
  `sortRangesByName`/`sortRangesByUpdatedAt`. Extend the union with a `'practiced'` member,
  add a `<option value="practiced">Recently practiced</option>` to the sort `<select>`, and
  call the new helper (passing `practiceStats`) when `sort === 'practiced'`. Keep the
  `onChange` cast in step with the widened union.
- `src/domain/rangeLibrary.test.ts` and `src/components/RangeLibrary.test.tsx` show the
  established test patterns to mirror (the "Recently edited" sort tests are the closest
  analog).

Task — add the domain sort helper, then wire a "Recently practiced" option into the library
sort select:
- In `src/domain/rangeLibrary.ts`, add
  `sortRangesByLastPracticed<T extends { id: string }>(ranges: T[], practiceStats:
  Record<string, { lastPracticedAt: string }>): T[]`. Return a `.slice()` copy sorted so
  ranges with a more recent `practiceStats[range.id]?.lastPracticedAt` come first; ranges
  with **no** stats entry sort after every practiced range (treat a missing entry as "never
  practiced" — e.g. fall back to an empty string, which sorts before any real ISO timestamp,
  so comparing `b` vs `a` puts the practiced ranges first and the never-practiced ones last).
  Never mutate the input; rely on stable sort for ties. Add a doc comment in the same style as
  `sortRangesByUpdatedAt`, calling out the missing-entry behavior.
- In `src/components/RangeLibrary.tsx`: widen the `sort` state union to
  `'' | 'name' | 'recent' | 'practiced'`; add the `Recently practiced` option to the sort
  select (after `Recently edited`); and extend the sort selection so `sort === 'practiced'`
  returns `sortRangesByLastPracticed(filtered, practiceStats)`. Update the component doc
  comment's sort description to mention the new option.

Tests to add/update:
- `src/domain/rangeLibrary.test.ts`: cover `sortRangesByLastPracticed` — orders practiced
  ranges most-recent-first by `lastPracticedAt`; places ranges with no `practiceStats` entry
  last; preserves input order for equal timestamps (stability); and does not mutate the input
  array.
- `src/components/RangeLibrary.test.tsx`: add a case selecting "Recently practiced" from the
  sort select (passing a `practiceStats` map) and asserting the rendered `.range-item-name`
  order is most-recently-practiced first with the never-practiced range last. Mirror the
  existing "reorders ... when Recently edited is selected" test.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the `sortRangesByLastPracticed` helper and the "Recently
  practiced" sort wiring (plus tests). Do NOT add the "Accuracy" sort (next slice), and do NOT
  change the stats type, storage, or the card display.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep poker/library logic in `src/domain/`, not in the component; keep the change small and
  reversible.

Suggested commit message:
- `feat: sort range library by recently practiced`
