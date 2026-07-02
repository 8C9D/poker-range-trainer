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
| 29 | Build-from-memory practice mode + practice-mode picker | M5 | 2026-06-21 |
| 30 | Timed drill practice mode | M5 | 2026-06-21 |
| 31 | Swipe-to-answer + haptics on recognition practice | M5 | 2026-06-21 |
| 32 | Practice session history (record on explicit End session + view) | M5 | 2026-06-21 |
| 33 | Advance spaced-repetition schedule on End session | M5 | 2026-06-21 |
| 34 | Due-for-review badge + practice streak on the library | M5 | 2026-06-21 |
| 35 | Multi-action editor foundation (palette + action grid + screen) | M5 | 2026-06-21 |
| 36 | Preserve overlay fields when saving from the binary editor (fix) | M5 | 2026-06-21 |

## Next slice

**Slice 37 — Action quiz practice mode ("what's the correct action?")**

Milestone: M5 — Practice depth (web v2–v2.3). Continues the multi-action cluster (slice 35
built the editor; slice 36 protected its persistence). Adds the per-action practice mode as a
fourth option in the practice-mode picker.

Context: a range can now tag hands with actions (`handActions`). This mode quizzes the user:
show a hand the chart assigns, the user picks an action, score against the correct one. Only
hands the chart assigns are quizzed. Mirrors recognition practice's per-answer recording but
over actions.

Reuse (verified, import — never copy):
- `@core/domain/actionRange` `assignedHands(handActions): PokerHand[]` (the prompt pool),
  `correctActionFor(handActions, hand): RangeAction` (the expected action),
  `summarizeActionAccuracy(attempts: ActionAttempt[]): ActionAccuracyStat[]`, and
  `actionAccuracyRate(stat)`. Read `src/domain/actionRange.ts` + `src/components/ActionQuiz.tsx`.
- `@core/domain/practice` `getRandomHandFrom(pool, random?)` (draw from the assigned pool).
- `@core/storage/actionAccuracyStorage` `recordActionAccuracy(rangeId, actionStats)` +
  `loadActionAccuracy()`.
- `@core/types/practice` `ActionAttempt` = `{ hand, chosen, expected, correct }` (built
  inline — there is NO `createActionAttempt` helper; compute `expected =
  correctActionFor(...)`, `correct = chosen === expected`).
- `@core/types/range` `RANGE_ACTIONS`, `RANGE_ACTION_LABELS`, `RangeAction`;
  `@core/storage/rangeStorage` `findSavedRangeById`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- New screen `mobile/app/action-quiz.tsx` (route `/action-quiz`, param `id`): load the range;
  `handActions = range.handActions ?? {}`; `pool = assignedHands(handActions)`. When the pool
  is empty, show a message (`testID="no-actions"`, e.g. "No actions assigned — add some in
  Edit actions") and no quiz. Otherwise hold `hand` (drawn via `getRandomHandFrom(pool)`) and
  `attempts: ActionAttempt[]`.
- Render the hand (`testID="quiz-hand"`) and a row of action buttons from `RANGE_ACTIONS`
  (`testID={`quiz-action-<action>`}`). On press: `expected = correctActionFor(handActions,
  hand)`; `attempt = { hand, chosen, expected, correct: chosen === expected }`; append; show
  feedback (`testID="quiz-feedback"`, e.g. "Correct" / "Incorrect — AKs is a 3-bet"); draw the
  next hand from the pool; record per answer via `recordActionAccuracy(range.id,
  summarizeActionAccuracy([attempt]))`. Show running total/correct/accuracy
  (`stat-total`/`stat-correct`/`stat-accuracy`, computed from attempts).
- Add a fourth mode to `mobile/app/practice-modes.tsx`: `Link` to `/action-quiz?id=` with
  `testID="mode-action-quiz"`, title "Action quiz", desc "Name the correct action for each
  hand."
- Reuse `@core`; no new dependency.

Tests:
- New `mobile/__tests__/action-quiz-screen.test.tsx` (mock mmkv + expo-router; seed a range
  with `handActions: { AA: 'raise', KK: 'raise', ... }` — assign a few hands all to one action
  so the pool is non-empty and the expected action is known). Read `quiz-hand`, press the
  matching `quiz-action-raise`, assert `quiz-feedback` shows "Correct" and `stat-correct`
  increments; press a wrong action on the next hand and assert it scores incorrect. Assert
  `loadActionAccuracy().<id>` recorded attempts. Also: seed a range with NO handActions, assert
  `no-actions` shows and `quiz-hand` is absent.
- Extend `mobile/__tests__/practice-modes-screen.test.tsx`: assert `mode-action-quiz` renders.
- RNTL hygiene ([[ios-mobile-toolchain]]): `await render`; `await` each press (waitFor on a
  resulting stat) before the next; `toHaveTextContent` is exact.

Files: add `mobile/app/action-quiz.tsx`, `mobile/__tests__/action-quiz-screen.test.tsx`;
modify `mobile/app/practice-modes.tsx`, `mobile/__tests__/practice-modes-screen.test.tsx`. No
`src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `assignedHands` + `correctActionFor` + `summarizeActionAccuracy` +
action storage (no hand-rolled action scoring); screen in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add an action quiz practice mode`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Action notation import/export** — `formatActionNotation` / `parseActionNotation` UI on the
  action editor (clipboard via `expo-clipboard`, as `RangeNotation` does). Likely completes M5.
- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- After these, **M6 — Advanced training** (board texture, made-hand/draw categorization,
  range-vs-board, postflop practice, combo/blocker depth, mixed-frequency editor + quiz +
  notation, range diff, per-hand notes, CSV import).
