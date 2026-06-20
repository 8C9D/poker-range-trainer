# Refactor Opportunities Report

_Updated by the repo-cleanup-autopilot skill on 2026-06-13. Branch: `main`._

_Supersedes the 2026-06-08 pass, whose four cleanups (A–D) were all implemented
and pushed (see the historical log in §10). This pass re-analyzes the codebase as
it stands after v3–v6 growth (cloud sync, shared packs, postflop, mixed
strategies) and targets the safe, mechanical opportunities that surfaced since._

## 1. Repository Overview

A React + TypeScript + Vite single-page poker range trainer, cleanly layered per
`CLAUDE.md`:

- `src/domain/` — pure poker/training logic (hands, range math, notation,
  practice scoring, spaced repetition, drills, board texture, mixed strategy). No
  React, no storage.
- `src/storage/` — `localStorage`-backed persistence, one module per concern,
  each side-effect-only behind a small exported API and a versioned key. Shared
  IO/validation primitives live in `storageHelpers.ts` (added in the prior pass).
- `src/cloud/` — Supabase-backed repos + auth/session, mirroring the storage
  layer's "side-effect behind a small API" shape.
- `src/components/` — React UI.
- `src/types/` — shared domain types.

~9,700 lines of non-test source across ~95 files. Test coverage is strong:
**1,004 tests in 80 files, all green.** Lint and build are both clean.

## 2. Current Quality Summary

The codebase remains in very good shape. The prior pass deduplicated the storage
layer; ongoing work has kept discipline. Notable positives confirmed this pass:

- No `TODO`/`FIXME`/`HACK`/`XXX` markers.
- No stray `console`/`debugger` statements.
- Lint passes with zero warnings; no unused `eslint-disable` directives.
- No unused exported **values/functions** (the only exports not imported
  cross-file are `type` aliases used as function return-type annotations and the
  `DAY_MS` constant — intentional API ergonomics, not dead code).
- All CSS files are imported; the existing `accuracyPercentage` primitive is
  reused across five domain helpers and three components.

