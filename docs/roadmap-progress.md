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
| 16 | Sort saved ranges by recently practiced | v1.4 — Range library and filtering | 2026-06-05 |

## Next slice

- **Number:** 17
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Sort saved ranges by accuracy

### Prompt

You are implementing roadmap slice 17 of **v1.4 — Range library and filtering**. The
library can already sort by "Name (A–Z)", "Recently edited", and "Recently practiced"
(slices 6–7, 16). Each range carries cumulative practice stats that are persisted, threaded
into `RangeLibrary` as the `practiceStats` prop, and shown on each card (slices 13–15). This
slice adds the final **"Accuracy"** sort option from v1.4's "Sort by" list, ordering the
filtered library by each range's cumulative practice accuracy (highest accuracy first), with
never-practiced ranges sorting last. With this slice the v1.4 "Sort by" list (Recently
edited, Recently practiced, Accuracy, Name) is complete.

Context (read these before starting):
- `src/domain/rangeLibrary.ts` holds the existing sort helpers.
  `sortRangesByLastPracticed` (slice 16) is the closest model: it `.slice()`-copies, takes
  the `practiceStats` map keyed by range id as a second argument, looks up
  `practiceStats[range.id]`, treats a missing entry as "never practiced" so it sorts last,
  never mutates the input, and relies on stable sort for ties. The new helper follows the
  same shape but sorts by a derived numeric accuracy rather than a timestamp string.
- `src/domain/practiceStats.ts` — `practiceAccuracyPercentage(stats)` already derives
  `correctAttempts / totalAttempts * 100` with a zero-attempt guard, but it requires a full
  `RangePracticeStats`. To stay decoupled like `sortRangesByLastPracticed` (which typed its
  map structurally), type the new helper's map parameter as the minimal shape it needs —
  `Record<string, { totalAttempts: number; correctAttempts: number }>` — and compute accuracy
  inline (the same one-line division with the zero guard) rather than coupling to the fuller
  type. A never-practiced range is one with **no** stats entry **or** `totalAttempts === 0`;
  map both to a sentinel below every real 0–100 accuracy (e.g. `-1`) so they sort last, and a
  practiced 0%-accuracy range (real 0) still sorts above a never-practiced one.
- `src/components/RangeLibrary.tsx` already receives `practiceStats` and owns the `sort`
  state as a `'' | 'name' | 'recent' | 'practiced'` union, choosing the sort via a ternary
  chain over `sortRangesByName` / `sortRangesByUpdatedAt` / `sortRangesByLastPracticed`.
  Extend the union with an `'accuracy'` member, add an `<option value="accuracy">Accuracy
  </option>` to the sort `<select>` (after "Recently practiced"), and call the new helper
  (passing `practiceStats`) when `sort === 'accuracy'`. Keep the `onChange` cast in step with
  the widened union.
- `src/domain/rangeLibrary.test.ts` and `src/components/RangeLibrary.test.tsx` show the
  established test patterns to mirror (the `sortRangesByLastPracticed` / "Recently practiced"
  tests added in slice 16 are the closest analog).

Task — add the domain sort helper, then wire an "Accuracy" option into the library sort
select:
- In `src/domain/rangeLibrary.ts`, add
  `sortRangesByAccuracy<T extends { id: string }>(ranges: T[], practiceStats:
  Record<string, { totalAttempts: number; correctAttempts: number }>): T[]`. Return a
  `.slice()` copy sorted by derived accuracy descending (highest first). Derive each range's
  accuracy from `practiceStats[range.id]`: a missing entry or `totalAttempts === 0` maps to a
  sentinel below every real accuracy (so never-practiced ranges sort last), otherwise
  `correctAttempts / totalAttempts * 100`. Compare so higher accuracy comes first. Never
  mutate the input; rely on stable sort for ties. Add a doc comment in the same style as
  `sortRangesByLastPracticed`, calling out the never-practiced (missing / zero-attempt)
  behavior.
- In `src/components/RangeLibrary.tsx`: widen the `sort` state union to
  `'' | 'name' | 'recent' | 'practiced' | 'accuracy'`; add the `Accuracy` option to the sort
  select (after `Recently practiced`); and extend the sort selection so `sort === 'accuracy'`
  returns `sortRangesByAccuracy(filtered, practiceStats)`. Update the component doc comment's
  sort description to mention the new option.

Tests to add/update:
- `src/domain/rangeLibrary.test.ts`: cover `sortRangesByAccuracy` — orders practiced ranges
  highest-accuracy first; places ranges with no `practiceStats` entry last; sorts a practiced
  0%-accuracy range (totalAttempts > 0, correctAttempts 0) above a never-practiced one;
  preserves input order for equal accuracy (stability); and does not mutate the input array.
- `src/components/RangeLibrary.test.tsx`: add a case selecting "Accuracy" from the sort
  select (passing a `practiceStats` map) and asserting the rendered `.range-item-name` order
  is highest-accuracy first with the never-practiced range last. Mirror the existing
  "reorders ... when Recently practiced is selected" test.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the `sortRangesByAccuracy` helper and the "Accuracy" sort
  wiring (plus tests). Do NOT change the stats type, storage, or the card display.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep poker/library logic in `src/domain/`, not in the component; keep the change small and
  reversible.

Suggested commit message:
- `feat: sort range library by accuracy`
