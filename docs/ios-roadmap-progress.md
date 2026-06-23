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

## Next slice

**Slice 4 — Hermes `crypto.randomUUID` polyfill for identity, installed at entry, with a test**

Milestone: M1 — Platform adapters: storage + identity.

Context: The **storage** half of M1 is done (slice 3). A synchronous MMKV-backed
`localStorage` shim (`mobile/platform/localStorageShim.ts`, exporting
`localStorageShim` + `installLocalStorage()`) is installed at app entry via
`mobile/platform/installStorage.ts`, imported on the first line of
`mobile/app/_layout.tsx`; `@core/storage/rangeStorage` round-trips through it
(`mobile/__tests__/storage-shim.test.ts`), with the MMKV native module replaced
under Jest by `mobile/__mocks__/react-native-mmkv.ts` (in-memory `createMMKV()`).
This slice adds the **identity** half.

Hermes (the RN JS engine) provides no `crypto` global, so `crypto.randomUUID` is
undefined on device. The shared core's id generation already guards for this:
`@core/cloud/sharedRangesRepo` and `@core/cloud/sharedPacksRepo` each have a
private `defaultGenerateId()` that uses `crypto.randomUUID()` when available and
otherwise falls back to `Date.now().toString(36) + Math.random()…`. So the core
never crashes under Hermes — but on device it silently uses the weaker
timestamp+`Math.random` id instead of a real UUID, which matters for
collision-resistant cloud-share ids. (Note: the web app's `createRangeId` lives
in `src/App.tsx`, which is web-only UI and is **not** reused; the mobile editor
will get its id generator from this polyfill in M2.)

This slice installs a Hermes `crypto.randomUUID` polyfill at app entry — mirroring
the storage-shim pattern — so the core's id helpers (and the future mobile editor)
get real UUIDs on device, while staying a strict **no-op** wherever
`crypto.randomUUID` already exists (web/test).

Task:
- `npx expo install expo-crypto` (Expo's native crypto module; exposes
  `randomUUID()`). Native module → dev build, not Expo Go; JS still bundles via
  `expo export`.
- Create `mobile/platform/cryptoShim.ts`: export `installCryptoRandomUUID()` that,
  **only if** `globalThis.crypto?.randomUUID` is not a function, ensures a `crypto`
  object exists on `globalThis` (create `{}` if absent — **never clobber** an
  existing `crypto`) and defines `randomUUID` on it, backed by `expo-crypto`'s
  `randomUUID`. Keep it import-safe like the storage shim: importing the module
  must not call native code; only calling `installCryptoRandomUUID()` touches
  expo-crypto. Idempotent.
- Create `mobile/platform/installCrypto.ts` that calls `installCryptoRandomUUID()`
  as an import side-effect (mirror `installStorage.ts`).
- Import `../platform/installCrypto` in `mobile/app/_layout.tsx` immediately
  **after** the storage installer import (both before `expo-router`), so identity
  is ready before any screen or `@core` call.
- Jest: mock `expo-crypto` (e.g. `mobile/__mocks__/expo-crypto.ts` or
  `jest.mock('expo-crypto', …)`) so `randomUUID` returns a deterministic value
  (e.g. a fixed UUID) without native code.
- Add `mobile/__tests__/crypto-shim.test.ts`: in the jest env (no
  `crypto.randomUUID`, like Hermes) assert it is initially absent; call
  `installCryptoRandomUUID()`; assert `globalThis.crypto.randomUUID()` returns the
  mocked UUID; assert idempotency — a pre-existing `randomUUID` is not overwritten.
  **Save/restore `globalThis.crypto` around the tests** so other suites (e.g. the
  storage suite) are unaffected by the global mutation.

Files to create/modify:
- Create: `mobile/platform/cryptoShim.ts`, `mobile/platform/installCrypto.ts`, the
  expo-crypto jest mock, and `mobile/__tests__/crypto-shim.test.ts`.
- Modify: `mobile/package.json` + `mobile/package-lock.json` (expo-crypto),
  `mobile/app/_layout.tsx` (import the crypto installer after the storage one).

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass. Run `npm install` in `mobile/` first
  (new dependency). Confirm `bundle-check` still produces the iOS bundle with
  expo-crypto in the graph.

Constraints: reuse `@core` unchanged (the polyfill adapts the platform; the core
is not edited); native adapters live in `mobile/platform/`; keep it minimal,
reversible, and a strict no-op when `crypto.randomUUID` already exists. Do not edit
anything under `src/`.

Suggested commit message:
`feat(ios): polyfill crypto.randomUUID for Hermes identity`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
