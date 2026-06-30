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
| 22 | Per-range practice stats on library cards (completes M4) | M4 | 2026-06-15 |
| 23 | End-of-session mistakes review in recognition practice (opens M5) | M5 | 2026-06-15 |
| 24 | Persist recognition practice results into per-range practice stats | M5 | 2026-06-15 |
| 25 | Persist per-hand accuracy from recognition practice | M5 | 2026-06-15 |
| 26 | Weakest-hands view on the practice screen | M5 | 2026-06-15 |
| 27 | "Practice mistakes only" drill toggle on the practice screen | M5 | 2026-06-15 |
| 28 | Per-hand accuracy heatmap (`HandHeatmap`) on the practice screen | M5 | 2026-06-15 |

## Next slice

**Slice 29 — Build-from-memory practice mode (via a practice-mode picker)**

Milestone: M5 — Practice depth (web v2–v2.3).

⚠️ DESIGN DECISION (confirm before building): the roadmap lists a "practice-mode picker"
and "build-from-memory" but does not pin down how multiple practice modes are surfaced in
the mobile navigation. The queued default mirrors the **web**: the library card's
"Practice" affordance opens a small **mode picker** offering "Recognition" (the existing
`practice.tsx`) and "Build from memory" (this new screen). Alternatives the user might
prefer: a second card action ("Build") next to "Practice" (more card clutter), or a
segmented control inside one practice screen. If the default is confirmed, proceed as
below; otherwise adjust the entry point only — the build screen itself is unchanged.

Context: recognition practice is launched from each library card via a `Link` to
`/practice?id=:id` (`mobile/app/index.tsx`). Build-from-memory is a distinct mode: the
user rebuilds a saved range from memory on a blank 13×13 grid, submits, and sees how they
did (correct / missed / extra), reusing the tested comparison.

Reuse (verified, import — never copy):
- `@core/domain/practice` `compareBuiltRange(target: PokerHand[], built: PokerHand[]):
  { correct: PokerHand[]; missed: PokerHand[]; extra: PokerHand[] }` — normalizes both
  sides and splits into correct / missed (forgot) / extra (wrongly added), canonical
  order. Read `src/domain/practice.ts` to confirm.
- `mobile/components/HandGrid` (already built: controlled 13×13 with tap + drag-paint) for
  building the guess; `@core/storage/rangeStorage` `findSavedRangeById`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- New screen `mobile/app/build.tsx` (Expo Router route `/build`, param `id`): load the
  range via `findSavedRangeById`; hold a `Set<PokerHand>` of the user's built hands; render
  `HandGrid` (selected = built set) so the user paints their guess; a "Check" button runs
  `compareBuiltRange(range.hands, [...built])` and shows the three result groups as chip
  rows (reuse the practice review chip look) with counts (e.g. "Correct 12", "Missed 3",
  "Extra 1"); a "Reset"/"Try again" clears the built set. testIDs: `build-check`,
  `build-correct`, `build-missed`, `build-extra`.
- Entry point (per the confirmed decision). Default: add `mobile/app/practice-modes.tsx`
  (route `/practice-modes`, param `id`) listing "Recognition" → `/practice?id=` and "Build
  from memory" → `/build?id=`; change the library card's Practice `Link` to point at
  `/practice-modes?id=`. Keep it minimal and themed.
- Reuse `@core`; no new dependency. Keep the build comparison in `@core` (no hand-rolled
  diff).

Tests:
- New `mobile/__tests__/build-screen.test.tsx` (mock `react-native-mmkv` + `expo-router`
  like `practice-screen.test.tsx`; seed a small known range, e.g. hands `['AA','KK']`):
  tap `hand-cell-AA` to build only `AA`, press `build-check`, then assert `build-correct`
  contains `AA`, `build-missed` contains `KK`, and `build-extra` is empty/absent. Mind the
  RNTL test hygiene notes below.
- If the mode picker is added, a small `mobile/__tests__/practice-modes-screen.test.tsx`
  asserting both mode links render.

RNTL test hygiene (learned in slices 25–26, applies here too):
- `render(...)` is async — `await` it. Use `await findByTestId(...)` for the first element
  read after render if a sync `getByTestId` proves flaky in-suite.
- `await` each `fireEvent.press` to settle (e.g. `waitFor`) before the next press —
  back-to-back un-awaited presses overlap React `act()` scopes and corrupt the scheduler
  for later tests.
- `toHaveTextContent(str)` matches the element's full normalized text (treat it as exact),
  so assert the full chip text when a cell shows extra info.

Files: add `mobile/app/build.tsx` (+ `mobile/app/practice-modes.tsx` if picker),
`mobile/__tests__/build-screen.test.tsx` (+ picker test); modify `mobile/app/index.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `compareBuiltRange` + the existing `HandGrid`; screens in
`mobile/app/`, RN UI in `mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add build-from-memory practice mode`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
