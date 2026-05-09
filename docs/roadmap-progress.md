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

## Next slice

- **Number:** 8
- **Roadmap target:** v1.4 — Range library and filtering
- **Working title:** Duplicate a saved range

### Prompt

You are implementing roadmap slice 8 of **v1.4 — Range library and filtering**. The
search, four filters, and two sorts (Name, Recently edited) now exist. The next two
sort keys in the roadmap — **Recently practiced** and **Accuracy** — are BLOCKED
because the app does not persist any practice history yet, so this slice instead picks
up the next unblocked v1.4 feature in roadmap order: **Duplicate range**. It copies an
existing saved range into a new, independent saved range so the user can branch a
variation without rebuilding it.

Context:
- The library `src/components/RangeLibrary.tsx` renders each saved range as a
  `<li className="range-item">` whose `.range-item-actions` div holds three buttons —
  Practice, Load, Delete — each calling a callback prop (`onPractice`, `onLoad` with
  the `range`; `onDelete` with `range.id`) and labelled `aria-label={`<Verb> range
  ${range.name}`}`. The component takes its callbacks via the `RangeLibraryProps`
  interface at the top of the file.
- `src/App.tsx` owns the saved-ranges state and all storage calls. It passes
  `onLoad={handleLoad}`, `onDelete={handleDelete}`, `onPractice={handlePractice}` to
  `<RangeLibrary>`. After any storage mutation it refreshes state with
  `setSavedRanges(loadSavedRanges())`. New ids come from the existing
  `createRangeId()` helper; timestamps from `new Date().toISOString()`. `handleSave`
  already shows the pattern for constructing a `SavedRange` and persisting it via
  `saveSavedRange`.
- `saveSavedRange(range)` (in `src/storage/rangeStorage.ts`) inserts a range with a
  new id by appending it to the end of storage order, and re-normalizes hands and
  metadata — so a duplicate only needs a fresh id and is appended after the original.
- `SavedRange` (see `src/types/range.ts`) has `id`, `name`, `hands`, `createdAt`,
  `updatedAt`, and optional `metadata` (a `RangeMetadata` object). `metadata`, when
  present, is a flat object of optional scalar fields, so a shallow copy fully
  detaches it from the source.

Task:
- Give each range card a fourth action button, "Duplicate", in `.range-item-actions`.
  Place it first (before Practice) or last — your call for layout, but keep the other
  three buttons and their behavior unchanged. Label it
  `aria-label={`Duplicate range ${range.name}`}` and have it call a new `onDuplicate`
  prop with the full `range`. Add `onDuplicate: (range: SavedRange) => void` to
  `RangeLibraryProps`.
- In `src/App.tsx`, add `handleDuplicate(range: SavedRange)` that builds the copy via
  the new `duplicateRange` domain helper (passing `createRangeId()` and
  `new Date().toISOString()`), persists it with `saveSavedRange`, then refreshes with
  `setSavedRanges(loadSavedRanges())`. Do NOT change the editor selection or
  `editingId` — duplicating is a library action, not an edit; the new copy simply
  appears in the list. Pass `onDuplicate={handleDuplicate}` to `<RangeLibrary>`.

Keep domain logic separate:
- Create `src/domain/rangeDuplication.ts` exporting a pure
  `duplicateRange(source: SavedRange, newId: string, timestamp: string): SavedRange`.
  It returns a NEW range object: `id: newId`; `name: `${source.name} (copy)``; a fresh
  copy of `hands` (`[...source.hands]`, not the same array reference); `createdAt` and
  `updatedAt` both set to `timestamp`; and `metadata` set to a shallow copy
  (`{ ...source.metadata }`) ONLY when `source.metadata` is present, omitted entirely
  when absent. It must NOT mutate `source` (including not sharing its `hands` or
  `metadata` references). Import `SavedRange` from `../types/range`; this helper
  legitimately owns the full shape, unlike the decoupled minimal-shape helpers in
  `rangeLibrary.ts`, so keep it in its own file rather than there.

Files to create or modify:
- `src/domain/rangeDuplication.ts` — new: the `duplicateRange` helper.
- `src/domain/rangeDuplication.test.ts` — new: unit tests for the helper.
- `src/components/RangeLibrary.tsx` — add the `onDuplicate` prop, the Duplicate
  button, and a mention of the duplicate action in the component doc comment.
- `src/components/RangeLibrary.test.tsx` — test the Duplicate button (and update the
  existing renders that construct `<RangeLibrary>` to pass an `onDuplicate` prop;
  `vi.fn()` is fine for the ones that don't exercise it).
- `src/App.tsx` — add `handleDuplicate` and pass `onDuplicate` to `<RangeLibrary>`.
- `src/components/RangeLibrary.css` — only if the extra button needs layout tweaks;
  likely no change since it reuses the existing actions row.

Tests to add:
- `duplicateRange`: gives the copy the supplied `newId`; names it `"<name> (copy)"`;
  copies `hands` by value into a fresh array (deep-equal to source hands but NOT the
  same reference); sets both `createdAt` and `updatedAt` to the supplied `timestamp`;
  shallow-copies `metadata` when present (deep-equal but not the same reference) and
  omits `metadata` entirely when the source has none; does not mutate the source
  (snapshot the source with `structuredClone` and assert it is unchanged).
- Library component: each card exposes a "Duplicate range <name>" button; clicking it
  calls `onDuplicate` exactly once with the range
  (`toHaveBeenCalledExactlyOnceWith(range)`), mirroring the existing
  Load/Delete/Practice button tests.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within v1.4 scope and within this slice: only the Duplicate action. Do NOT add
  archive or favorite (later v1.4 slices), and do NOT add unique-name disambiguation
  (e.g. "(copy 2)") — a plain " (copy)" suffix is sufficient for this slice; repeated
  duplicates may share a name.
- **Recently practiced** and **Accuracy** sorts, plus the "Last practiced" / accuracy
  fields on richer range cards, remain BLOCKED until a future slice adds
  practice-result persistence. Do not add that persistence here.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range library duplicate action`