Two small, genuinely safe cleanups surfaced — one new (dead scaffold assets),
one newly-justified (a second copy of the inline accuracy ratio now exists, so
the prior pass's "single site" reason to skip it no longer holds).

## 3. Highest-Value Refactor Opportunities

### Opportunity E — Remove dead Vite-scaffold assets

- **Location/files:** `src/assets/hero.png`, `src/assets/react.svg`,
  `src/assets/vite.svg`.
- **Problem:** All three are unreferenced. `react.svg`/`vite.svg` are the default
  Vite template assets (last touched only by `chore: track initial Vite
  scaffold`); `hero.png` is never imported. No `import`, `import.meta.glob`,
  `new URL`, or string reference exists anywhere in `src/`, `index.html`, or
  `public/`, and none are emitted into `dist/`.
- **Why it matters:** Dead binary/template files add noise and falsely imply the
  app uses the scaffold branding.
- **Suggested refactor:** `git rm` the three files.
- **Risk level:** Low (purely mechanical dead-file removal; the build proves
  nothing imports them).
- **Expected benefit:** Three fewer dead files; no scaffold leftovers.
- **Suggested validation:** `npm run build` (fails if anything imported them) +
  `npm run lint && npm run test:run`.
- **Dependency ordering:** Independent. Do first (safest).
- **Autopilot status:** Implemented

### Opportunity F — Reuse `accuracyPercentage` in the two quiz components

- **Location/files:** `src/components/ActionQuiz.tsx:86`,
  `src/components/MixedActionQuiz.tsx:75`.
- **Problem:** Both compute the session accuracy inline as
  `total === 0 ? 0 : Math.round((correct / total) * 100)` — verbatim identical.
  `src/domain/accuracy.ts` already exports `accuracyPercentage(correct, total)`
  (`total === 0 ? 0 : (correct / total) * 100`), so each site is exactly
  `Math.round(accuracyPercentage(correct, total))`.
- **Why it matters:** The "never divide by zero, scale to 0–100" convention is
  re-encoded at two sites that the existing primitive already covers. The prior
  pass deliberately skipped `ActionQuiz.tsx` as a lone site ("pulls a domain
  helper into a component for a single use"); a second identical copy now exists,
  and `accuracyPercentage` is already imported into sibling components
  (`PracticeSession`, `TimedDrillSession`, `WeaknessFocusedDrill` via
  `summary.accuracyPercentage`), so that rationale no longer applies.
- **Suggested refactor:** Import `accuracyPercentage` from `../domain/accuracy`
  in both files; replace each inline ternary with
  `Math.round(accuracyPercentage(correct, total))`.
- **Risk level:** Low (behavior-identical: `Math.round(0) === 0` for the
  `total === 0` branch; identical arithmetic otherwise).
- **Expected benefit:** One tested definition of the accuracy convention; two
  fewer inline ratios.
- **Suggested validation:** `npm run lint && npm run test:run && npm run build`
  (both components have existing tests asserting displayed accuracy).
- **Dependency ordering:** Independent of E.
- **Autopilot status:** Implemented

## 4. Quick Wins

- Opportunity E (dead-file removal).
- Opportunity F (verbatim 2× accuracy-ratio dedup against an existing primitive).

## 5. Larger Refactors (out of scope for an autonomous low-risk pass)

- **`src/App.tsx` (~1,435 lines)** orchestrates routing between views, owns
  saved-range state, and wires every feature. Splitting view state or extracting
  a router/reducer is plausible but **behavior-sensitive and product-shaped**.
- **`src/components/RangeLibrary.tsx` (~580 lines)** combines filtering, sorting,
  favoriting, archiving, and list rendering. Decomposable, but UI-behavior-heavy.
- **Shared quiz hook for `ActionQuiz`/`MixedActionQuiz`.** They share the
  prompt-drawing + `total`/`correct`/`answered` scaffolding, but diverge on
  attempt tracking (`ActionQuiz` accumulates an `attempts[]`; `MixedActionQuiz`
  does not) and on the `onExit` signature (`onExit(attempts)` vs `onExit()`). A
  shared `useQuizSession` hook would have to thread those differences — a
  medium-risk component refactor needing human judgment. Defer.

## 6. Things Not Worth Refactoring Yet

- **Unused `type` exports + `DAY_MS`** (`SharedPackPublish`, `CloudConfig`,
  `AuthSessionState`, `RangeExport`, `PostflopScenarioInput`, `MixedAction`, etc.)
  — these annotate function return shapes / aid caller ergonomics. Un-exporting is
  a low-value, borderline-API change. Leave (consistent with the prior pass).
- **`RangePerformance.tsx:139`** computes `(correctAnswers / totalQuestions) * 100`
  **without** a zero guard, on purpose (a recorded session always has
  `totalQuestions > 0`). The prior pass explicitly carved this out; folding it into
  the guarded primitive would add a guard the site intentionally omits. Leave.
- **Generic keyed-map parser** for `handAccuracyStorage` / `actionAccuracyStorage`
  — their `load*` loops share a shape, but unifying them needs a parse-callback +
  key-selector higher-order helper whose indirection trades against the current
  self-documenting clarity. Only two instances; the prior pass deferred this to
  human judgment and that still holds.
- **Cloud `if (error) throw error`** idiom across `src/cloud/*Repo.ts` — already
  a one-line idiom; wrapping the varied `.from(...).insert/upsert/delete/select`
  chains would obscure the queries for no real gain.

## 7. Suggested Refactor Sequence

1. E — remove dead scaffold assets (independent, safest).
2. F — reuse `accuracyPercentage` in the two quiz components (independent).

## 8. Recommended First Refactor

Opportunity E: a purely mechanical dead-file removal that the build itself
validates (it would fail if anything imported them).

## 9. Validation Commands Discovered

From `package.json`:

- `npm run lint` — ESLint over the repo.
- `npm run test:run` — Vitest single run (1,004 tests).
- `npm run build` — `tsc -b && vite build`.

## 10. Autopilot Execution Log

### Prior pass — 2026-06-08 (historical, all pushed)

| # | Cleanup | Commit | Notes |
|---|---------|--------|-------|
| 0 | Report | 7493977 | Prior report |
| A | Extract `isNonNegativeFinite` | 2a888f0 | Removed 5 verbatim copies |
| B | Extract `readJson` IO helper | 679c50c | Dropped duplicated getItem+try/catch from 6 loaders |
| D | Share `asMember` guard | c67bffe | `isRangeAction` reuses `asMember` |
| C | Extract `accuracyPercentage` | 3c9adaa | Folded 4 inline guarded ratios into one primitive |

### This pass — 2026-06-13

| # | Cleanup | Files changed | Validation | Commit | Push | Notes |
|---|---------|---------------|------------|--------|------|-------|
| 0 | Report | docs/refactor-opportunities.md | n/a | _pending_ | _pending_ | This update |
| E | Remove dead scaffold assets | `src/assets/hero.png`, `react.svg`, `vite.svg` (removed) | lint + 1004 tests + build all pass; bundle output byte-identical | (this commit) | _pending_ | Build is the proof nothing imported them; output unchanged |
| F | Reuse `accuracyPercentage` in quiz components | `ActionQuiz.tsx`, `MixedActionQuiz.tsx` | lint + 1004 tests + build all pass (10 targeted quiz tests green) | (this commit) | _pending_ | Behavior-identical; two inline ratios → `Math.round(accuracyPercentage(...))` |
