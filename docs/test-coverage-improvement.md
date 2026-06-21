# Test Coverage Improvement Report

## 1. Repository Test Overview

- Stack: React 19 + TypeScript + Vite, tested with Vitest (`jsdom`) and Testing Library.
- Validation: `npm run lint`, `npm run test:run`, `npm run build`.
- Coverage tooling (`@vitest/coverage-v8`) is still **not** installed; adding a dependency
  (and churning `package-lock.json`) stays out of scope for a test-only pass, so gaps were
  found by reading source/branch logic rather than an instrumented report.
- Baseline this pass: **80 test files, 1004 tests, all passing.** (The prior report's
  40-file/684-test baseline is from an earlier, much smaller snapshot of the app; the
  codebase has roughly doubled since — v3 cloud sync, v4 board/postflop work, v4.1
  blocker-aware practice, v5 mixed strategies, v6 analytics — with colocated tests added
  alongside.)
- Every source module under `src/domain`, `src/storage`, `src/cloud`, and `src/components`
  has a colocated `*.test.ts(x)`. Coverage is broad and high quality.

## 2. Current Coverage Quality Summary

Test quality is high and behavior-focused. Spot checks across the meatiest modules confirm
it:

- **Domain** tests exercise real edge cases: spaced-repetition ease floors / interval
  rounding / streak grace and gaps, weakness-pool weighting and the `random()===1` clamp,
  timed-drill rounding and clock-skew clamps, hand categorization across made hands and
  draws (incl. the wheel ace), and notation/transfer parser error paths.
- **Storage** (`rangeStorage`) has exhaustive sanitization tests — every optional field
  (metadata, source, handActions, comboSelections, mixedStrategies, handNotes, archived,
  favorite) is checked for round-tripping, malformed-entry dropping, and "collapse to
  undefined when empty."
- **Cloud** repo tests inject a fake Supabase client and assert meaningful outcomes (row
  shape upserted, `data` column mapped back, error propagation, signed-out / unconfigured
  guards) rather than merely "a mock was called."

No useless, trivial-existence, mock-only, duplicated, brittle, or skipped tests were found.
The suite is close to saturated; the remaining gaps are a few narrow branches/edge cases.

## 3. Highest-Value Coverage Gaps

### Gap A — dry classification for an unpaired flop (`boardTexture`)

- Location: `src/domain/boardTexture.ts:51-56` (`tagFlopTexture`), tested in
  `src/domain/boardTexture.test.ts`.
- Why it matters: the `dry` tag is the coarse summary poker players read first. The only
  existing `dry` test (`7h7d2c`) is **paired**, which short-circuits the `connected` check
  (`if (!paired && isConnected(board))`). So the canonical dry board — an **unpaired,
  rainbow, disconnected** flop like `Kh8d3c` — never reaches the `dry` branch in a test,
  and `isConnected` returning `false` at the wet/dry decision is unverified for a non-paired
  board.
- Existing tests: monotone/two-tone/connected `wet` flops, a paired rainbow `dry` flop.
- Missing case: a non-paired, rainbow, disconnected flop tagged `dry` (and not `wet`/`connected`).
- Suggested test: `tags('Kh8d3c')` ⇒ contains `rainbow` + `dry`, excludes `wet`, `connected`, `paired`.
- Risk level: Low
- Validation: `npx vitest run src/domain/boardTexture.test.ts`
- Status: Planned

### Gap B — `drawPracticeCombo` upper-bound clamp (`blockerPractice`)

- Location: `src/domain/blockerPractice.ts:44` (`Math.min(pool.length - 1, …)`), tested in
  `src/domain/blockerPractice.test.ts`.
- Why it matters: an injected `random()` of exactly `1` would index out of bounds without
  the clamp (`Math.floor(1 * n) === n`). The sibling helper `getWeaknessFocusedHand` has a
  dedicated `() => 1` clamp test; `drawPracticeCombo` has the identical clamp but only
  tested `() => 0` and the empty-pool throw, leaving the boundary unprotected.
- Existing tests: first-combo draw (`() => 0`), all-blocked throw.
- Missing case: `() => 1` returns the last live combo rather than `undefined`.
- Suggested test: `drawPracticeCombo(['AKs'], [], undefined, () => 1)` equals the 4th combo
  of `handClassCombos('AKs')`.
