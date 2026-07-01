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

## Next slice

**Slice 32 — Session history (record on an explicit "End session" + history view)**

Milestone: M5 — Practice depth (web v2–v2.3).

⚠️ DESIGN DECISION (confirm before building — being asked now): session history logs **one
record per session** (`recordPracticeSessionHistory`), so it needs a *session-end trigger*,
which the roadmap doesn't specify for mobile. The web records automatically when the user
exits practice; on mobile that's unreliable — this RNTL/React-19 setup does NOT run effect
cleanup on unmount (slice-24 finding), and a backgrounded/killed app won't either. The
queued **recommended** default is an explicit **"End session" button** on the recognition
practice screen (most reliable; a standard mobile pattern; deterministic to test).
Alternative considered: expo-router `useFocusEffect` blur cleanup (more "automatic," matches
web, but blur-cleanup reliability is uncertain and the test harness stubs `useFocusEffect`
to a no-op). If the user picks the alternative, change only the trigger wiring; the record +
view below are unchanged. (This same trigger will later drive spaced-repetition scheduling.)

Context: `mobile/app/practice.tsx` records per-range stats and per-hand accuracy *per
answer* (slices 24–25). Session history is different — a per-session summary list — so it
must be recorded once at session end, not per answer.

Reuse (verified, import — never copy):
- `@core/storage/sessionHistoryStorage` `recordPracticeSessionHistory(rangeId, summary:
  Pick<PracticeSessionSummary,'totalQuestions'|'correctAnswers'>, playedAt?): void` (no-op
  at 0 questions) and `loadSessionHistory(): Record<string, PracticeSessionRecord[]>`
  (oldest-first per range). `PracticeSessionRecord` = `{ rangeId, playedAt, totalQuestions,
  correctAnswers }` (`@core/types/practice`).
- `@core/domain/practice` `summarizePracticeAttempts` (already imported) for the summary;
  `@core/domain/accuracy accuracyPercentage` (or reuse the summary's `accuracyPercentage`)
  for display.

Task (mobile-only; reuse `@core`, do not edit `src/`) — recommended default:
- Add session-history state: `const [history, setHistory] = useState(() => range ?
  (loadSessionHistory()[range.id] ?? []) : [])`.
- Add an **"End session"** button (`testID="end-session"`) shown while the session has
  attempts (`attempts.length > 0`). On press: `recordPracticeSessionHistory(range.id,
  summarizePracticeAttempts(attempts))`, then reset the *session* (clear `attempts`,
  `lastAttempt`; draw a fresh `hand`; keep cumulative `handAccuracy`), and refresh
  `setHistory(loadSessionHistory()[range.id] ?? [])`. (Per-range stats/accuracy already
  recorded per answer, so ending only logs the history row — no double count.)
- Render a "Session history" section (`testID="session-history"`) when `history.length > 0`:
  one row per past session showing `correctAnswers/totalQuestions` and the accuracy %.
  Keep it presentational; most-recent-first is fine (reverse a copy — don't mutate).
- Do not change scoring/draw/per-answer recording or existing testIDs.

Test (extend `mobile/__tests__/practice-screen.test.tsx`; import `loadSessionHistory` from
`@core/storage/sessionHistoryStorage`):
- All-169-hands range: `end-session` absent before any answer; press `answer-in`, `await`
  `stat-total`=1, then assert `end-session` present. Press `end-session`; assert
  `loadSessionHistory().r1` has length 1 with `{ totalQuestions:1, correctAnswers:1 }`, that
  `session-history` is shown, and that the session reset (`stat-total` back to "Total: 0").
- RNTL hygiene: `await render`; `await` each press before the next (overlapping act
  corrupts later tests); `toHaveTextContent` is an exact normalized match.

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`. No
`src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `recordPracticeSessionHistory` + `loadSessionHistory` (no
hand-rolled history store); record once at session end (NOT per answer); UI in
`mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add practice session history`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
