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

## Next slice

**Slice 9 — Range editor screen: name field + grid + live save via `@core` storage**

Milestone: M2 — Core trainer MVP (parity with web v1).

Context: the `HandGrid` (`mobile/components/HandGrid.tsx`) is done — controlled,
tap + drag-paint, `onSetSelected(hand, selected)`. The storage shim + identity
polyfill are installed at entry; `crypto.randomUUID` exists on device (slice 4).
This slice adds the screen that turns the grid into a saved range. The library
screen (slice 10) will list ranges and open this editor for editing.

Reuse (verified, import — never copy): `@core/storage/rangeStorage` exports
`saveSavedRange(range: SavedRange): void`, `findSavedRangeById(id): SavedRange |
undefined`, `loadSavedRanges()`. `SavedRange` (`@core/types/range`) minimally needs
`{ id, name, hands: PokerHand[], createdAt, updatedAt }` (ISO strings).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add `mobile/platform/createRangeId.ts`: `createRangeId(): string` returning
  `expo-crypto`'s `randomUUID()` (type-safe + testable; the mobile UI's equivalent
  of the web `createRangeId`). Do not read the untyped `crypto` global.
- Add `mobile/app/editor.tsx` (Expo Router screen):
  - Read an optional `id` via `useLocalSearchParams`. If present, load with
    `findSavedRangeById(id)` into local state; otherwise start a NEW draft with
    `createRangeId()` and `createdAt = updatedAt = new Date().toISOString()`.
  - State: `name` (string) and `selected` (`Set<PokerHand>`). Render a themed
    name `TextInput` (placeholder e.g. "Range name") and the `<HandGrid selected=…
    onSetSelected=…/>` wired to a `useCallback` setter that adds/removes the hand
    and updates state immutably.
  - **Live save:** in a `useEffect` keyed on name + the selected set, persist via
    `saveSavedRange({ id, name, hands: [...selected], createdAt, updatedAt: new
    Date().toISOString() })` — but skip the very first effect run for an existing
    range so merely opening it doesn't rewrite `updatedAt` (e.g. guard with a
    "hydrated" ref). Keep `id`/`createdAt` stable in refs/state across renders.
  - Set the header title via `<Stack.Screen options={{ title: … }}>` ("New range"
    vs the range name). Use theme tokens; wrap content so the grid has sensible
    padding and the screen scrolls if needed.
- Make it reachable: on `mobile/app/index.tsx`, add a themed "New range" button
  (`Link`/`router.push` to `/editor`) so the editor can be opened and tested before
  the library exists.
- Tests:
  - `mobile/__tests__/create-range-id.test.ts`: mock `expo-crypto`; assert
    `createRangeId()` returns its `randomUUID()`.
  - `mobile/__tests__/editor-screen.test.tsx`: install the storage shim (MMKV mock,
    as in `storage-shim.test.ts`); mock `expo-router` (`useLocalSearchParams` → `{}`
    for a new range; stub `Stack.Screen`/`Link`/`router`) and `expo-crypto`
    (deterministic id). Render the editor, type a name (`fireEvent.changeText`),
    toggle a hand (`fireEvent.press(getByTestId('hand-cell-AA'))`), then assert
    `loadSavedRanges()` returns a range with that name + `hands: ['AA']` and the
    fixed id. (RNTL v14 — `await render`.)

Files: create `mobile/platform/createRangeId.ts`, `mobile/app/editor.tsx`,
`mobile/__tests__/create-range-id.test.ts`, `mobile/__tests__/editor-screen.test.tsx`;
modify `mobile/app/index.tsx` (entry button). No `src/` edits, no new dependency
(expo-crypto already present).

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/storage` unchanged; screens in `mobile/app/`, helpers in
`mobile/platform/`; keep the editor controlled and minimal. If the slice grows too
large, it is acceptable to land new-range create first and defer edit-by-id to the
library slice — but prefer supporting both. Do not edit `src/`.

Suggested commit message:
`feat(ios): add range editor screen with live save via @core storage`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
