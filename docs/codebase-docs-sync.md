# Codebase Docs Sync

## Date

2026-06-06

## Summary

Synced documentation with the current codebase. The repository is implemented
through roadmap **v2.3** (multi-action ranges), but the top-level `README.md` was
still the unmodified Vite starter template and described none of the project. It
was rewritten to describe the actual app. One stale test-count figure in the
manual testing guide was corrected. All other docs were already accurate or are
point-in-time / machine-owned records and were intentionally left unchanged.

## Repository state reviewed

- Current branch: `main`
- Important source areas reviewed:
  - `src/App.tsx` (top-level wiring of editor, library, practice modes, views)
  - `src/components/` (UI: grid, library, practice modes, editors, notation, performance)
  - `src/domain/` (pure poker logic: hands, range math, notation, practice, spaced repetition, action ranges)
  - `src/storage/` (localStorage persistence for ranges, stats, accuracy, history, review state)
  - `src/types/` (`range.ts`, `practice.ts`)
  - `package.json` (scripts, dependency versions), `index.html`, `.gitignore`
- Important docs reviewed:
  - `README.md`
  - `CLAUDE.md`
  - `docs/roadmap.md`
  - `docs/roadmap-progress.md`
  - `docs/manual-testing-guide.md`
  - `docs/manual-testing-checklist.md`
  - `docs/v1-acceptance-review.md`, `docs/v1.2-acceptance-review.md`
  - `prompts/001-repo-inspection.md`

## Documentation updates made

- File: `README.md`
  - Change: Replaced the default "React + TypeScript + Vite" template content with
    a project README — description, feature summary by roadmap version, getting
    started, scripts table, project structure, data/persistence notes, testing,
    and links to the roadmap, manual testing guide, and `CLAUDE.md`.
  - Reason: The previous README was generic Vite boilerplate and contained nothing
    about the poker range trainer, so a new developer got no useful orientation.
- File: `docs/manual-testing-guide.md`
  - Change: Updated the test-count note from "666 tests across 38 files" to
    "671 tests across 38 files".
  - Reason: `npm run test:run` now reports 671 passing tests across 38 files; the
    file count was still correct, the test count had drifted.

## Confirmed current-state facts

- App is client-only (React + TypeScript + Vite), persisting to `localStorage`;
  no backend/account/network code exists.
  - Evidence: `src/storage/*` use `localStorage`; no server/network code in `src/`;
    `package.json` dependencies are only `react` / `react-dom`.
- Implemented through roadmap v2.3.
  - Evidence: `src/App.tsx` wires recognition, build-from-memory, timed, weakness,
    and action-quiz practice modes, the performance view, the due-today queue, and
    the multi-action editor; `src/domain/actionRange.ts` and `src/types/range.ts`
    define the `RangeAction` model. Matches `docs/roadmap-progress.md`.
- Test suite: 671 tests across 38 files, all passing.
  - Evidence: `npm run test:run` → "Test Files 38 passed (38) / Tests 671 passed (671)".
- Scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (`eslint .`), `test`
  (`vitest`), `test:run` (`vitest run`), `preview`.
  - Evidence: `package.json` `scripts`.
- localStorage keys are prefixed `poker-range-trainer.` (saved ranges, practice
  stats, hand/action accuracy, session history, review state).
  - Evidence: `src/storage/*`; enumerated in `docs/manual-testing-guide.md` §2.

## Items needing confirmation

- None. All documented changes were verified directly against the code, the
  build/test output, or `package.json`.

## Docs intentionally left unchanged

- File: `docs/roadmap.md`
  - Reason: Forward-looking product vision/roadmap; accurate and not state-tracking.
- File: `docs/roadmap-progress.md`
  - Reason: Machine-owned state file for the `roadmap-slice` skill (rewritten by
    the skill on each slice). Not hand-maintained prose; left to the tooling.
- File: `docs/manual-testing-checklist.md`
  - Reason: Older v1–v1.3 checklist explicitly superseded by
    `manual-testing-guide.md`; kept as a point-in-time record.
- Files: `docs/v1-acceptance-review.md`, `docs/v1.2-acceptance-review.md`
  - Reason: Dated, commit-pinned acceptance reviews — historical records, not
    living docs.
- File: `prompts/001-repo-inspection.md`
  - Reason: Historical kickoff prompt; not current-state documentation.
- File: `CLAUDE.md`
  - Reason: Contributor/agent instructions (workflow rules, validation commands,
    technical conventions) that are still accurate; its "v1 goal / v1 scope"
    framing reads as original project intent and the v1 scope remains implemented.
    Changing this file risks altering agent behavior and is out of scope for a
    docs sync.

## Validation performed

- `npm run test:run` → 38 files / 671 tests passed.
- `npm run lint` → clean (no errors).
- `npm run build` → succeeded (`tsc -b` + `vite build`).
- `git diff` confined to `README.md`, `docs/manual-testing-guide.md`, and this
  report; no source/config changes.

## Next recommended docs improvements

- Recommendation: When v3 (backup export/import, then accounts/backend) begins,
  update the README "Not yet implemented" list and the manual testing guide §4 as
  each slice lands.
  - Why: Those two docs are the current source of truth for "what exists"; they
    drift fastest as features ship.
- Recommendation: Consider folding `docs/manual-testing-checklist.md` into a short
  "superseded — see manual-testing-guide.md" stub if it is no longer consulted.
  - Why: Two testing docs invite confusion; a stub preserves the pointer without
    duplicating now-outdated detail.
