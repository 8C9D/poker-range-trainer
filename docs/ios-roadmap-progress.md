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

## Next slice

**Slice 23 — End-of-session mistakes review in recognition practice (opens M5)**

Milestone: M5 — Practice depth (web v2–v2.3). First M5 slice. (The roadmap also lists
a practice-mode picker, build-from-memory, timed/weakness drills, heatmaps, spaced
repetition, multi-action, and swipe/haptics — each a later slice. This one is a small,
self-contained depth win that needs no new screen or dependency.)

Context: `mobile/app/practice.tsx` runs recognition practice and shows live session
stats (total/correct/accuracy) from `summarizePracticeAttempts`. It keeps the
session's `PracticeAttempt[]` in state. This slice adds an end-of-session mistakes
review so the user can see which hands they got wrong, reusing the tested helper.

Reuse (verified, import — never copy): `@core/domain/practice`
`reviewSessionMistakes(attempts: PracticeAttempt[]): { missed: PokerHand[];
wronglyIncluded: PokerHand[] }` — `missed` = in-range hands answered "out", 
`wronglyIncluded` = out-of-range hands answered "in", each de-duped in first-seen
order (read `src/domain/practice.ts` to confirm).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- In `practice.tsx`, compute `reviewSessionMistakes(attempts)` (memoize on `attempts`).
  Render a "Session review" section (below the stats) listing the `missed` hands and
  the `wronglyIncluded` hands when each is non-empty — e.g. two labelled wrapping rows
  of hand chips (reuse `ChipRow`'s look or simple `Text` chips; non-interactive is
  fine). `testID`s e.g. `review-missed`, `review-wrong`. When there are no mistakes yet
  (or none after some attempts), show nothing or a subtle "No mistakes" note.
- Keep it presentational; do not change scoring/draw logic.
- Test (extend/maybe add `mobile/__tests__/practice-screen.test.tsx`): with the
  all-169-hands range (every prompt in range), answering "Out of range" makes the shown
  hand a `missed` mistake — press `answer-out`, then assert `review-missed` appears and
  contains the just-shown hand (read `practice-hand` text before answering). Use
  `userEvent` if chaining; otherwise `fireEvent` + `waitFor`.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/practice` `reviewSessionMistakes` (no hand-rolled
mistake bucketing); session state stays in the component; UI in `mobile/app/`. Do not
edit `src/`.

Suggested commit message:
`feat(ios): add end-of-session mistakes review to practice`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
