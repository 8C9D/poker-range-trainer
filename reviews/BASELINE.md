# BASELINE

Raw, unedited output of the project's own validation commands, captured before any code changed.
Every later "green" claim in this run is measured against this file.

- Commit sha: `21f568bd228f30d7a99309bac544ad350825243b`
- Branch: `prod-readiness/2026-08-10`
- Date: 2026-08-10
- node v24.15.0 / npm 11.12.1
- Working tree: clean at capture time

Commands are the ones defined in the root `package.json` and required by `CLAUDE.md`.

## Summary

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | 0 | clean |
| `npm run test:run` | 0 | web 79 files / 1179 tests passed; mobile 34 suites / 214 tests passed |
| `npm run build` | 0 | vite build + mobile tsc --noEmit, both clean |

**There are no pre-existing failures.** Baseline is fully green, so any lint error, test failure, or build break introduced later in this run is a regression with no prior excuse.

## `npm run lint`

```

> poker-range-trainer@1.0.0 lint
> eslint . && npm --prefix mobile run lint


> mobile@1.0.0 lint
> eslint .

LINT_EXIT=0
```

## `npm run test:run`

```

> poker-range-trainer@1.0.0 test:run
> vitest run && npm --prefix mobile run test:run -- --runInBand


 RUN  v4.1.8 /Users/<user>/dev/poker-range-trainer

Not implemented: navigation to another Document

 Test Files  79 passed (79)
      Tests  1179 passed (1179)
   Start at  19:05:51
   Duration  10.26s (transform 3.74s, setup 9.54s, import 6.94s, tests 32.22s, environment 50.87s)


> mobile@1.0.0 test:run
> jest --runInBand

PASS __tests__/practice-screen.test.tsx
PASS __tests__/build-screen.test.tsx
PASS __tests__/library-screen.test.tsx
PASS __tests__/app-icons.test.ts
PASS __tests__/editor-screen.test.tsx
PASS __tests__/editor-preserves-overlay.test.tsx
PASS __tests__/theme.test.ts
PASS __tests__/accessible-names.test.tsx
PASS __tests__/live-save-error.test.tsx
PASS __tests__/today-screen.test.tsx
PASS __tests__/backup-screen.test.tsx
PASS __tests__/range-screen.test.tsx
PASS __tests__/reset-stats-panel.test.tsx
PASS __tests__/hand-grid.test.tsx
PASS __tests__/progress-screen.test.tsx
PASS __tests__/error-boundary.test.tsx
PASS __tests__/range-metadata-editor.test.tsx
PASS __tests__/range-overview-focus.test.tsx
PASS __tests__/session-summary.test.tsx
PASS __tests__/range-stats-bar.test.tsx
PASS __tests__/range-shortcuts.test.tsx
PASS __tests__/storage-parity.test.ts
PASS __tests__/crash-reporting.test.ts
PASS __tests__/mirror-parity.test.ts
PASS __tests__/app-config.test.ts
PASS __tests__/heading-roles.test.ts
PASS __tests__/create-range-id.test.ts
PASS __tests__/format.test.ts
PASS __tests__/storage-shim.test.ts
PASS __tests__/eas-config.test.ts
PASS __tests__/swipe-answer.test.ts
PASS __tests__/scenario.test.ts
PASS __tests__/crypto-shim.test.ts
PASS __tests__/core-reuse.test.ts

Test Suites: 34 passed, 34 total
Tests:       214 passed, 214 total
Snapshots:   0 total
Time:        19.083 s
Ran all test suites.
TEST_EXIT=0
```

## `npm run build`

```

> poker-range-trainer@1.0.0 build
> tsc -b && vite build && npm --prefix mobile run typecheck

vite v8.0.16 building client environment for production...
[2Ktransforming...✓ 110 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                          1.19 kB │ gzip:  0.55 kB
dist/assets/bricolage-grotesque-vietnamese-wght-normal-BUzh504Q.woff2    8.60 kB
dist/assets/instrument-sans-latin-ext-wght-normal-B5bTHO_g.woff2        11.14 kB
dist/assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2    18.66 kB
dist/assets/instrument-sans-latin-wght-normal-BbzFLZTg.woff2            30.09 kB
dist/assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2        41.34 kB
dist/assets/PracticeHost-CScPxMs0.css                                    5.76 kB │ gzip:  1.59 kB
dist/assets/index-mkAD5nO0.css                                          28.27 kB │ gzip:  5.80 kB
dist/assets/PracticeHost-DdHyzqpO.js                                    21.05 kB │ gzip:  6.80 kB
dist/assets/index-D3JZ87k7.js                                          277.27 kB │ gzip: 83.90 kB

✓ built in 120ms

> mobile@1.0.0 typecheck
> tsc --noEmit

BUILD_EXIT=0
```
