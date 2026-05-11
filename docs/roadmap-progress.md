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

## Next slice

- **Number:** 15
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Show per-range practice stats (last practiced + accuracy) on library cards

### Prompt

You are implementing roadmap slice 15 of **v1.4 — Range library and filtering**. The
persisted practice-stats pipeline is now complete end to end: slice 13 built the store
(`RangePracticeStats` in `src/types/practice.ts`; `loadPracticeStats()` /
`recordPracticeSession()` in `src/storage/practiceStatsStorage.ts`) and slice 14 wired
recording so finishing a practice session folds its attempts into the range's cumulative
`totalAttempts`, `correctAttempts`, and `lastPracticedAt`. But nothing **shows** those stats
yet. This slice is the display step: surface each range's accumulated practice performance on
its library card — a **"Last practiced"** date and an **accuracy** percentage — following the
project's "data → behavior → display" rhythm. v1.4's range cards call for "Last practiced" and
"Accuracy" fields, and this delivers them. **No sorting this slice** — the "Recently
practiced" and "Accuracy" *sorts* are the next two slices and stay out of scope here.

Context (read these before starting):
- `src/types/practice.ts` — `RangePracticeStats` has `rangeId`, `totalAttempts`,
  `correctAttempts`, and `lastPracticedAt` (ISO-8601). Its doc comment already says accuracy
  is "derived later as `correctAttempts / totalAttempts` (guarding the zero-attempt case)" —
  that derivation is this slice's domain helper. Do not change this type.
- `src/storage/practiceStatsStorage.ts` — `loadPracticeStats(): Record<string,
  RangePracticeStats>` returns the stats map keyed by `rangeId` (empty `{}` when nothing is
  stored). Do not change it.
- `src/App.tsx` is the storage orchestrator and already holds `savedRanges` in state,
  refreshing it via `setSavedRanges(loadSavedRanges())` after every mutation. It renders
  `<RangeLibrary ranges={savedRanges} ... />` and, as of slice 14, records a finished session
  in `handleEndPractice(summary)` via `recordPracticeSession(practicingRange.id, summary)`
  before `setPracticingRange(null)`. This slice adds a sibling `practiceStats` state so the
  freshly recorded numbers reach the library.
- `src/components/RangeLibrary.tsx` renders each range as a card under
  `<div className="range-item-info">`, with derived `combos`/`percentage` lines built from
  domain helpers (`countSelectedCombos`, `calculateRangePercentage`) — the component owns no
  math of its own. Add the practice-stats line the same way: derive via a domain helper, don't
  inline the arithmetic. Existing badges/scenario/notes lines show how conditional card lines
  are rendered (only when present).
- `src/components/RangeLibrary.test.tsx` constructs the component directly and passes every
  prop at ~20 call sites. To avoid churning all of them, make the new `practiceStats` prop
  **optional with a `{}` default**, so existing renders compile and behave unchanged.
- Existing domain modules (e.g. `src/domain/rangeFavorite.ts`, `rangeArchive.ts`) show the
  one-module-per-concern + colocated-`.test.ts` convention to mirror for the new helper.

Task — derive accuracy in the domain, thread the stats map through App, and render a
last-practiced/accuracy line on each card:
- Add `src/domain/practiceStats.ts` exporting
  `practiceAccuracyPercentage(stats: RangePracticeStats): number` =
  `totalAttempts === 0 ? 0 : (correctAttempts / totalAttempts) * 100`. Keep it pure (no React,
  no storage), matching `summarizePracticeAttempts`'s zero-guard style. (A range that has been
  recorded always has `totalAttempts > 0`, but guard zero anyway so the helper is total.)
- In `src/App.tsx`: import `loadPracticeStats` from `./storage/practiceStatsStorage`; add
  `const [practiceStats, setPracticeStats] = useState(() => loadPracticeStats())`. In
  `handleEndPractice`, after `recordPracticeSession(...)`, refresh with
  `setPracticeStats(loadPracticeStats())` (same refresh-after-write pattern as
  `setSavedRanges(loadSavedRanges())`). Pass `practiceStats={practiceStats}` into
  `<RangeLibrary>`.
- In `src/components/RangeLibrary.tsx`: add an optional prop
  `practiceStats?: Record<string, RangePracticeStats>` defaulting to `{}` (import the type
  from `../types/practice`). For each card, look up `practiceStats[range.id]`; when present
  (and `totalAttempts > 0`), render one line inside `range-item-info` — e.g. a
  `<span className="range-item-practice">` reading
  `Practiced {totalAttempts} · {practiceAccuracyPercentage(stats).toFixed(0)}% accuracy · last {date}`,
  where `date = new Date(stats.lastPracticedAt).toLocaleDateString()`. Ranges with no recorded
  stats render no such line (mirror the existing `scenarioParts`/`notes` conditional pattern).
  Update the component doc comment to mention the practice-stats line. Do not add sorting.

Tests to add/update:
- `src/domain/practiceStats.test.ts`: cover `practiceAccuracyPercentage` — a perfect record
  (e.g. 4/4 → 100), a partial record (e.g. 1/4 → 25), and the zero-attempt guard (0/0 → 0,
  not `NaN`).
- `src/components/RangeLibrary.test.tsx`: add a case rendering a range whose `id` has an entry
  in a passed `practiceStats` map (e.g. `{ totalAttempts: 4, correctAttempts: 3,
  lastPracticedAt: '2026-06-01T00:00:00.000Z', rangeId: 'r1' }`) and assert the card shows the
  attempt count and `75% accuracy`. Add a case proving a range with no stats entry (and the
  default-empty `practiceStats`) renders no practice line (query the `.range-item-practice`
  class is absent).
- `src/App.test.tsx` (`Practice mode` block): extend the end-to-end flow — after answering one
  hand and clicking "End Practice", assert the returned library card now shows a practice-stats
  line (e.g. `getByText(/100% accuracy/)` when the single answer was correct). Reuse the
  read-the-prompt-hand-and-answer-truthfully approach already in that block so accuracy is
  deterministic.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the accuracy domain helper, the App `practiceStats` state +
  prop wiring, and the RangeLibrary card line (plus tests). Do NOT add the "Recently
  practiced" or "Accuracy" *sorts* (next two slices), and do NOT change `RangePracticeStats`,
  `loadPracticeStats`, or `recordPracticeSession` — those are done.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible; keep poker/stats derivation in `src/domain/`, not in
  the component.

Suggested commit message:
- `feat: show per-range practice stats on library cards`
