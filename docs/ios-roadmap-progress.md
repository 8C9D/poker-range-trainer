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

## Next slice

**Slice 5 — Storage parity test: assert web keys/shapes survive a full backup round-trip through the shim (closes M1)**

Milestone: M1 — Platform adapters: storage + identity. This is the **last M1
slice**; the next slice (6) opens M2.

Context: M1's storage shim (slice 3) and identity polyfill (slice 4) are done.
The shim is installed at entry; `@core/storage/rangeStorage` already round-trips
through it (`mobile/__tests__/storage-shim.test.ts`). The MMKV native module is
mocked in-memory under Jest (`mobile/__mocks__/react-native-mmkv.ts`); the shim is
`mobile/platform/localStorageShim.ts` (`localStorageShim` + `installLocalStorage()`).

This slice closes M1 with the roadmap's **parity test**: prove the on-disk
keys/shapes the reused core writes through the MMKV shim are byte-compatible with
the web app (so a future backup/cloud transfer is interchangeable across
platforms). Because the mobile app reuses the `@core/storage` modules **verbatim**,
the keys cannot drift — this test is the regression lock that documents and
enforces that contract, and proves the whole storage surface (not just ranges)
works on the shim, including the backup serializer used by cloud transfer.

Reuse targets (verified — import, never copy):
- Key constants, all under the `poker-range-trainer.*.v1` namespace:
  `STORAGE_KEY` (`@core/storage/rangeStorage`, `…saved-ranges.v1`),
  `SESSION_HISTORY_STORAGE_KEY` (`@core/storage/sessionHistoryStorage`),
  `REVIEW_STATE_STORAGE_KEY` (`@core/storage/reviewStateStorage`),
  `PRACTICE_STATS_STORAGE_KEY` (`@core/storage/practiceStatsStorage`),
  `HAND_ACCURACY_STORAGE_KEY` (`@core/storage/handAccuracyStorage`),
  `ACTION_ACCURACY_STORAGE_KEY` (`@core/storage/actionAccuracyStorage`).
- Backup surface: `@core/storage/backup` exports `buildBackup(exportedAt?)`,
  `serializeBackup(backup)`, `parseBackup(json)`, `restoreBackup(backup)`
  (snapshots/restores all of the above stores). First read `src/storage/backup.ts`
  to confirm the `Backup` shape and exactly which stores it captures.

Task (test-only — no new deps, no `src/` edits):
- Add `mobile/__tests__/storage-parity.test.ts`. Use the same MMKV-mock + shim
  pattern as `storage-shim.test.ts` (`jest.mock('react-native-mmkv')`,
  `installLocalStorage()` in `beforeAll`, `localStorageShim.clear()` in
  `beforeEach`).
- Key parity: assert each of the six key constants equals its exact canonical web
  string (literal), locking the on-disk layout to the web app's.
- Full round-trip: seed a representative slice of state through the core writers
  (e.g. `saveSavedRange(...)` plus at least one of `recordPracticeSession` /
  `saveReviewState` / `recordHandAccuracy` — match the real signatures in `src/`),
  call `buildBackup()` then `serializeBackup()`, `clear()` the store, then
  `restoreBackup(parseBackup(json))`, and assert the data reloads identically
  (e.g. `loadSavedRanges()` and the matching loaders return what was seeded). Use
  fixed ids/timestamps and canonical hand order (e.g. `['AA','AKs','AQs']`) so
  assertions are exact. This proves keys + JSON shape are forward-compatible with
  web/backup/cloud transfer.

Files to create/modify:
- Create: `mobile/__tests__/storage-parity.test.ts`.
- Modify: none expected (test-only). No new dependency, so no package.json change.

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass. (No new dep, but still run all four.)

Constraints: reuse `@core/storage` unchanged; this is a test that exercises the
seam, not a change to it. Keep it focused and reversible. Do not edit anything
under `src/`.

Suggested commit message:
`test(ios): assert @core storage key/shape parity through the MMKV shim`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
