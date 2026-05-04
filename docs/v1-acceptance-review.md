# v1 Acceptance Review

- **Date:** 2026-06-02
- **Commit reviewed:** `0928b39` (`0928b39e4e946a74fa511501e9db9caab3a60539`) — _feat: add basic practice mode UI_
- **Branch:** main
- **Scope:** Documentation/review only. No runtime source files were modified.

## Summary

All twelve v1 acceptance criteria are met and the full validation suite
(lint, tests, build) passes. v1 is functionally complete. Remaining items are
deferred-scope features and minor technical debt, none of which block v1.

## Implemented v1 features

| Area | Implementation |
| --- | --- |
| 13x13 hand matrix | `src/domain/pokerHands.ts` (`generateHandMatrix`, `ALL_HANDS` — 169 hands), rendered by `src/components/HandGrid.tsx` / `HandCell.tsx` |
| Click-to-toggle selection | `HandCell` toggle button (`aria-pressed`), state owned by `App.tsx` |
| Named range creation | `App.tsx` name input; save gated on a trimmed name + at least one hand |
| Live range summary | Hands selected, combos, and % of all hands via `src/domain/rangeMath.ts` |
| Save range locally | `src/storage/rangeStorage.ts` over `localStorage` (key `poker-range-trainer.saved-ranges.v1`) |
| View saved ranges | `src/components/RangeLibrary.tsx` with per-range stats |
| Edit saved range | Load into editor; in-place update preserves `id` / `createdAt`, refreshes `updatedAt` |
| Delete saved range | `deleteSavedRange`; clears editor if the deleted range was open |
| Practice mode | `src/components/PracticeSession.tsx` + `src/domain/practice.ts` |
| Random hand prompts | `getRandomPracticeHand` (uniform over 169 hands, injectable RNG) |
| In/out-of-range answers | "In range" / "Out of range" buttons, scored by `createPracticeAttempt` |
| Immediate feedback | Correct/Incorrect + expected answer; re-answering the same hand is blocked |
| Session stats | Total questions, correct answers, accuracy via `summarizePracticeAttempts` |

Architecture follows the project conventions: poker logic lives under
`src/domain/`, persistence under `src/storage/`, shared types under `src/types/`,
and UI components hold no duplicated poker math.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| User can create a named range | ✅ Pass |
| User can select hands on a standard 13x13 grid | ✅ Pass |
| User can save the range locally | ✅ Pass |
| User can view saved ranges | ✅ Pass |
| User can edit a saved range | ✅ Pass |
| User can delete a saved range | ✅ Pass |
| User can start a practice session from a saved range | ✅ Pass |
| User can answer whether a random hand is inside or outside the range | ✅ Pass |
| User receives immediate feedback | ✅ Pass |
| User sees basic accuracy stats | ✅ Pass |
| App is reasonably usable on desktop | ✅ Pass |
| Core range and practice logic has tests | ✅ Pass |
| Validation commands pass | ✅ Pass |

## Validation results

Run from a clean working tree at commit `0928b39`:

| Command | Result |
| --- | --- |
| `npm run lint` | ✅ Pass (exit 0, no warnings) |
| `npm run test:run` | ✅ Pass — 8 files, 102 tests |
| `npm run build` | ✅ Pass (`tsc -b && vite build`; bundle ~198 kB JS / 62.5 kB gzip) |

### Test count summary

| Test file | Tests |
| --- | --- |
| `src/domain/practice.test.ts` | 21 |
| `src/domain/rangeMath.test.ts` | 17 |
| `src/storage/rangeStorage.test.ts` | 16 |
| `src/domain/pokerHands.test.ts` | 14 |
| `src/App.test.tsx` | 12 |
| `src/components/HandGrid.test.tsx` | 8 |
| `src/components/PracticeSession.test.tsx` | 8 |
| `src/components/RangeLibrary.test.tsx` | 6 |
| **Total** | **102** |

Required domain coverage from CLAUDE.md is present: hand generation, combo
counting, range percentage, storage behavior, and practice answer correctness.

## Manual testing checklist summary

`docs/manual-testing-checklist.md` covers the baseline commands, the v1 range
editor, and v1 practice mode. It was updated in this review to add implemented
editor flows that were previously uncovered:

- Live range summary (hands / combos / percentage).
- Disabled save button with hint until a name and a hand are present.
- New Range reset.
- Active-range highlight in the library and per-range stats.
- Editing indicator, "Save Changes" label, and in-place update (no duplicate).

The checklist is intended to be executed by a human; this review did not run the
manual steps. Automated coverage (102 tests) exercises the same flows in
`App.test.tsx` and the component tests.

## Gaps remaining before calling v1 complete

None blocking. All acceptance criteria pass. The following are explicitly
out of v1 scope (see roadmap) and are noted only to set expectations:

- No drag-select, clear-all, range shortcuts, or live notation (roadmap v1.1).
- No range notation import/export (roadmap v1.2).
- No scenario metadata, search, or filtering (roadmap v1.3–v1.4).
- Practice stats are session-only; no persistence, history, or mistake review
  (roadmap v2.1+).

## Known risks / technical debt

- **localStorage write errors are unguarded in the UI.** Reads degrade
  gracefully (corrupt/invalid data returns `[]`), but `saveSavedRange` can throw
  (e.g. quota exceeded, Safari private mode) and `App.tsx` has no try/catch or
  user-facing error. Low likelihood at v1 data sizes.
- **Single-device persistence.** Data lives only in this browser's
  `localStorage`; clearing site data loses ranges. No export/backup yet
  (roadmap v3.2). Acceptable for v1.
- **`PokerHand` is a bare `string` alias.** Validity is enforced at runtime via
  `isValidHand` guards in the domain layer rather than by the type system. The
  guards are thorough, but the type itself is permissive.
- **Mobile is functional but not optimized.** The viewport meta tag and a fluid,
  `aspect-ratio` grid with clamped font sizes let the grid scale down, but at
  narrow widths the 13-column tap targets get small. Mobile-first work is
  deferred to roadmap v3.1.
- **Unused scaffold assets.** `src/assets/hero.png`, `react.svg`, and `vite.svg`
  are not referenced in source. Harmless; trivial cleanup.

## Recommended next slice

Ship v1 as-is, then begin **roadmap v1.1 (better range creation UX)**. Suggested
first slice: **drag-select on the 13x13 grid plus a Clear button**, building on
the existing controlled-selection state in `App.tsx` / `HandGrid.tsx`. It is the
highest-leverage usability win, is self-contained, and requires no data-model
changes. Pair it with tests for the drag/selection helpers.
