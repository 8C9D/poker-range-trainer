# iOS roadmap slice progress

State file for the [`build-ios-app`](../.claude/skills/build-ios-app/SKILL.md)
skill. The skill reads this file on every invocation to find the next slice to
build, and rewrites it as part of each committed slice. You can hand-edit the
**Next slice** prompt below to steer what gets built next — the skill uses
whatever is here.

- Scope and ordering come from [`ios-roadmap.md`](./ios-roadmap.md).
- Project rules (validation, commit style, separation of concerns) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- This is a **separate track** from the web roadmap's
  [`roadmap-progress.md`](./roadmap-progress.md); the two never collide.
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken
  in milestone order — never a whole milestone at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline

Nothing built yet. The web app (`src/`) is complete through web-roadmap v6 and is
the source of the reusable `@core` logic. The iOS app does not exist; `mobile/`
has not been created.

The first target is **M0 — Foundation: Expo app + shared-core reuse**.

## Completed slices

| # | Slice | Milestone | Date |
|---|-------|-----------|------|
| 1 | Scaffold Expo app in `mobile/` with isolated toolchain | M0 | 2026-06-13 |
| 2 | Wire `@core/*` alias + bundle-check; prove shared-core reuse bundles | M0 | 2026-06-13 |
| 3 | Synchronous `localStorage` shim over MMKV (+ `@core/storage` round-trip test) | M1 | 2026-06-13 |
| 4 | Hermes `crypto.randomUUID` polyfill for identity, installed at entry | M1 | 2026-06-13 |
| 5 | Storage parity test: web keys + full backup round-trip through the shim | M1 | 2026-06-13 |
| 6 | Dark theme tokens + themed navigation shell | M2 | 2026-06-14 |
| 7 | 13×13 tap-to-toggle `HandGrid`/`HandCell` reusing the core matrix | M2 | 2026-06-14 |
| 8 | Drag-paint `HandGrid` via gesture handler (+ fix react/renderer version skew) | M2 | 2026-06-14 |
| 9 | Range editor screen: name + grid + live save via `@core` storage | M2 | 2026-06-14 |
| 10 | Range library screen: list / open / edit / delete (home screen) | M2 | 2026-06-14 |
| 11 | Recognition practice screen + session stats (completes M2) | M2 | 2026-06-14 |
| 12 | Live hand/combo/percentage stats bar in the range editor | M3 | 2026-06-14 |
| 13 | Range shortcut buttons (pairs / broadways) in the editor | M3 | 2026-06-14 |
| 14 | Range notation import/export (clipboard) + clear-range (completes M3) | M3 | 2026-06-14 |
| 15 | Scenario metadata editor in the range editor | M4 | 2026-06-14 |
| 16 | Library search by name | M4 | 2026-06-14 |
| 17 | Library metadata filters (position / action / game) | M4 | 2026-06-14 |

## Next slice

**Slice 18 — Library sorts (name / recently edited / recently practiced / accuracy)**

Milestone: M4 — Library & organization (web v1.3–v1.4).

Context: the library (`mobile/app/index.tsx`) has search (slice 16) + metadata
filters (slice 17) producing a `visible` list. This slice adds a sort selector that
orders that list, reusing the tested sort helpers. The shared `ChipRow`
(`mobile/components/ChipRow.tsx`) exists.

Reuse (verified, import — never copy):
- `@core/domain/rangeLibrary`: `sortRangesByName(ranges)`,
  `sortRangesByUpdatedAt(ranges)` (most recently edited first), and the
  practice-stats-driven `sortRangesByLastPracticed(ranges, practiceStats)` and
  `sortRangesByAccuracy(ranges, practiceStats)` — each returns a fresh sorted array.
- `@core/storage/practiceStatsStorage`: `loadPracticeStats(): Record<string,
  RangePracticeStats>` for the last-two sorts. (`RangePracticeStats` carries
  `lastPracticedAt`, `totalAttempts`, `correctAttempts` — the subset shapes those
  helpers expect; confirm in `src/storage/practiceStatsStorage.ts` /
  `src/types/practice.ts`.)

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add `sort` state: `'name' | 'updated' | 'practiced' | 'accuracy'` (default
  `'updated'`). Add `practiceStats` state loaded with `loadPracticeStats()`; reload it
  alongside `ranges` in the focus `reload` callback (so it stays fresh).
- Apply the sort to the filtered list in a `useMemo` (deps include the filtered list,
  `sort`, and `practiceStats`): map each `sort` to its helper; pass `practiceStats` for
  `practiced`/`accuracy`.
- Sort selector UI: a single-select chip/segment row (Name / Recent / Practiced /
  Accuracy) — one is always active (tapping just switches; no clear). `testID`s e.g.
  `sort-name`, `sort-updated`, `sort-practiced`, `sort-accuracy`. (You may render
  simple chips inline rather than `ChipRow`, since sort never clears to undefined.)
- Tests (extend `mobile/__tests__/library-screen.test.tsx`): seed two ranges with
  different `updatedAt` (e.g. "Alpha" older, "Bravo" newer) and assert the displayed
  order changes between `sort-name` (Alpha first) and `sort-updated` (Bravo first) —
  read order via `getAllByTestId(/^range-row-/)` and check the first row's testID.
  Single tap per assertion → `fireEvent` is fine (use `userEvent` only if you chain).

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/rangeLibrary` sorts (no hand-rolled comparators);
sort composes after search+filters over the focus-reloaded list; UI in `mobile/`. Do
not edit `src/`.

Suggested commit message:
`feat(ios): add sort options to the range library`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
