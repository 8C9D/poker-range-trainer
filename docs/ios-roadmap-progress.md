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

## Next slice

**Slice 3 — Synchronous `localStorage` shim over MMKV, with a `@core/storage` round-trip test**

Milestone: M1 — Platform adapters: storage + identity.

Context: M0 is complete. The Expo app (SDK 56, Expo Router) reuses `@core`
end-to-end: the alias resolves for tsc (`paths`), Jest (`moduleNameMapper`), and
Metro (custom `resolveRequest` → the in-project `mobile/coresrc` symlink to
`../src`). `bundle-check` (`expo export --platform ios`) passes headlessly.

The web core persists everything through the browser `localStorage` global:
`src/storage/storageHelpers.ts` reads via `localStorage.getItem`, and each
`src/storage/*` module writes via `localStorage.setItem`. React Native has no
`localStorage`. This slice adds the storage seam so every `@core/storage` module
runs on device **unchanged**: a synchronous `localStorage`-compatible shim backed
by `react-native-mmkv` (synchronous, JSI-based — unlike `AsyncStorage`),
installed onto `globalThis` **before any storage module loads**. Keys/values stay
identical to the web app (plain JSON strings under the same keys) so the on-disk
shape is forward-compatible with backup/cloud transfer.

Reuse targets (verified): `@core/storage/rangeStorage` exports
`loadSavedRanges(): SavedRange[]`, `saveSavedRange(range: SavedRange): void`, and
`deleteSavedRange(id: string): void`. `SavedRange` is in `@core/types`. Import
these — **never copy a storage module**.

Task:
- `npx expo install react-native-mmkv` (a native module; needs a dev build, not
  Expo Go — that's fine, the target is the App Store. JS still bundles via
  `expo export`).
- Create `mobile/platform/localStorageShim.ts`: a synchronous object implementing
  the `localStorage` surface the core uses — at minimum `getItem(key)`,
  `setItem(key, value)`, `removeItem(key)`, `clear()` (add `key(i)`/`length` if
  trivial) — backed by a single `MMKV` instance (`getString`/`set`/`delete`/
  `clearAll`/`getAllKeys`). Export an `installLocalStorage()` that assigns it to
  `globalThis.localStorage` only if absent. Keep the MMKV instance creation lazy
  so the module can be imported under Jest (where the native module is mocked).
- Create `mobile/platform/installStorage.ts` that calls `installLocalStorage()` as
  an import side-effect, and import it on the **first line** of
  `mobile/app/_layout.tsx` (the router entry that loads before any screen), so the
  shim exists before screens import `@core/storage`.
- Jest: the MMKV native module isn't available under jest-expo. Add a mock (e.g. a
  `mobile/__mocks__/react-native-mmkv.ts` or `jest.mock(...)` in the test) that
  implements `MMKV` with an in-memory `Map` (`set`/`getString`/`delete`/
  `clearAll`/`getAllKeys`). Confirm the mock is picked up.
- Add `mobile/__tests__/storage-shim.test.ts`: install the shim (with the mocked
  MMKV), then import `loadSavedRanges`/`saveSavedRange` from
  `@core/storage/rangeStorage`; save a literal `SavedRange` (construct it inline
  with a fixed `id` — do **not** rely on `createRangeId`/`crypto.randomUUID`; the
  Hermes randomness polyfill is a later M1 slice), then assert `loadSavedRanges()`
  returns it (round-trip). Optionally assert the MMKV-backed key matches the web
  key the core uses.

Files to create/modify:
- Create: `mobile/platform/localStorageShim.ts`,
  `mobile/platform/installStorage.ts`, the MMKV jest mock, and
  `mobile/__tests__/storage-shim.test.ts`.
- Modify: `mobile/package.json` + `mobile/package-lock.json` (react-native-mmkv),
  `mobile/app/_layout.tsx` (import the installer first).

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass. Run `npm install` in `mobile/` first
  (new dependency). Confirm `bundle-check` still produces the iOS bundle with
  react-native-mmkv in the graph.

Constraints: reuse `@core/storage` unchanged (the shim adapts the platform, the
core is not edited); native adapters live in `mobile/platform/`; keep it minimal
and reversible. Do not edit anything under `src/`.

Suggested commit message:
`feat(ios): add MMKV-backed localStorage shim for @core storage`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
