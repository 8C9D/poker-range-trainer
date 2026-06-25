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

## Next slice

**Slice 10 — Range library screen: list / open / edit / delete (becomes the home screen)**

Milestone: M2 — Core trainer MVP (parity with web v1).

Context: the editor (`mobile/app/editor.tsx`) creates/edits a range and live-saves
via `@core/storage`; it reads an optional `?id=` to edit an existing range and a
"New range" `Link` already exists on the placeholder home screen. This slice
replaces that placeholder with the real **range library** — the app's main screen —
listing saved ranges and supporting open-to-edit and delete. After this slice the
full v1 create → save → edit → delete loop works on device (only practice remains
for M2, slice 11).

Reuse (verified, import — never copy): `@core/storage/rangeStorage` exports
`loadSavedRanges(): SavedRange[]` and `deleteSavedRange(id: string): void`.
Optional summary helpers in `@core/domain/rangeMath`: `calculateRangePercentage(
hands)` and `countSelectedCombos(hands)`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Replace `mobile/app/index.tsx` with the library screen:
  - Load ranges with `loadSavedRanges()` into state, and **reload on focus** so the
    list reflects edits made in the editor — use `useFocusEffect` (from `expo-router`)
    with a `useCallback`. Also load on mount.
  - Render a `FlatList` (or mapped list) of ranges. Each row shows the range name and
    a small summary (e.g. `${hands.length} hands` or `calculateRangePercentage` %),
    is a `Link`/`router.push` to `/editor?id=<id>` to edit, and has a delete control
    (a button/icon) that confirms via `Alert.alert` then calls `deleteSavedRange(id)`
    and reloads the list. Use `testID`s like `range-row-<id>` and `delete-<id>`.
  - Themed empty state when there are no ranges (e.g. "No ranges yet — create one").
  - Keep a "New range" action (header button or a `Link` to `/editor`).
  - Set the header title via `<Stack.Screen options={{ title: 'Ranges' }}>`.
  - If a small `mobile/components/RangeListItem.tsx` keeps the screen clean, add it;
    otherwise inline. RN UI lives in `mobile/components/` / `mobile/app/`.
- Tests:
  - Replace `mobile/__tests__/home-screen.test.tsx` with
    `mobile/__tests__/library-screen.test.tsx`: install the storage shim (MMKV mock);
    mock `expo-router` (`useFocusEffect: (cb) => cb()` so focus-load runs once,
    `Link` passthrough, `Stack.Screen` → null, `router`/`useRouter` as needed). Seed
    two ranges via `saveSavedRange`, render, assert both names appear. Then exercise
    delete: spy on `Alert.alert` to invoke its confirm button's `onPress`, press the
    delete control, and assert the range is gone from `loadSavedRanges()` and the UI.
  - Update any `APP_TITLE` usage that the old home test relied on (the placeholder
    title may go away — adjust or drop that assertion).

Files: modify `mobile/app/index.tsx`; create `mobile/__tests__/library-screen.test.tsx`
(replacing `home-screen.test.tsx`); optionally `mobile/components/RangeListItem.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/storage` unchanged; the list is read-from-storage +
reload-on-focus (no duplicate client state of truth); keep delete behind a
confirmation. Screens in `mobile/app/`, components in `mobile/components/`. Do not
edit `src/`.

Suggested commit message:
`feat(ios): add range library screen with open/edit/delete`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
