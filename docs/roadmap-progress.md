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

## Next slice

- **Number:** 9
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Archive / unarchive a saved range (persisted flag)

### Prompt

You are implementing roadmap slice 9 of **v1.4 — Range library and filtering**. Search,
the four filters, two sorts (Name, Recently edited), and Duplicate now exist. The next
two sort keys — **Recently practiced** and **Accuracy** — remain BLOCKED (the app
persists no practice history yet), so this slice continues in roadmap order with the
next library-management feature: **Archive range**.

This slice adds a *persisted* `archived` flag plus an Archive/Unarchive toggle on each
range card and a small "Archived" badge. To keep the slice small, **archived ranges
stay visible in the list for now** — hiding them by default behind a "Show archived"
toggle is the NEXT slice. Favorite is a later slice still.

Context:
- `SavedRange` (`src/types/range.ts`) currently has `id`, `name`, `hands`, `createdAt`,
  `updatedAt`, and optional `metadata`. Archive state is library management, not
  scenario metadata, so it is a NEW top-level optional field `archived?: boolean`, not
  part of `RangeMetadata`. Absent or `false` means active.
- `src/storage/rangeStorage.ts` validates/normalizes ranges. `parseSavedRange` builds
  an explicit object literal and uses a conditional spread for `metadata`
  (`...(normalizedMetadata ? { metadata: normalizedMetadata } : {})`); it does NOT
  currently read `archived`. `saveSavedRange` does `const { metadata, ...rest } = range`
  and spreads `...rest`, so a top-level `archived` would pass through unnormalized —
  including `archived: false`, which we do not want persisted.
- `src/App.tsx` owns saved-range state and all storage calls; after any mutation it
  refreshes with `setSavedRanges(loadSavedRanges())`. `handleDelete`/`handleDuplicate`
  show the pattern. Archiving must NOT change the editor selection or `editingId`.
- `src/components/RangeLibrary.tsx` renders each card with a `.range-item-info` block
  (name, stats, scenario, notes) and a `.range-item-actions` block holding the
  Practice, Load, Duplicate, and Delete buttons. Buttons use
  `aria-label={`<Verb> range ${range.name}`}` and call a callback prop. Callbacks come
  in via the `RangeLibraryProps` interface at the top of the file.

Task:
- Type: add `archived?: boolean` to `SavedRange` with a doc comment ("Library archive
  state; absent/false = active. Hidden-by-default filtering comes in a later slice.").
- Storage:
  - In `parseSavedRange`, read `archived` from the raw object and include
    `archived: true` in the returned literal ONLY when the stored value is strictly
    `true` (mirror the metadata conditional spread); omit the key otherwise, so old and
    active ranges carry no `archived` key.
  - In `saveSavedRange`, destructure `archived` out alongside `metadata` and re-add it
    conditionally (`...(archived === true ? { archived: true } : {})`) so `false`/
    `undefined` never persists the key.
- Domain: create `src/domain/rangeArchive.ts` exporting a pure
  `setRangeArchived(range: SavedRange, archived: boolean): SavedRange`. It returns a
  NEW range (shallow top-level copy): when `archived` is true it sets `archived: true`;
  when false it OMITS the `archived` key entirely. It does NOT change `updatedAt`,
  `createdAt`, or any other field, and must not mutate `range`. Import `SavedRange`
  from `../types/range`. Like `rangeDuplication.ts`, this helper owns the full
  `SavedRange` shape, so keep it in its own file rather than in `rangeLibrary.ts`.
- App: add `handleArchive(range: SavedRange)` that persists
  `setRangeArchived(range, !range.archived)` via `saveSavedRange`, then refreshes with
  `setSavedRanges(loadSavedRanges())`; do not touch `editingId`/selection. Pass
  `onArchive={handleArchive}` to `<RangeLibrary>`.
- Component: add `onArchive: (range: SavedRange) => void` to `RangeLibraryProps`. In
  `.range-item-actions`, add an Archive button between Duplicate and Delete whose
  visible text and `aria-label` reflect state — `Unarchive` /
  `aria-label={`Unarchive range ${range.name}`}` when `range.archived`, else
  `Archive` / `aria-label={`Archive range ${range.name}`}` — calling `onArchive(range)`.
  When `range.archived`, render an "Archived" badge span (e.g.
  `className="range-item-badge"`) inside `.range-item-info`. Update the component doc
  comment to mention the archive toggle.

Keep domain logic separate: storage normalization stays in `rangeStorage.ts`, the pure
transform in `rangeArchive.ts`; the component only renders state and calls `onArchive`.

Files to create or modify:
- `src/types/range.ts` — add `archived?: boolean`.
- `src/storage/rangeStorage.ts` — parse + save normalization for `archived`.
- `src/storage/rangeStorage.test.ts` — archived round-trips; `false`/absent omit the
  key; a non-boolean `archived` is ignored.
- `src/domain/rangeArchive.ts` — new: the `setRangeArchived` helper.
- `src/domain/rangeArchive.test.ts` — new: unit tests for the helper.
- `src/components/RangeLibrary.tsx` — add the `onArchive` prop, the Archive/Unarchive
  button, the Archived badge, and a mention of the archive toggle in the doc comment.
- `src/components/RangeLibrary.test.tsx` — pass `onArchive` to the existing renders
  (`vi.fn()` is fine for the ones that don't exercise it); test the toggle button and
  badge.
- `src/components/RangeLibrary.css` — optional badge styling; reuse existing tokens.
- `src/App.tsx` — add `handleArchive` and pass `onArchive` to `<RangeLibrary>`.

Tests to add:
- `setRangeArchived`: archiving sets `archived: true`; unarchiving omits the key
  (`'archived' in result === false`); `updatedAt`/`createdAt`/`name`/`hands`/`metadata`
  are unchanged; does not mutate the source (snapshot with `structuredClone`).
- Storage: a range with `archived: true` survives a save→load round-trip; both
  `archived: false` and an absent flag load with no `archived` key; a non-boolean
  `archived` is ignored.
- Component: the toggle calls `onArchive` exactly once with the range
  (`toHaveBeenCalledExactlyOnceWith(range)`); a range with `archived: true` exposes an
  "Unarchive range <name>" button and an "Archived" badge; an active range exposes an
  "Archive range <name>" button and no badge.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the persisted archive flag, the toggle, and the badge.
  Do NOT hide archived ranges or add a "Show archived" toggle yet (that is the next
  slice), and do NOT add favorite.
- **Recently practiced** and **Accuracy** sorts, plus the "Last practiced" / accuracy
  fields on richer range cards, remain BLOCKED until a future slice adds
  practice-result persistence. Do not add that persistence here.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library archive toggle`
