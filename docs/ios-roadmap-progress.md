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

## Next slice

**Slice 25 — Persist per-hand accuracy from recognition practice**

Milestone: M5 — Practice depth (web v2–v2.3). (Later M5 slices build the *views* over
this data: a weakest-hands list, the editor-grid accuracy heatmap, and a "practice
mistakes only" drill — plus session history, spaced repetition, multi-action,
build-from-memory, timed/weakness drills, and swipe/haptics. This slice is the per-hand
persistence foundation those need.)

Context: slice 24 wired `practice.tsx` to fold each answer into cumulative *per-range*
stats via `recordPracticeSession`. The web's `handleEndPractice` also records cumulative
*per-hand* accuracy (`recordHandAccuracy(rangeId, summarizeHandAccuracy(attempts))`),
which powers the heatmap, weakest-hands view, and mistakes-only drill. Nothing in mobile
records per-hand accuracy yet, so `loadHandAccuracy()` is always empty on device. This
slice adds that recording, mirroring slice 24's per-answer approach.

IMPORTANT lesson from slice 24 (do not repeat the dead end): recording on screen
**unmount** does NOT work here — under this RNTL v14 / React 19 setup, `useEffect`
cleanup does **not** run on `unmount()` (a probe confirmed only the mount effect fires),
and a backgrounded/killed mobile app won't run cleanup either. Record **per answer**, in
the `answer` handler, synchronously — same as slice 24.

Reuse (verified, import — never copy):
- `@core/storage/handAccuracyStorage` `recordHandAccuracy(rangeId: string, handStats:
  HandAccuracyStat[]): void` — folds (adds) per-hand stats into cumulative per-range,
  per-hand accuracy; **no-op when `handStats` is empty**. Read
  `src/storage/handAccuracyStorage.ts` + `loadHandAccuracy()` to confirm.
- `@core/domain/practice` `summarizeHandAccuracy(attempts: PracticeAttempt[]):
  HandAccuracyStat[]` — for a single `[attempt]` it returns a one-element array (that
  hand: `attempts:1`, and `correct`/`falsePositives`/`falseNegatives` per the answer).
  Folding one-attempt increments accumulates to the same cumulative per-hand stats as
  recording the whole session once.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `practice.tsx`'s `answer` handler, right after the existing
  `recordPracticeSession(...)` call, also call
  `recordHandAccuracy(range.id, summarizeHandAccuracy([attempt]))`. Import
  `recordHandAccuracy` from `@core/storage/handAccuracyStorage` and `summarizeHandAccuracy`
  from `@core/domain/practice` (add it to the existing import).
- No UI change, no new testID, no change to scoring/draw/review logic.

Test (extend `mobile/__tests__/practice-screen.test.tsx`; import `loadHandAccuracy` from
`@core/storage/handAccuracyStorage`):
- With the all-169-hands range, render, read the shown hand from `practice-hand`, press
  `answer-out` (a false negative: in range, answered out), wait for the feedback/stat to
  settle, then assert `loadHandAccuracy().r1[shownHand]` has `attempts: 1`, `correct: 0`,
  `falseNegatives: 1`.
- Assert nothing is recorded before any answer: render, then assert `loadHandAccuracy().r1`
  is `undefined`.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `recordHandAccuracy` + `summarizeHandAccuracy` (no hand-rolled
per-hand folding); record per answer in the handler (NOT on unmount); persistence goes
through the reused storage module; UI/screen logic stays in `mobile/app/`. Do not edit
`src/`.

Suggested commit message:
`feat(ios): persist per-hand accuracy from practice`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
