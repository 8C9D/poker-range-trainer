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
| _none yet_ | | | |

## Next slice

**Slice 1 — Scaffold the Expo app in `mobile/`**

Milestone: M0 — Foundation: Expo app + shared-core reuse.

Context: This is the first slice of the iOS port (see `ios-roadmap.md`). The web
app in `src/` stays untouched. We are adding a self-contained Expo (React Native +
TypeScript) app under `mobile/` that will, in later slices, import the existing
domain/types/cloud core via a `@core/*` path alias. This slice only creates the
scaffold and proves the two toolchains stay isolated — no shared-core import yet.

Task:
- Create a minimal Expo app (TypeScript, Expo Router) under `mobile/` with its own
  `package.json`, `tsconfig.json`, `app.json`/`app.config.ts`, and a single
  placeholder home screen that renders the app title.
- Give `mobile/` its own ESLint config and a Jest setup with
  `@testing-library/react-native`; add `lint`, `typecheck` (`tsc --noEmit`), and
  `test:run` scripts to `mobile/package.json`. Add one trivial passing test (e.g.
  the home screen renders its title) so `test:run` is meaningful.
- **Isolate the toolchains so the web build stays green:** add `mobile/` to the
  root ESLint ignores (`eslint.config.js`), exclude `mobile/` from the root Vitest
  config (`vitest.config.ts`), and ensure `mobile/` is not part of the root
  TypeScript project (`tsconfig*.json`). Do not let the root `tsc -b`/Vite build
  pick up RN code.
- Do NOT wire the `@core/*` alias or import any `src/` code yet — that is slice 2.
  Keep this slice to scaffold + isolation only.

Files to create/modify (indicative):
- Create: `mobile/package.json`, `mobile/app.json` (or `app.config.ts`),
  `mobile/tsconfig.json`, `mobile/eslint.config.js`, `mobile/app/index.tsx` (or
  `App.tsx`), `mobile/jest.config.*` + a setup file, and one `*.test.tsx`.
- Modify: root `eslint.config.js` (ignore `mobile/`), root `vitest.config.ts`
  (exclude `mobile/`). Touch root `tsconfig*.json` only if needed to keep `mobile/`
  out of the web project.

Validation:
- In `mobile/`: `npm install` then `npm run lint`, `npm run typecheck`, and
  `npm run test:run` — all must pass.
- At root (because this slice edits root ESLint/Vitest config): `npm run lint`,
  `npm run test:run`, and `npm run build` — all must still pass, proving the web
  app is unaffected.

Constraints: keep it minimal and reversible; no shared-core import; no native
modules yet (MMKV arrives in M1); local-only. Do not touch `src/` behavior.

Suggested commit message:
`feat(ios): scaffold Expo app in mobile/ with isolated toolchain`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
