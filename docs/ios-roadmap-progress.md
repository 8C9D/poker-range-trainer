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

## Next slice

**Slice 27 — "Practice mistakes only" toggle on the practice screen**

Milestone: M5 — Practice depth (web v2–v2.3). (Builds on slices 25–26. Later M5 slices:
editor-grid accuracy heatmap, session history, spaced repetition, multi-action editor,
build-from-memory, timed/weakness drills, and swipe/haptics.)

Context: `mobile/app/practice.tsx` records cumulative per-hand accuracy (slice 25) and
shows a weakest-hands view (slice 26), holding the range's cumulative per-hand accuracy
in `handAccuracy` state (refreshed after each answer). This slice adds a "Mistakes only"
toggle that restricts the random prompt pool to the hands the user has gotten wrong, the
mobile parallel of the web's mistakes-only drill.

Reuse (verified, import — never copy):
- `@core/domain/practice` `handsWithMistakes(rangeStats: RangeHandAccuracy): PokerHand[]`
  — the hands with any recorded error (`falsePositives + falseNegatives > 0`), canonical
  order. And `getRandomHandFrom(pool: PokerHand[], random?): PokerHand` — draw one hand
  from a non-empty pool. (`getRandomPracticeHand` is already imported.) Read
  `src/domain/practice.ts` to confirm.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add `const [mistakesOnly, setMistakesOnly] = useState(false)` and
  `const mistakePool = useMemo(() => handsWithMistakes(handAccuracy), [handAccuracy])`.
- Render a "Mistakes only" toggle Pressable (`testID="toggle-mistakes-only"`,
  `accessibilityRole="button"`, `accessibilityState={{ selected: mistakesOnly }}`) ONLY
  when `mistakePool.length > 0` (no mistakes ⇒ no toggle). Style it like the library's
  favorite/archived chips. On press: flip `mistakesOnly`; when turning ON, redraw the
  current hand from the pool immediately — `setHand(getRandomHandFrom(mistakePool))`.
- Change the next-hand draw so it respects the mode. In the `answer` handler the next
  draw must use a FRESH pool computed from the just-updated storage (not the stale closure
  pool): after `setHandAccuracy(updated)` where `updated = loadHandAccuracy()[range.id] ??
  {}`, draw `setHand(mistakesOnly ? getRandomHandFrom(handsWithMistakes(updated)) :
  getRandomPracticeHand())`. After an answer the pool is always non-empty (the answer
  itself is in it if wrong; if the answer was correct the prior mistakes remain), but
  guard `handsWithMistakes(updated).length > 0` and fall back to `getRandomPracticeHand()`
  to be safe. Add `mistakesOnly` to the `answer` useCallback deps.
- Do not change scoring/recording logic or existing testIDs.

Test (extend `mobile/__tests__/practice-screen.test.tsx`):
- With the all-169-hands range, render; assert `queryByTestId('toggle-mistakes-only')` is
  null (no mistakes yet). Read `practice-hand` (the soon-to-be mistake), press
  `answer-out`, then `await waitFor` until `toggle-mistakes-only` exists. Press the
  toggle, then `await waitFor` that `practice-hand` shows the missed hand (pool of one ⇒
  deterministic).
- Test hygiene: a single `fireEvent.press` followed by `waitFor` is fine; if a test ever
  presses more than once, `await` each press to settle before the next (back-to-back
  un-awaited presses overlap React `act()` scopes and corrupt the scheduler for later
  tests — this caused a slice-25 failure).

Files: modify `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`.
No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core` `handsWithMistakes` + `getRandomHandFrom` (no hand-rolled
pool/draw); compute the post-answer pool from fresh storage to avoid a stale closure;
UI/screen logic stays in `mobile/app/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add a mistakes-only drill toggle to practice`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
