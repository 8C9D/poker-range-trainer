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

## Next slice

**Slice 2 — Wire the `@core/*` alias and prove shared-core reuse bundles (completes M0)**

Milestone: M0 — Foundation: Expo app + shared-core reuse.

Context: Slice 1 scaffolded the Expo app (Expo SDK 56, Expo Router) under `mobile/`
with an isolated toolchain (its own ESLint flat config, `tsc --noEmit`, and
jest-expo + `@testing-library/react-native` v14 — note RNTL v14's `render` is
**async**, so tests must `await render(...)`). The root ESLint ignores `mobile/`
and the root Vitest excludes `mobile/**`, so the web trio stays green. What's
missing is the build seam: the app cannot yet import the shared TypeScript core in
`../src`. This slice adds that seam and proves it end-to-end (typecheck + test +
bundle), which is the M0 "shared-core reuse" success criterion.

Reuse target (verified): `src/domain/pokerHands.ts` is pure TS (no DOM/`window`/
`localStorage`/`import.meta`) and exports `generateHandMatrix(): PokerHand[][]`
(the 13×13 matrix) and `ALL_HANDS: PokerHand[]` (the flat 169-hand list). Use it as
the smoke import — **import it from `@core/domain/pokerHands`, never copy it**.

Task:
- Add `mobile/metro.config.js` extending Expo's default config
  (`const { getDefaultConfig } = require('expo/metro-config')`), and set
  `config.watchFolders = [path.resolve(__dirname, '..')]` so files under `../src`
  are inside Metro's resolution scope and get bundled. Keep
  `config.resolver.nodeModulesPaths` covering both `mobile/node_modules` and the
  repo-root `node_modules` (Expo's default already includes the project's; add the
  root if resolution needs it).
- In `mobile/tsconfig.json` add `compilerOptions.baseUrl: "."` and
  `compilerOptions.paths: { "@core/*": ["../src/*"] }`. (Expo's Metro reads
  `tsconfig` paths, so the same alias resolves for both `tsc` and the bundler — no
  Babel module-resolver needed.)
- Add a `bundle-check` script to `mobile/package.json`:
  `"bundle-check": "expo export --platform ios --output-dir dist"` (the `dist/`
  output is already gitignored by `mobile/.gitignore`).
- Prove reuse in the app: in `mobile/app/index.tsx`, import from
  `@core/domain/pokerHands` and render something derived from it (e.g.
  `` `${ALL_HANDS.length} starting hands` `` under the title — should read
  "169 starting hands"). Keep the screen otherwise minimal.
- Add a reused-core test `mobile/__tests__/core-reuse.test.ts` (or `.tsx`) that
  imports `generateHandMatrix` / `ALL_HANDS` from `@core/domain/pokerHands` and
  asserts `ALL_HANDS.length === 169` and the matrix is 13×13. This proves the core
  runs under the mobile Jest via the alias. (Pure-logic test — no `render`, so no
  async-render concern.)

Files to create/modify:
- Create: `mobile/metro.config.js`, `mobile/__tests__/core-reuse.test.ts`.
- Modify: `mobile/tsconfig.json` (baseUrl + `@core/*` paths), `mobile/package.json`
  (add `bundle-check` script), `mobile/app/index.tsx` (import + render from
  `@core`).

Validation (mobile only — this slice does NOT modify shared `src/` or any root
config, so the web trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass. `bundle-check` must actually produce the
  iOS JS bundle (this is the first time it runs; if `expo export` cannot run
  headlessly in this environment, stop and report rather than faking it).

Constraints: reuse `@core`, never copy a domain module into `mobile/`; keep the
change minimal and reversible; no native modules yet (MMKV arrives in M1). Do not
edit anything under `src/`.

Suggested commit message:
`feat(ios): wire @core alias and prove shared-core reuse bundles`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