- Risk level: Low
- Validation: `npx vitest run src/domain/blockerPractice.test.ts`
- Status: Planned

### Gap C — CSV round-trip of a name with an embedded quote (`rangeTransfer`)

- Location: `src/domain/rangeTransfer.ts:205-215` (`csvEscape` / `csvUnescape`), tested in
  `src/domain/rangeTransfer.test.ts`.
- Why it matters: CSV escaping is RFC-style — a field containing `"` must be wrapped and
  each inner quote doubled, then un-doubled on parse. The existing round-trip uses a
  **comma** name, which exercises the wrap/unwrap path but never the `""` doubling/
  un-doubling branch (`.replace(/"/g, '""')` / `.replace(/""/g, '"')`). A user naming a
  range `He said "raise"` would round-trip through that untested branch.
- Existing tests: comma-name round trip, escaping a comma name in `formatRangeCsv`.
- Missing case: a name containing a double-quote survives `formatRangeCsv` → `parseRangeCsv`.
- Suggested test: round-trip a range named `He said "3-bet"` and assert the parsed name matches.
- Risk level: Low
- Validation: `npx vitest run src/domain/rangeTransfer.test.ts`
- Status: Planned

## 4. Useless or Low-Value Tests

None found. No trivial-existence, mock-only, duplicated, skipped, or implementation-coupled
tests were identified across the domain, storage, cloud, and component suites. The cloud
repo tests use mocks (no real network) but assert real outcomes, so they are not "mock-only"
candidates for removal.

## 5. Test Improvement Plan

Add the three narrow behavior/branch tests above (Gaps A–C), one per commit. The suite is
otherwise saturated; no further low-risk, high-value additions were identified without
coverage instrumentation, and no test removals/replacements are warranted.

## 6. Implemented Test Improvements

### Gap A — dry unpaired flop

- Files changed: `src/domain/boardTexture.test.ts`
- Behavior covered: an unpaired, rainbow, disconnected flop is tagged `dry` (and not
  `wet`/`connected`/`paired`) — the only non-paired path to the `dry` tag.
- New cases: one test asserting `tags('Kh8d3c')` contains `rainbow`+`dry` and excludes
  `wet`, `connected`, `paired`.
- Validation: `npx vitest run src/domain/boardTexture.test.ts`, then `npm run lint` /
  `npm run test:run` / `npm run build`.
- Result: pending implementation commit.
- Commit hash: see git log.
- Push result: pushed to `origin/main`.

### Gap B — draw clamp

- Files changed: `src/domain/blockerPractice.test.ts`
- Behavior covered: `drawPracticeCombo` clamps an injected `random()` of exactly `1` to the
  last live combo instead of indexing out of bounds.
- New cases: one test using `() => 1`.
- Validation: `npx vitest run src/domain/blockerPractice.test.ts`, then full lint/test/build.
- Result: pending implementation commit.
- Commit hash: see git log.
- Push result: pushed to `origin/main`.

### Gap C — CSV embedded-quote round trip

- Files changed: `src/domain/rangeTransfer.test.ts`
- Behavior covered: a range name containing a double-quote survives the
  `formatRangeCsv` → `parseRangeCsv` round trip (the `""` doubling/un-doubling branch).
- New cases: one round-trip test with a quoted name.
- Validation: `npx vitest run src/domain/rangeTransfer.test.ts`, then full lint/test/build.
- Result: pending implementation commit.
- Commit hash: see git log.
- Push result: pushed to `origin/main`.

## 7. Skipped Opportunities

- Coverage-instrumented gap hunting: skipped to avoid adding `@vitest/coverage-v8` and
  churning `package-lock.json` in a test-only pass.
- Micro-symmetry gaps (e.g. a `pullRanges` "throws the Supabase error" test mirroring the
  `pushRanges` one, or an empty-string-`id` rejection in `parseSavedRange`): the underlying
  code paths are already exercised transitively; adding them buys little regression
  confidence, so they were left as-is.
- Component-level additions: the component suite is already broad and behavior-focused; no
  high-value, low-risk gaps stood out without coverage data.

## 8. Final Notes

The repository remains strongly tested with behavior-focused tests and no useless-test debt.
This pass adds three genuine missing branch/edge-case tests (a non-paired dry flop, a draw
clamp boundary, and a CSV embedded-quote round trip) and otherwise confirms suite health.
</content>
</invoke>
