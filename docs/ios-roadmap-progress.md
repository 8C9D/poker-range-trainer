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
| 18 | Library sorts (name / recent / practiced / accuracy) | M4 | 2026-06-14 |
| 19 | Duplicate a range from the library | M4 | 2026-06-14 |
| 20 | Favorite toggle + favorites filter in the library | M4 | 2026-06-14 |
| 21 | Archive ranges (hide-by-default + show-archived toggle) | M4 | 2026-06-15 |

## Next slice

**Slice 22 — Per-range practice stats on library cards (closes M4)**

Milestone: M4 — Library & organization (web v1.3–v1.4). **Last M4 slice**; slice 23
opens M5 (Practice depth).

Context: the library already loads `practiceStats` (focus-reloaded, used by the
practiced/accuracy sorts). This slice surfaces each range's practice summary on its
row card, reusing the accuracy helper. After this, M4 is complete.

Reuse (verified, import — never copy): `@core/domain/practiceStats`
`practiceAccuracyPercentage(stats: RangePracticeStats): number` (confirm in
`src/domain/practiceStats.ts`). `practiceStats[range.id]` (already in component state)
is the `RangePracticeStats | undefined` for a row; it carries `totalAttempts` (and
`correctAttempts`, `lastPracticedAt`).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `mobile/app/index.tsx`'s `renderItem`, when `practiceStats[item.id]` exists with
  `totalAttempts > 0`, render a small extra meta line/badge on the card, e.g.
  `${totalAttempts} attempts · ${practiceAccuracyPercentage(stats).toFixed(0)}% acc`
  (`testID="range-stats-<id>"`). When there is no stats entry (never practiced), show
  nothing extra (or a subtle "Not practiced" — your call; keep it subtle).
- Keep it presentational; no change to storage or the existing row actions.
- Tests (extend `mobile/__tests__/library-screen.test.tsx`): seed a range AND record a
  practice session so `loadPracticeStats()` has an entry for it — reuse
  `@core/storage/practiceStatsStorage` `recordPracticeSession(...)` (read its exact
  signature in `src/storage/practiceStatsStorage.ts`) or write the stats through the
  shim directly. Render; assert `range-stats-<id>` shows the expected attempts/accuracy
  text. A range with no stats shows no `range-stats-<id>`.

Files: modify `mobile/app/index.tsx`, `mobile/__tests__/library-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` for accuracy math (no hand-rolled %); read from the already
focus-reloaded `practiceStats`; UI in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): show per-range practice stats on library cards`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
