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

## Next slice

**Slice 36 — Preserve overlay fields when saving from the binary editor (bug fix)**

Milestone: M5 — Practice depth (housekeeping that protects the slice-35 multi-action
feature). Found while building slice 35.

Bug: `mobile/app/editor.tsx`'s live-save reconstructs the range from a 6-field snapshot
(`{ id, name, hands, createdAt, updatedAt, metadata }`) and `saveSavedRange` *replaces* the
stored entry — so every other field is dropped on save. That means editing a range in the
binary editor strips `handActions` (the slice-35 action overlay), `favorite`, `archived`,
`source`, `comboSelections`, `mixedStrategies`, and `handNotes`. Concretely: assign actions
→ go back → toggle one hand in the binary grid → actions gone; or favorite a range → edit it
→ favorite lost. This is pre-existing (predates multi-action) but slice 35 makes it visible.

Fix (mobile-only; reuse `@core`, do not edit `src/`): merge the editable fields onto the
*current stored* range at save time instead of building a bare object. In the editor's
live-save effect:
```
const existing = findSavedRangeById(draft.id);
saveSavedRange({
  ...existing,                       // preserve favorite/archived/handActions/source/…
  id: draft.id,
  name,
  hands: [...selected],
  createdAt: draft.createdAt,
  updatedAt: new Date().toISOString(),
  metadata,
});
```
`existing` is `undefined` on a brand-new range's first save — spreading `undefined` is fine
(`{ ...undefined }` is `{}`), but TS-narrow it (`...(existing ?? {})`) if the spread type
complains. Reading the current stored range each save (rather than a mount snapshot) also
means overlay fields written by the action editor after this screen mounted are picked up.
Keep everything else (the hydratedRef first-run skip, the field set being edited) unchanged.

Test (extend `mobile/__tests__/editor-screen.test.tsx`):
- Seed a range with `id 'r1'` that has `favorite: true` and `handActions: { AA: 'raise' }`
  (use `saveSavedRange` in the test; the expo-router mock already returns no id, so to edit
  an existing range either (a) point the mock's `useLocalSearchParams` at `{ id: 'r1' }` in a
  scoped test/describe, or (b) add a second test file — simplest is a new
  `mobile/__tests__/editor-preserves-overlay.test.tsx` with the id-mock set to `r1`).
  Render the editor, toggle a hand (e.g. press `hand-cell-KK`), then assert via
  `findSavedRangeById('r1')` that `favorite === true` and `handActions.AA === 'raise'` still
  hold and `KK` is now in `hands`.
- RNTL hygiene: `await render`; `userEvent` for the interaction; `await waitFor`.

Files: modify `mobile/app/editor.tsx`; add/extend a test
(`mobile/__tests__/editor-preserves-overlay.test.tsx` recommended so the `id` mock is
isolated). No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: merge onto the current stored range via `@core` storage (no field-by-field
hand-copying beyond what's edited); keep the editor's existing behavior otherwise. Do not
edit `src/`.

Suggested commit message:
`fix(ios): preserve action/favorite/archive overlays when editing a range`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Per-action accuracy practice ("ActionQuiz")** — a practice mode over `assignedHands` that
  asks "what's the correct action?" reusing `@core/domain/actionRange` `correctActionFor` +
  `summarizeActionAccuracy`; add to the practice-mode picker.
- **Action notation import/export** — `formatActionNotation` / `parseActionNotation` UI on the
  action editor (clipboard via `expo-clipboard`, as `RangeNotation` does).
- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- After these, **M6 — Advanced training** (board texture, made-hand/draw categorization,
  range-vs-board, postflop practice, combo/blocker depth, mixed-frequency editor + quiz +
  notation, range diff, per-hand notes, CSV import).
