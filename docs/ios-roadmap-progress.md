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
| 37 | Action quiz practice mode (per-action accuracy) | M5 | 2026-06-21 |
| 38 | Action notation import/export on the action editor | M5 | 2026-06-21 |
| 39 | Board explorer: board input + flop texture tagging (opens M6) | M6 | 2026-06-21 |
| 40 | Range-vs-board overlay on the board explorer | M6 | 2026-06-21 |
| 41 | Postflop decision practice (bet/check/call/raise/fold on a random spot) | M6 | 2026-06-22 |
| 42 | Combo explorer: enumerate a hand's combos + blocker-aware counts | M6 | 2026-06-22 |
| 43 | Controlled `ComboSelector` component (per-combo toggles) | M6 | 2026-06-22 |
| 44 | Refine + persist per-hand combo selections in the editor | M6 | 2026-06-22 |
| 45 | Blocker-aware combo drill (completes the combo cluster) | M6 | 2026-06-22 |

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training** is underway: board explorer
(slice 39), range-vs-board overlay (slice 40), and postflop decision practice (slice 41).
**Combo cluster COMPLETE** (slices 42–45): combo explorer, `ComboSelector` component, per-hand
combo refinement persisted as `comboSelections` in the editor, and the blocker-aware combo drill
(a practice mode dealing unblocked combos, honoring `comboSelections` via `selectionForRange`).
Next: the mixed-frequency cluster (`mixedStrategy` / `mixedNotation`) — editor, integration,
quiz, notation — then range diff, per-hand notes, and CSV import.

## Next slice

**Slice 46 — `MixedStrategyEditor` RN component (per-action frequencies)**

Milestone: M6 — Advanced training (web v4.2 "mixed-frequency strategies"). Opens the
mixed-frequency cluster, decomposed like the combo cluster: this slice is the controlled
component for editing ONE hand's mixed strategy (the analogue of `ComboSelector` in slice 43);
later slices wire it into a screen + persist `mixedStrategies` (like 44), then add the quiz and
notation. Keep this one to the component + helper + test, with no screen/storage integration.

Context: a hand's mixed strategy is a list of weighted actions — `HandMixedStrategy = MixedAction[]`
where `MixedAction = { action: RangeAction; frequency: number }` and `frequency` is a percent in
[0, 100]. A complete strategy sums to 100. The web `MixedStrategyEditor` lets the user set each
action's frequency; mirror it in RN with simple steppers (+/− buttons) per action — sliders are
fiddly on device.

Reuse (verified — read `src/domain/mixedStrategy.ts` + `src/components/MixedStrategyEditor.tsx`
to confirm shapes before building):
- `@core/domain/mixedStrategy` `interface MixedAction`, `type HandMixedStrategy`,
  `normalizeMixedStrategy(actions): HandMixedStrategy`, `totalFrequency(actions): number`,
  `isValidMixedStrategy(actions): boolean`.
- `@core/types/range` `RANGE_ACTIONS`, `RANGE_ACTION_LABELS`, `type RangeAction`.
- `mobile/theme/actionColors` `ACTION_COLORS` (for per-action coloring, as in the action editor).

Task (mobile-only; reuse `@core`, do not edit `src/`): a controlled `MixedStrategyEditor` RN
component in `mobile/components/MixedStrategyEditor.tsx` with props
`{ strategy: HandMixedStrategy; onChange: (next: HandMixedStrategy) => void }`. Render a row per
`RANGE_ACTION` showing its current frequency (0 when absent) with − / + steppers (clamp to
[0, 100], fixed step e.g. 5), the running total (`totalFrequency`), and a valid/!=100 indicator
(`isValidMixedStrategy`). The component owns no state — it computes the next strategy and calls
`onChange`. Extract the stepping math into a small pure helper in `mobile/components/` (e.g.
`stepMixedFrequency(strategy, action, delta, step): HandMixedStrategy`, normalized via
`normalizeMixedStrategy`) so it unit-tests without rendering.

Tests: helper — stepping an action up adds/increases that action and `totalFrequency` reflects it;
stepping below 0 clamps; reaching 100 makes `isValidMixedStrategy` true. Component (RNTL): pressing
an action's + stepper fires `onChange` with the updated strategy; the total is displayed.

Files: add `mobile/components/MixedStrategyEditor.tsx` + `mobile/components/<stepHelper>.ts` +
`mobile/__tests__/mixed-strategy-editor.test.tsx` (+ a helper test, may share the file). No `src/`
edits, no new dependency, no screen wiring yet.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/mixedStrategy` for all strategy math (no hand-rolled
normalization/validation); component is controlled (no internal strategy state); lives in
`mobile/components/`. Do not edit `src/`.

Suggested commit message:
`feat(ios): add controlled MixedStrategyEditor component`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
