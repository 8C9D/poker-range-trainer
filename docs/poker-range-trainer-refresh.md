# poker-range-trainer — resume context refresh (2026-09-05)

**Generated:** 2026-09-05
**Repo:** `~/dev/poker-range-trainer`, analysed at `ba982a5` (local `main`, clean tree, matching `origin/main`). After the analysis Arthur asked for one cleanup, which landed as **`d53c545` "chore: remove Supabase schema and Vite entry"** (2026-09-05, pushed): `supabase/migrations/` (4 files), root `index.html`, and `vite.config.ts` deleted; root `dev`/`preview` scripts and the `vite build` step dropped; `tsconfig.node.json`, `.prettierignore`, two legacy `src/cssIntegrity.test.ts` cases, and the README/CLAUDE.md/.env.example/data-and-migration wording updated. Nothing under `apps/` or `packages/` changed. Numbers below are from `ba982a5` unless a row says otherwise; the deltas are −6 tracked files, +1 commit, −1 declared legacy test case.
**Mode:** read-only analysis, then the one requested commit. Live checks were anonymous `curl -sI` plus `gh repo view` / `gh run list` / `gh api`. Test counts are grep-derived; the validation gate (lint, unit, integration, build) was run locally on `d53c545` and GitHub Actions ran it on `ba982a5` — both green.
**Targets:** full-stack, backend, AI-engineering internship bullets (Waterloo CS co-op). Testing is reported in the numbers table and de-emphasized in highlights.

**Privacy note:** the only user-like data in the repo is `screenshots/seed-backup.json`, a fixture that `docs/architecture/data-and-migration.md` states "is not production user data." No real accounts, emails, or credentials appear in the tree (secret-pattern grep in §6 came back empty).

---

## 1. One-line description

A web app where a user builds Texas Hold'em preflop starting-hand ranges on a 13×13 grid, drills themselves on them in six modes, and is told by a spaced-repetition schedule and per-hand accuracy analytics what to practise next (`README.md:3-5`, `apps/web/app/app/*`).

It is for a poker player memorising their own charts. "Range trainer" here means **preflop only**: a range is a user-named set of the 169 canonical starting-hand classes (`packages/database/src/seed.ts:13`), optionally tagged with scenario metadata — game type (cash/tournament/sit-and-go), table size, stack depth in big blinds, hero position (UTG/HJ/CO/BTN/SB/BB), action type (open/call/3-bet/4-bet/defend/jam/call-jam), and villain position (`packages/domain/src/types/range.ts:12-30, 118-135`). Drills ask "is this hand in the range?" (recognition, timed, weakness-weighted, range-edge, past-mistakes) or "rebuild the range from memory" (build) (`packages/contracts/src/practice.ts:8, 52-66`). There is no board, no postflop play, no solver, no villain-profile modelling, no mixed frequencies — the metadata "is descriptive only — it does not affect practice behavior" (`types/range.ts:115`). Multi-action and combo overlays exist as dormant legacy fields preserved on import but not exposed (`docs/architecture/data-and-migration.md:23-27`).

---

## 2. Tech stack — as in the tree today

| Item | Verdict | Proof (path, version) |
|---|---|---|
| **React** | **PRESENT** | `apps/web/package.json` `"react": "19.2.7"`; installed `node_modules/react` 19.2.7. Also root `package.json` `^19.2.6` (legacy Vite app) and `mobile/package.json` `19.2.3` (legacy Expo app). |
| **Next.js** | **PRESENT — App Router; server rendering used only for a static shell** | `apps/web/package.json` `"next": "16.3.4"`; routes under `apps/web/app/` (11 `page.tsx` + `layout.tsx`). `apps/web/app/layout.tsx` and `apps/web/app/page.tsx` (marketing landing) are server components with static JSX; the other 10 pages open with `'use client'` (`git grep -L "'use client'" -- 'apps/web/app/**/*.tsx'` lists only those two). **No** route handlers, **no** `middleware.ts`/`proxy.ts`, **no** server actions, **no** server-side data fetching. `next.config.ts`: `output: 'standalone'`, a `rewrites()` proxy of `/api/:path*` to the Express origin, and security headers incl. a production CSP. Claim "Next.js App Router"; do not claim "SSR/RSC data fetching". |
| **Node.js** | **PRESENT — pinned** | `.nvmrc` = `24.15.0`; root `package.json` `engines.node ">=24.15.0 <25"`, `engines.npm "11.12.1"`, `packageManager npm@11.12.1`; CI `setup-node` `node-version: 24`. No Dockerfile. |
| **Express.js** | **PRESENT — real server** | `apps/api/package.json` `"express": "^5.1.0"` (installed 5.2.1); `apps/api/src/server.ts` (listener) + `apps/api/src/app.ts` (composition); 24 `router.*` registrations across `auth/ranges/practice/settings/imports` + 2 health routes in `app.ts` = 26 endpoints. Not inside Next. |
| **C / C++** | **ABSENT** | `git ls-files \| grep -E '\.(c\|cc\|cpp\|h\|hpp\|rs\|go\|wasm\|swift\|m\|mm)$'` → nothing. No WASM, no addon, no solver. (The `argon2` npm dependency ships a prebuilt native addon, but no C/C++ was written here — NOT CLAIMABLE.) |
| **Anthropic API / any LLM** | **ABSENT** | `git grep -iE "anthropic\|openai\|@ai-sdk\|langchain\|gpt-\|claude-\|\bllm\b"` (lockfiles excluded) → zero matches. `CLAUDE.md` workflow rule: "Do not add … AI features unless explicitly requested." |
| **MCP / Claude Code plugin, skills, agents, hooks** | **ABSENT from the tree; present in history as dev tooling** | Tracked today: root `CLAUDE.md` (project instructions), `apps/web/CLAUDE.md` (`@AGENTS.md`), `apps/web/AGENTS.md` (auto-generated by `next dev`). Untracked/ignored: `.claude/settings.local.json`. Removed: `.claude/skills/*` (51373ac 2026-08-26, ba982a5 2026-09-04), `.agents/skills/*` (ffa6e04 2026-08-27, ba982a5), `.codex/config.toml` (ba982a5). Nothing MCP anywhere. This is evidence of an AI-assisted workflow, not of building agents/MCP — NOT CLAIMABLE as an AI-engineering deliverable. |
| **Database** | **PRESENT — PostgreSQL 16, Drizzle + pg, hand-written SQL migrations** | `compose.yaml` `postgres:16-alpine`; `packages/database/package.json` `drizzle-orm ^0.45.1` (0.45.2), `pg ^8.16.3` (8.23.0); `packages/database/src/schema.ts` 13 `pgTable`s; `src/migrations/0001..0003*.sql` (249 lines); custom migrator `src/migrator.ts` (advisory lock, one transaction per file, `schema_migrations`). No `drizzle-kit`. The abandoned Supabase schema files (`supabase/migrations/*.sql`, documentation-only, never executed) were removed in `d53c545`. |
| **Auth** | **PRESENT — hand-rolled sessions** | `apps/api/src/auth/`: Argon2id at OWASP minimum params (`password.ts:4-10`), 256-bit opaque session + CSRF tokens stored as SHA-256 (`tokens.ts`), HTTP-only `prt_session` cookie + readable `prt_csrf` double-submit cookie checked against `x-csrf-token` (`cookies.ts`, `middleware.ts:128-134`), timing-safe compare, dummy-hash verify against enumeration (`password.ts:69-77`), auth-specific rate limiter, server-side revocable sessions with touch. Routes: register/login/logout/me only. No OAuth, password reset, or email verification (grep empty). |
| **Docker / compose** | **compose only** | `compose.yaml` (Postgres 16 + healthcheck + volume). No `Dockerfile`, no app image. |
| **CI** | **PRESENT — 1 workflow, green on HEAD** | `.github/workflows/ci.yml` "CI": on push + PR; Postgres service container; `npm ci` root + `mobile`; `lint` → `test:run` → `test:integration` → `build`. `gh run list`: run 33940544648 on `ba982a5` completed **success** 2026-09-05T02:58Z; 5 prior runs also success. A GitHub-managed "pages build and deployment" ran on 2026-09-03 but `gh api repos/…` now reports `has_pages: false` (see §6). |
| **Deployment target config** | **ABSENT** | No `vercel.json`, `fly.toml`, `render.yaml`, `netlify.toml`, `wrangler.*`, `Procfile`, Dockerfile. `output: 'standalone'` is a build mode, not hosting. `docs/architecture/rebuild-status.md`: "Deployment: no Dockerfile, hosting config, or migration/backup runbook beyond the npm scripts." |
| **Test tooling** | Vitest 4.1.8 (root/web/api/packages; jsdom + Testing Library for web; supertest for API HTTP), Jest 29.7 + RNTL for `mobile/`. **No Playwright** (`grep -il playwright` across all `package.json` → none); rebuild-status lists browser E2E as "Not built yet". **No coverage thresholds** (grep across all vitest/jest configs → none). |

**Else notable in the stack (not on the list):**

- **npm-workspaces monorepo**: root `package.json` `"workspaces": ["apps/*", "packages/*"]`; three shared packages built with `tsc -b` and consumed through `exports` maps with `development`/`import` conditions.
- **`packages/contracts`**: Zod 4.4.3; 88 exported `*Schema` constants; every API response is parsed through its contract on the server (`apps/api/src/practice/service.ts:101-104`) and again in the browser client (`apps/web/lib/api-client.ts:152-166`).
- **TypeScript 6.0.3**, ESLint 9.39.5 (flat config, `react-hooks` 7 with `set-state-in-effect` enforced per `CLAUDE.md`), Prettier 3.7.
- **Legacy web code** `src/`: React 19 SPA code with hash routing (`src/app/routes`) and localStorage persistence under nine `poker-range-trainer.<slice>.v1` keys. Its Vite entry point (`index.html`, `vite.config.ts`) was removed in `d53c545`, so it no longer runs standalone; it is type-checked and tested by the root gate and is the code `mobile/` builds against. `vite` stays installed only as Vitest's dependency.
- **Legacy iOS app** `mobile/`: Expo SDK 56 / React Native 0.85.3 / expo-router, `eas.json` with an App Store Connect app id, Sentry RN 7.11 crash reporting (env-gated), `app.json` privacy manifest, `buildNumber: "5"`.
- **`archived/`**: 13 features cut from v1 on 2026-08-06 (postflop tools, cloud sync, share links, combo tools, …), fenced from typecheck/lint/tests/Metro/EAS (`archived/RESTORE.md`); tag `pre-trim-full-featureset` and branch `origin/archive/full-featureset` hold the pre-trim snapshot.
- Ops libraries in the API: `helmet` 8.3, `pino` 9.14 (redaction), `express-rate-limit` 8.7, `cors` 2.8.
- `scripts/verify-shared-package-runtime.ts`: a build-time smoke that asserts the shared packages resolve to compiled `dist/` JS and that the compiled migration file ships.

---

## 3. The rewrite

**When.** Every commit touching `apps/` or `packages/` falls in a three-day window: first `20cd206` 2026-09-01 "chore: establish full-stack foundation", last code commit `97514d4` 2026-09-03 "feat(web): add Account page" (`git log --reverse --format='%h %ad %s' --date=short -- apps packages`). 22 commits in total on the new stack (`git log --format=%h -- apps packages | wc -l`), followed by three docs commits on 2026-09-03/04 (README rewrite + CI Postgres `0085a33`, E2E note `0e0b952`, ledger removal `ba982a5`). Design docs are dated the same window (`docs/adr/0001-postgresql-over-nosql.md` "Date: 2026-09-01"). **No tag or branch marks the rewrite**; it happened on `main`. The only tag (`pre-trim-full-featureset`, 2026-08-06) marks the earlier feature trim, not the rewrite.

**What came before** (from history):

| Phase | Dates | Evidence |
|---|---|---|
| Local-only React + Vite web app with hash routing and localStorage | 2026-05-01 → | `6a34b82` first `src/` commit; `src/App.tsx`, `vite.config.ts`, `index.html` |
| Supabase cloud-sync attempt (auth wrapper, push/pull, shared packs) | 2026-05-29 → 2026-06-17 | `8490f56`, `8e25f5d`, `bb49ade`; 4 files in `supabase/migrations/` |
| Expo iOS app sharing `src/` via `@core/*` alias | 2026-06-23 → | `e9ffa4d` "feat(ios): scaffold Expo app with own toolchain" |
| Trim: 13 features moved to `archived/`, cloud sync archived, CI added | 2026-08-06 | `e046979`, `7ac4848`, `f8e156f`; tag `pre-trim-full-featureset` |
| iOS launch prep (Apple enrollment, EAS, Sentry, ASC record, build 5, TestFlight script, GPL licence) | 2026-08-15 → 2026-08-20 | `7abd0b3`, `2816d52`, `82cdd15`, `f695d27`, `3801a07`, `abac3c8`, `fd64db7` |
| Full-stack rebuild: Next.js + Express + PostgreSQL | 2026-09-01 → 2026-09-03 | 22 commits above |

**What remains in the tree from the old stack — all of it, deliberately:**

- `src/` (143 tracked files, 9,288 source LOC) — the legacy web code, still type-checked (`tsc -b`) and tested by the root gate. At `ba982a5` it was also a runnable Vite app (`"dev": "vite"`, `vite build` inside `npm run build`); `d53c545` removed that entry point, so it is now shared code for `mobile/` rather than a second product.
- `mobile/` (102 files, 6,770 LOC) — the legacy iOS app, still linted/tested/typechecked by the root gate.
- `archived/` (209 files, 13,055 LOC + 9,116 test LOC) — cut features, excluded from every toolchain.
- ~~`supabase/migrations/` (4 SQL files)~~ — removed in `d53c545`.
- ~~Root `index.html`, `vite.config.ts`~~ — removed in `d53c545`. Still present and now unreachable: `tsconfig.app.json`, `src/main.tsx`, and `public/` (favicon, app icon, manifest, service worker), which `src/serviceWorker.test.ts` and `src/cssIntegrity.test.ts` continue to guard.
- `docs/index.html`, `docs/privacy.html`, `docs/support.html` — GitHub Pages content for the iOS app.

**Complete or mid-migration?** Both, honestly stated in-tree. The declared scope of the new product is built: `docs/architecture/rebuild-status.md` "Built" table lists monorepo, schema, Express foundation, auth, ranges, practice sessions, read models, settings, import/export, and the web app. Its "Not built yet" list: signed-in browser E2E tests, deployment, a mobile client for the API, offline sync. So: **feature-complete against its own ledger, not deployed, and the legacy apps are intentionally kept as the migration source** ("The existing Expo application and local-only implementation remain intact until a validated import-first migration path exists", `target-architecture.md:11-13`). There are consequently **three UIs for the same five screens** (Today/Library/Range/Progress/Account in `src/screens`, `mobile/app`, `apps/web/app/app`) and **two persistence models** (localStorage v1 keys vs PostgreSQL). Data is bridged, not synchronised: the legacy v1 backup file is the import/export format of the new API (`packages/contracts/src/legacy-backup.ts`, `apps/api/src/imports/`).

**Carried over vs written new:**

- **Moved, single-sourced:** all 35 domain modules. `20cd206` deleted 9,183 lines from `src/` and left 74 lines of one-line shims — every `src/domain/*.ts` now reads `/** @deprecated … */ export * from '../../packages/domain/src/domain/<name>'` (35 of 35 files, `grep -l "@deprecated Import from @poker-range-trainer/domain" src/domain/*.ts | wc -l`). The mobile app reaches the same code through `@core/*`. `packages/domain/src/domain/*.test.ts` moved with them.
- **Carried over as a contract:** the legacy backup version-1 shape (`packages/contracts/src/legacy-backup.ts`) and the `SavedRange`/practice types (`packages/domain/src/types/*`, moved from `src/types`).
- **Written new (Sep 1–3):** `apps/api` (5,434 LOC), `apps/web` (6,094 LOC incl. CSS), `packages/contracts` (1,709), `packages/database` (861 incl. SQL), `scripts/verify-shared-package-runtime.ts`, the Postgres service in CI, the three design docs and ADR.

---

## 4. Scope and scale — verifiable numbers only

Run from `~/dev/poker-range-trainer` at `ba982a5`. The LOC helper (`loc`) and test-count patterns are spelled out in the commands appendix; "source" excludes `*.test.*`, `*.integration.*`, `test/`, `__tests__/`, `__mocks__/`, setup/config files, lockfiles, JSON, Markdown, images.

| Metric | Value | Command |
|---|---|---|
| Commits | **676** at `ba982a5`; **677** after `d53c545` | `git rev-list --count HEAD` (same with `--all`) |
| Date range | 2026-05-01 → 2026-09-04 (→ 2026-09-05 with `d53c545`) | `git log --reverse --format=%ad --date=short \| head -1`; `git log -1 --format=%ad --date=short` |
| Commits by month | May 111 · Jun 108 · Jul 188 · Aug 244 · Sep 25 | `git log --format=%ad --date=format:%Y-%m \| sort \| uniq -c` |
| Authors | **1** (`8C9D`, GitHub noreply address) | `git shortlog -sne HEAD` |
| Rewrite commits (touch `apps/` or `packages/`) | **22**, 2026-09-01 → 2026-09-03 | `git log --format=%h -- apps packages \| wc -l` |
| Tags / branches | 1 tag `pre-trim-full-featureset` (=`266a656`, 2026-08-06); branches `main`, `origin/archive/full-featureset` | `git tag`; `git branch -a` |
| Tracked files | **705** (archived 209 · src 143 · packages 106 · apps 106 · mobile 102 · docs 8 · other 31); **699** after `d53c545` | `git ls-files \| wc -l`; `git ls-files \| cut -d/ -f1 \| sort \| uniq -c` |
| **Source LOC, new stack** | **18,226** | sum of rows below |
| ↳ `apps/web` | 6,094 (tsx 4,010 · ts 861 · css 1,223) | `loc apps/web` |
| ↳ `apps/api` | 5,434 (ts) | `loc apps/api` |
| ↳ `packages/domain` | 4,128 (ts, 35 modules) | `loc packages/domain` |
| ↳ `packages/contracts` | 1,709 (ts) | `loc packages/contracts` |
| ↳ `packages/database` | 861 (ts 612 · sql 249) | `loc packages/database` |
| Source LOC, legacy `src/` | 9,288 (tsx 4,188 · ts 2,547 · css 2,553; the ts figure includes the 35 shim files) | `loc src` |
| Source LOC, legacy `mobile/` | 6,770 (tsx 5,752 · ts 896 · js 122) | `loc mobile` |
| Source LOC, `archived/` (fenced, does not compile) | 13,055 (tsx 8,905 · ts 3,322 · css 828) | `loc archived` |
| Test LOC, new stack | **15,862** (web 2,882 · api 6,108 · packages 6,872) | `tloc <area>` |
| Test LOC, legacy | 13,491 (src 8,824 · mobile 4,667); archived 9,116 | `tloc <area>` |
| Test files | web 13 · api 22 · packages 39 · src 44 · mobile 37 · archived 95 | see appendix |
| Test cases declared (`it(`/`test(`) | new stack **867** (web 89 · api 124 · packages 654); legacy 792 (src 555 · mobile 237; src 554 after `d53c545`); archived 638 | see appendix (grep undercounts `it.each` expansions) |
| Test cases **executed** locally on `d53c545` | root Vitest (packages + legacy `src`) **1,251** · web **89** · API unit **114** · mobile Jest **246** · integration **37** (database 5 + API 32) — all passed | `npm run test:run` (web files re-run alone, see note), `npm --workspace @poker-range-trainer/api run test`, `npm --prefix mobile run test:run -- --runInBand`, `DATABASE_URL=… npm run test:integration` |
| Integration test files (need Postgres) | 9 (8 in `apps/api`, 1 in `packages/database`) | `git ls-files apps packages \| grep integration \| grep -v config` |
| Last validation | CI run 33940544648 on `ba982a5`: lint, test:run, test:integration, build — **success**, 2026-09-05T02:58Z. Local gate on `d53c545`: lint ✓, unit ✓, integration ✓, `npm run build` ✓ (see note) | `gh run list -R 8C9D/poker-range-trainer -L 8 --json …` |
| API endpoints | **26** (24 `router.*` + 2 health) | `git grep -h -E "router\.(get\|post\|put\|patch\|delete)\(" -- apps/api/src \| wc -l` |
| Next.js pages | 11 `page.tsx` (+1 layout); 10 client, 1 server (landing) | `git ls-files apps/web/app \| grep -c page.tsx` |
| Web components / lib | 10 components, 4 lib modules; largest `practice-host.tsx` 836, `range-editor.tsx` 403, `api-client.ts` 351, `drill.ts` 314 | `wc -l apps/web/components/*.tsx apps/web/lib/*.ts` |
| Legacy screens | web 5 (`src/screens`) + practice overlay; mobile 7 route files + 2 layouts (`mobile/app`) | `git ls-files src/screens mobile/app` |
| Hand classes | **169** (13×13), seeded idempotently from the domain matrix | `packages/database/src/seed.ts:13`; `README.md:67` |
| Scenario vocab | 6 positions · 3 game types · 3 table sizes · 7 action types · 5 source kinds | `packages/domain/src/types/range.ts` |
| Practice modes | **6** (`recognition`, `timed`, `weakness`, `edges`, `mistakes`, `build`) | `packages/contracts/src/practice.ts:8` |
| DB tables | **13** in `schema.ts` (12 in migration 0001 + `practice_submission_replays` in 0002) | `grep -c "pgTable(" packages/database/src/schema.ts`; `grep -ci "create table" …/0001*.sql` |
| Migration 0001 | 227 lines · 33 `check (` constraints · 14 indexes | `grep -ci "check (" …/0001*.sql`; `grep -ci "create.*index" …/0001*.sql` |
| Contract schemas | **88** exported `*Schema` | `cat packages/contracts/src/*.ts \| grep -v test \| grep -cE "^export const \w+Schema"` |
| Import fixture | 4 ranges, 4 session-history/stat/review entries, goal 50 | `node -e` over `screenshots/seed-backup.json` |
| CI workflows | **1** (`ci.yml`) | `ls .github/workflows` |
| Node / npm pinned | 24.15.0 / 11.12.1 | `cat .nvmrc`; `package.json` `engines` |
| README | 141 lines, 7,916 bytes | `wc -l README.md` |

**Note on the local gate (2026-09-05, `d53c545`).** The first `npm run test:run` failed with 6 of 89 `apps/web` component tests timing out at the workspace's 5 s default while the machine's load average was 31 from unrelated builds; each of the five files passed when run alone (`cd apps/web && npx vitest run components/<file>.test.tsx`). Because the root script chains suites with `&&`, the API and mobile suites were then run explicitly and passed. CI on `ba982a5` (same test code) was green. Treat the timeouts as environmental, not as a regression from the cleanup.

---

## 5. Engineering highlights (full-stack / backend angles)

Six, each anchored to a file and a mechanism. No AI-angle highlight exists in this repo (see §2).

### 5.1 Drill recording is one transaction, idempotent by key, scored on the server
`apps/api/src/practice/repository.ts:168-283` (`submit`). Inside one `database.transaction`: `pg_advisory_xact_lock(hashtext(userId:idempotencyKey))` serialises same-key retries while distinct ranges stay concurrent; a replay ledger (`practice_submission_replays`, PK `(user_id, idempotency_key)`, migration `0002`) returns the stored response snapshot for a repeat, or raises `PRACTICE_IDEMPOTENCY_CONFLICT` → HTTP 409 when the same key arrives with a different SHA-256 request fingerprint (`routes.ts:87`); the range row is locked `FOR UPDATE` (`:531-542`) and answers are scored from the **stored** hand list — "Derive all answer truth from the locked, current range — never from the request" (`scoring.ts:27`). The same transaction then inserts the session and attempts, upserts per-range totals and per-hand accuracy, and advances the spaced-repetition state. The contract documents the guarantee (`data-and-migration.md:30-32`).
*Interviewer probe:* "What if the replay row is corrupted or the schema changes?" — the tree answers: the snapshot is re-parsed through the public response schema and a mismatch raises `PRACTICE_REPLAY_CORRUPTED` rather than leaking (`repository.ts:183-184`).

### 5.2 Data model: owner scoping and poker vocabulary enforced in PostgreSQL, not just in code
`packages/database/src/migrations/0001_persistence_foundation.sql` — 12 tables, 33 CHECK constraints, 14 indexes. Child rows carry `(range_id, user_id)` composite FKs to `ranges(id, user_id)` so a row cannot point at another user's range (`:118-120`, `:136`); `practice_attempts.correct` is constrained to equal `(expected_in_range = user_answered_in_range)` (`:162`); every hand column FKs to the 169-row `hand_classes` table whose `combo_count in (4,6,12)` and `matrix_order 0..168` are checked (`:39-45`); session/CSRF token columns must be 64-hex SHA-256 (`:31-32`); legacy ids get a partial unique index per owner (`:104`). Schema edits are new numbered SQL files plus a Drizzle schema edit; `drizzle-kit` is not a dependency, and the migrator (`migrator.ts`) takes a session advisory lock and applies each file in its own transaction. Rationale is written down (`docs/adr/0001-postgresql-over-nosql.md`).
*Probe:* "Why hand-written SQL over generated migrations?" — the ADR gives the constraint-first reasoning; the "never edit an applied migration" rule is in `CLAUDE.md`. Answered.

### 5.3 The training loop decides what to drill with pure, clock-injected domain functions reused verbatim by the API
`apps/api/src/practice/service.ts:135-200` builds Today from `selectDueRanges` (a range is due when never reviewed or `dueAt` ≤ today in the caller's IANA zone via `zonedCalendarDays`), and when nothing is due calls `suggestFreePractice`, which chooses between the user's recorded weak hands and the chart that goes stale soonest (`packages/domain/src/domain/freePractice.ts:6-16`). Scheduling is a three-bucket ease/interval rule — accuracy <50 resets to 1 day and shrinks ease, 50–79 holds, ≥80 multiplies by ease — with the interval further clamped by cumulative per-hand confidence, floor 0.5 (`spacedRepetition.ts:22-47`). Drill content selection lives in the domain too: boundary hands are those whose 13×13 grid neighbours differ in membership (`edgeHands.ts:20-27`); in-session misses add three extra draw-pool copies (`weaknessDrill.ts:18`); the past-mistakes mode replays persisted false positives/negatives (`apps/web/lib/drill.ts:155-208`). The service comment explains the design choice: legacy screens' numbers "already have a tested pure function behind it … rather than re-deriving the same analytics in SQL where they would drift" (`service.ts:47-56`).
*Probe:* "Does this scale?" — the tree admits the limit: `readLibrarySnapshot` "loads a user's whole session history … Fine at current sizes; bound it if a heavy user appears" (`rebuild-status.md:38-40`). Say so before they ask.

### 5.4 API boundary: contracts parsed on both ends, problem+json errors, and a same-origin proxy so cookies never cross origins
`apps/api/src/app.ts`: request-id propagation (UUID-validated inbound `x-request-id`), pino request logs, helmet, exact-origin CORS (config rejects `*`, duplicates, non-https in production — `config.ts:50-79`), draft-7 rate-limit headers, a 1 MiB JSON body cap that the import router bypasses so a large backup is only parsed **after** authentication and CSRF ("let an anonymous client spend the process's memory before anything checked who was asking", `app.ts:110-114`), RFC 9457 `application/problem+json` for every failure incl. 404/413/429/500, and live/ready health routes. Every service method returns `schema.parse(...)` of its read model (`practice/service.ts:104,131,168`), and the browser client re-validates every response with the same Zod schema and maps failures to `network | invalid-response | problem` (`apps/web/lib/api-client.ts:41-60,152-166`). `next.config.ts` rewrites `/api/:path*` to the Express origin, so the session cookie is host-only and the frontend never learns an API URL (`.env.example:1-6`). Range mutations carry an optimistic `version`; a stale one is HTTP 409 (`ranges/repository.ts:76,541`, `routes.ts:74-76`).
*Probe:* "CSRF with SameSite=Lax — why also double-submit?" — `cookies.ts:22-28` + `middleware.ts:128-134` (header token hashed and timing-safe-compared to the stored CSRF hash). Answered.

### 5.5 Legacy migration path: preview → digest-checked atomic import, per-user lock, idempotent by file hash
`apps/api/src/imports/service.ts` + `repository.ts:145-147`. Preview never writes and reports counts, preservation warnings, colliding legacy ids, and whether a merge/replace choice is required; commit recomputes the backup digest and refuses on mismatch with the previewed one (`service.ts:111-112`), takes `pg_advisory_xact_lock(hashtext(userId))`, and writes everything in one transaction with `merge` or `replace` semantics. `legacy_imports` has `unique (user_id, backup_sha256)` so the same file cannot be imported twice (`0001:59`); dormant fields the new product does not expose are kept in a JSONB `legacy_payload` (`data-and-migration.md:23-27`); export regenerates a version-1 file the legacy apps read. The format itself is a shared Zod contract (`packages/contracts/src/legacy-backup.ts`) and the legacy repo rule ("BACKUP_VERSION bump … must be mirrored") is in `CLAUDE.md`.
*Probe:* "What does replace do to the old library?" — soft-delete, rows kept, "no UI to restore them" (`rebuild-status.md:41-43`). Answered, with a known gap.

### 5.6 Monorepo runtime guard and a CI gate that runs both generations of the product
`scripts/verify-shared-package-runtime.ts` runs inside `npm run build` and fails unless each shared package's production export resolves to compiled `dist/*.js` (not TS source) and the compiled migration SQL was copied next to the compiled migrator; `apps/api/src/runtime-smoke.ts` constructs the Express app from compiled ESM without opening a listener. `packages/*/package.json` use conditional `exports` (`development` → source or dist, `import` → dist) so the same specifier works under `tsx`, Vitest, and Node. `.github/workflows/ci.yml` provisions a Postgres 16 service and runs lint, unit, integration, and build for the new workspaces **and** the legacy Vite and Expo/Jest toolchains on every push and PR, from the repo root (the comment explains the `--prefix mobile` trap).
*Probe:* "Why does the build type-check a mobile app the product no longer uses?" — because `mobile/` shares `packages/domain` through `@core/*` and is the migration source; `CLAUDE.md` says so. Answered.

---

## 6. Distribution status

**Repository** (`git remote -v`; `gh repo view 8C9D/poker-range-trainer --json …`; `gh api repos/8C9D/poker-range-trainer`, all 2026-09-05):

| Field | Value |
|---|---|
| Remote | `https://github.com/8C9D/poker-range-trainer.git` |
| Visibility | **PRIVATE** (anonymous `curl -sI https://github.com/8C9D/poker-range-trainer` → **404**) |
| Description | "Texas Hold'em preflop range trainer: Next.js + Express + PostgreSQL monorepo, with the original local-only React and Expo apps" — set |
| Homepage | empty |
| Topics | none |
| Licence | `LICENSE` is GPL-3.0 text with a "Poker Range Trainer / Copyright (C) 2026 8C9D" header (commit `fd64db7` "license the repo under gpl-3.0"); GitHub's detector reports `Other / NOASSERTION` because of the prepended header |
| Default branch | `main` |
| Created / last push | 2026-06-03T21:47Z / **2026-09-05T02:58Z** |
| Stars | 0 |
| GitHub Pages | `has_pages: false`; `gh api …/pages` → 404 |

Note: four CI runs on 2026-09-03 reference commits (`9ac05ef`, `1507652`, `5140b29`, `dcb7fe8`) that do not exist in the local clone (`git cat-file -t` → "Not a valid object name"), i.e. history was rewritten and force-pushed that evening before the final Sep 3/4 commits. Not visible in the tree, but a reviewer looking at Actions would see it.

**Live deployment — none.** Every candidate URL in tracked files (`git grep -hoE "https?://…"`, lockfiles/LICENSE/archived excluded) is a test fixture (`app.example.com`, `api.example.test`, `trainer.test`, `attacker.example`), a Sentry doc link, or the RFC 9457 problem-type base `https://poker-range-trainer.dev/problems` (`apps/api/src/problem.ts:5`). Anonymous `curl -sI` results:

| URL | Status |
|---|---|
| `https://poker-range-trainer.dev/` | **000** — no DNS / connection (curl failed) |
| `https://8c9d.github.io/poker-range-trainer/` | **404** |
| `https://8c9d.github.io/poker-range-trainer/privacy.html` | **404** |
| `https://8c9d.github.io/poker-range-trainer/support.html` | **404** |
| `https://github.com/8C9D/poker-range-trainer` | **404** (private) |

No URL returns 200. "Deployed" is not claimable for the web product. The iOS app: `mobile/eas.json` carries `ascAppId 6801882118` and `app.json` `buildNumber "5"`, and commits on 2026-08-15 record an App Store Connect record, builds 4→5, and a TestFlight pass script — but nothing in the tree proves a public App Store listing or TestFlight distribution to anyone (see §8).

**README state.** 141 lines. Accurate to the current tree: architecture table matches `apps/*` and `packages/*` versions, feature list matches the rebuild-status "Built" table, the API table matches the 26 registered routes, scripts table matches root `package.json`. It links only the in-repo docs; **no demo link, no screenshots, no badge**. It correctly labels `src/` and `mobile/` as legacy.

**What a reviewer opening the repo would notice (list, not fixed):**

1. ~~`supabase/migrations/`~~ — **removed in `d53c545`** (Arthur: "Oversight").
2. `.env.example:71` references `LAUNCH-CHECKLIST.md step 7`, a file deleted in `ba982a5`. Dangling reference — **still present**, not touched by the cleanup.
3. `archived/` — 209 files / ~22k LOC of non-compiling code at the top level, with a `RESTORE.md` explaining the fence. Intentional, but it is the largest directory by file count.
4. ~~Root `index.html`, `vite.config.ts`, `"dev": "vite"`~~ — **removed in `d53c545`**. Left behind and now unreachable: `tsconfig.app.json` (still needed to type-check `src/`), `src/main.tsx`, and `public/` (favicon, app icon, manifest, service worker) plus the two legacy tests that guard them. Candidate for a follow-up removal.
5. Two `CLAUDE.md` files and `apps/web/AGENTS.md` (Next-generated) — visible AI-assisted-workflow artifacts; harmless, but present.
6. `docs/index.html`, `docs/privacy.html`, `docs/support.html` with `.nojekyll` — Pages content for an app whose Pages site is now disabled.
7. History shows a force-push on 2026-09-03 (run SHAs missing locally) and ~40 near-identical "record round N's review and fixes" commits in Aug 11–12.
8. Single author under a GitHub noreply alias `8C9D`; commit trailers/bodies: 3 messages mention Claude/Codex tooling, no `Co-Authored-By` lines.
9. Secrets: none. Pattern grep for keys/tokens/DSNs empty; `.env.example` holds only the compose dev credential, labelled "deliberately a development-only credential."
10. `TODO/FIXME`: none in `apps`, `packages`, `src`, `mobile`, `scripts`, `docs` (the one grep hit is a lockfile hash).

---

## 7. Claim ladder

| # | Claim | Verdict | Condition / evidence today |
|---|---|---|---|
| 1 | **"Built a full-stack Texas Hold'em preflop range trainer — Next.js 16 / React 19 front end, Express 5 REST API, PostgreSQL 16 — in a TypeScript npm-workspaces monorepo with shared domain and Zod contract packages"** | **DEFENSIBLE NOW** | Every noun has a path in §2; 18,226 source LOC on the new stack; CI green on HEAD. |
| 2 | "Rebuilt a local-only React/Vite + Expo app into a multi-user web product with an import path for existing users' data" | **DEFENSIBLE NOW** | §3; `apps/api/src/imports`, `legacy-backup.ts`, 35 shim files prove the move. |
| 3 | "Designed the PostgreSQL schema (13 tables, hand-written SQL migrations, composite-FK owner scoping, 33 check constraints) and a transactional, idempotent drill-recording endpoint" | **DEFENSIBLE NOW** | §5.1, §5.2. Use the mechanism words; drop the counts if space is tight. |
| 4 | "Implemented session auth (Argon2id, hashed opaque tokens, HTTP-only cookie + double-submit CSRF, rate limiting)" | **DEFENSIBLE NOW** | `apps/api/src/auth/*`. Do not say "OAuth", "JWT", "SSO", or "password reset". |
| 5 | "Spaced-repetition scheduling and per-hand leak analytics as a pure, framework-free domain package shared by API and browser" | **DEFENSIBLE NOW** | `packages/domain` (4,128 LOC, no runtime deps), §5.3. |
| 6 | "CI with a PostgreSQL service running unit, integration, and build gates on every push" | **DEFENSIBLE NOW** | `ci.yml`; last run success. Keep it subordinate (testing de-emphasised). |
| 7 | "Shipped an iOS app (Expo) to TestFlight" | **DEFENSIBLE ON ARTHUR'S WORD, not tree-verifiable** | Arthur (2026-09-05): build 5 is **on TestFlight only**, not on the App Store. The tree corroborates the pipeline (EAS/ASC ids, build 5, device-pass script) but cannot show distribution. Say "shipped to TestFlight"; never "on the App Store". |
| 8 | "Developing…" tense for the web product | **DEFENSIBLE, but weaker than #1** | Ledger is complete for declared scope; use "Built" and add "not yet deployed" only if the bullet format demands status. |
| 9 | "Deployed" / "Live" / "In production" / "Serving users" | **NOT CLAIMABLE** | No hosting config; no URL returns 200; repo private; rebuild-status says deployment not built. Arthur (2026-09-05): **no hosting plan yet**, so this does not flip soon. |
| 10 | "Server-rendered / RSC data fetching / Next.js route handlers" | **NOT CLAIMABLE** | 10 of 11 pages are `'use client'`; no route handlers, middleware, or server fetches. "App Router" is fine. |
| 11 | "Node.js" on the skills line | **CLAIMABLE** | Express server runs on Node 24 (`.nvmrc`, `engines`). |
| 12 | "C / C++" | **BANNED** | No native code exists. |
| 13 | "Anthropic API / LLM / AI features / MCP / agents" | **BANNED** | Zero references in code; `CLAUDE.md` forbids adding AI features. AI-assisted *development* is not a product feature; mention only in an interview if asked how the code was written. |
| 14 | "Docker" | **QUALIFY** | Say "docker-compose PostgreSQL for local/CI"; there is no application Dockerfile or image. |
| 15 | "Playwright / E2E tested", "coverage X%" | **BANNED** | No Playwright; no coverage thresholds or reports. |
| 16 | "Multi-user" / "accounts" | **CLAIMABLE** | Owner-scoped tables + register/login exist; but say "multi-user" not "used by N users" (no users are evidenced). |
| 17 | "Open source" | **NOT CLAIMABLE today; planned** | GPL-3.0 licence file exists, but the repo is private and a licence detector would not even read it. Arthur (2026-09-05): the repo **will be made public before applications go out** — at that point "open source (GPL-3.0)" and a repo link become claimable. Do the §6 cleanup first. |
| 18 | "Scalable / production-grade / robust" | **BANNED as adjectives** | Replace with the mechanism (advisory locks, replay ledger, check constraints, rate limits). The tree also records a known unbounded read (§5.3). |

**Banned-claim summary:** deployed/live/production, real users, C/C++, any LLM/AI/MCP/agent feature, Playwright/E2E, coverage numbers, OAuth/JWT/password-reset, Dockerised app, SSR data fetching, open-source (while private), "on the App Store" (it is TestFlight-only), and any unqualified "scalable/robust/production-grade".

---

## 8. Open questions for Arthur — answered 2026-09-05 where possible

| # | Question | Answer / resolution |
|---|---|---|
| 1 | iOS app status (build 5, ASC id in `mobile/eas.json`) | **TestFlight only.** Not on the App Store. Ladder row 7 updated. |
| 2 | Hosting target for the web product | **No plan yet.** "Built, not deployed" phrasing stands; ladder row 9 unchanged. |
| 3 | Repo visibility | **Will be made public before applying.** Ladder row 17 updated. Pre-publication cleanup: item 2 in §6 (dangling `LAUNCH-CHECKLIST.md` reference) and item 4 (unreachable `public/`, `src/main.tsx`). |
| 4 | Force-push on 2026-09-03 (four CI SHAs absent locally) | Arthur: "use your judgment". Judgment: the missing SHAs sit between the last `feat(web)` commit and the three docs commits of the same evening, consistent with rewording/squashing docs commits to satisfy the 50-character commit-msg hook. Harmless; no code diverges (`origin/main` = local). Not worth mentioning anywhere. |
| 5 | Authorship under alias `8C9D` (noreply email) | Arthur: "use your judgment". Judgment: link the repository URL itself on the resume, not a profile; once public, the commit author shown is the handle `8C9D`, which is attributable to you only if that handle is on your GitHub profile. If the profile is under a different display name, add your real name to the GitHub profile rather than rewriting history. |
| 6 | Stale `supabase/migrations/` and root Vite entry points | **"Oversight. Remove these for me."** Done in `d53c545` (see header). Leftovers listed in §6 item 4 are the natural next removal. |
| 7 | Real legacy backup imported through preview/commit? | **Unknown** ("Don't know"). Keep the current wording ("built an import path"), not "migrated existing user data". Suggested pre-publication check: export a backup from the TestFlight build, run it through `Account → Import legacy backup` against local Postgres, and note the result in `rebuild-status.md`. |
| 8 | Workflow split (hand-written vs AI-assisted) | **"Mostly spec-driven with Claude/Codex."** Recorded in §9 as facts only. |

**Still open:** #7 (real-data import), and whether to remove the unreachable `public/` + `src/main.tsx` remnants and the `.env.example` dangling reference before flipping the repo public.

---

## 9. AI-assisted workflow evidence (facts only)

Arthur states the project was mostly spec-driven with Claude Code and Codex. What the repository itself shows, without the prompts:

- The very first commit is `d00033f` 2026-05-01 "chore: add Claude workflow docs"; a root `CLAUDE.md` has existed since, and today's version is a 4 KB instruction file covering architecture boundaries, storage-versioning rules, validation gates, and scope prohibitions ("Do not add payments, solver imports, … or AI features unless explicitly requested"; "Report failures honestly").
- Tooling files present at various points and since removed: `.claude/skills/{build-ios-app,finish-roadmap,finish-v2,roadmap-slice,update-stale-docs}/SKILL.md`, mirrored `.agents/skills/*` pointers, and `.codex/config.toml` ("point Codex config at Claude config", `65a7e75` 2026-08-04). All gone by `ba982a5` (2026-09-04).
- The commit log shows structured review rounds: ~40 commits on 2026-08-11/12 titled "review round N, record M findings" / "record round N's review and fixes" / "complete the round N commit record", and a 2026-08-06 trim that moved 13 features to `archived/` with a `RESTORE.md` and `TRIM-REPORT.md` (the latter deleted in `ba982a5`).
- The rewrite itself landed as 22 conventional-commit slices in three days (2026-09-01 → 03), each named by layer (`feat(contracts)`, `feat(api)`, `feat(web)`), with design docs and an ADR committed on day one — consistent with a spec-first, slice-by-slice workflow.
- Human-owned artifacts in the tree: `CLAUDE.md` rules, the three architecture docs, `docs/architecture/rebuild-status.md` as the declared source of truth, and the validation gate. Prompt files are not in the repo.
- Interview framing that the tree supports: "I specified the architecture and data model in docs and ADRs, enforced boundaries through repo instructions and CI, and used Claude Code / Codex to implement slices against those specs, reviewing each slice through the lint/test/integration/build gate." It does not support claims of building agents, MCP servers, or LLM features (§2).

---

## Commands appendix

```bash
# run from ~/dev/poker-range-trainer at ba982a5 (2026-09-05)
git rev-parse --short HEAD; git status --short | wc -l            # ba982a5, 0
git rev-list --count HEAD                                          # 676
git log --reverse --format='%h %ad %an' --date=short | head -1     # d00033f 2026-05-01 8C9D
git log -1 --format='%h %ad %an' --date=short                      # ba982a5 2026-09-04 8C9D
git shortlog -sne HEAD                                             # 676  8C9D <…noreply…>
git log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c      # 111/108/188/244/25
git tag; git branch -a; git remote -v
git log --reverse --format='%h %ad %s' --date=short -- apps packages | head -1   # 20cd206 2026-09-01
git log -1 --format='%h %ad %s' --date=short -- apps packages                    # 97514d4 2026-09-03
git log --format=%h -- apps packages | wc -l                                      # 22
git ls-files | wc -l                                               # 705
git ls-files | cut -d/ -f1 | sort | uniq -c | sort -rn             # per-area file counts

# LOC helper used for every "source LOC" row (excludes tests, configs, lockfiles, json/md/images)
loc() { git ls-files $1 | grep -vE '(\.test\.|\.integration\.|/test/|/__tests__/|/__mocks__/|jest\.setup|test/setup|vitest.*config|package-lock|\.json$|\.md$|\.png$|\.svg$|\.webmanifest$)' \
  | while read f; do echo "${f##*.} $(wc -l < "$f")"; done | awk '{s[$1]+=$2} END {for (k in s) printf "  %s=%d\n", k, s[k]}'; }
loc apps/web; loc apps/api; loc packages/domain; loc packages/contracts; loc packages/database; loc src; loc mobile; loc archived
# test LOC
tloc() { git ls-files $1 | grep -E '(\.test\.|\.integration\.|/test/|/__tests__/|/__mocks__/|jest\.setup|test/setup)' | grep -vE 'config' | xargs wc -l | tail -1; }
# test files / cases
git ls-files <area> | grep -E '(\.test\.|\.integration\.|/test/[^/]+\.ts$|/__tests__/)' | grep -vE 'setup|config' | wc -l
git ls-files <area> | grep -E '(\.test\.|\.integration\.|/test/[^/]+\.ts$|/__tests__/)' | xargs grep -hE "^\s*(it|test)(\.each\([^)]*\))?\(" | wc -l

git grep -h -E "router\.(get|post|put|patch|delete)\(" -- apps/api/src | wc -l   # 24 (+2 health in app.ts)
git ls-files apps/web/app | grep -c page.tsx                                       # 11
git grep -L "'use client'" -- 'apps/web/app/**/*.tsx'                              # layout.tsx, app/page.tsx only
grep -c "pgTable(" packages/database/src/schema.ts                                 # 13
grep -ci "check (" packages/database/src/migrations/0001_persistence_foundation.sql   # 33
grep -l "@deprecated Import from @poker-range-trainer/domain" src/domain/*.ts | wc -l # 35 of 35
git ls-files | grep -E '\.(c|cc|cpp|h|hpp|rs|go|wasm|swift|m|mm)$'                 # (none)
git grep -n -iE "anthropic|openai|@ai-sdk|langchain|gpt-|claude-|\bllm\b|modelcontextprotocol|\bmcp\b" -- ':!package-lock.json' ':!mobile/package-lock.json'   # (none)
git ls-files | grep -iE "dockerfile|vercel|fly\.toml|render\.yaml|netlify|wrangler|Procfile"   # (none)
for m in next express react drizzle-orm pg argon2 zod vitest typescript; do node -p "require('./node_modules/$m/package.json').version"; done

gh repo view 8C9D/poker-range-trainer --json visibility,description,homepageUrl,licenseInfo,defaultBranchRef,pushedAt
gh api repos/8C9D/poker-range-trainer --jq '{has_pages, created_at, license: .license.spdx_id}'
gh run list -R 8C9D/poker-range-trainer -L 8 --json databaseId,name,status,conclusion,headSha,createdAt
for u in https://poker-range-trainer.dev/ https://8c9d.github.io/poker-range-trainer/ https://github.com/8C9D/poker-range-trainer; do curl -sI -o /dev/null -w "%{http_code}\n" --max-time 15 "$u"; done   # 000, 404, 404

# cleanup commit d53c545 (2026-09-05) and the local gate run on it
git show --stat --format='%h %s' d53c545          # 14 files: 6 deleted, 8 modified
npm run lint                                      # clean (root eslint + mobile eslint)
npm run test:run                                  # root vitest 1251 passed; 6 web timeouts under load 31 →
cd apps/web && npx vitest run components/<f>.test.tsx   #   each of the 5 files passes alone
npm --workspace @poker-range-trainer/api run test # 114 passed
npm --prefix mobile run test:run -- --runInBand   # 246 passed
npm run build                                     # ok incl. shared-package runtime smoke + mobile typecheck
docker compose up -d && DATABASE_URL=postgresql://poker_range_trainer:poker_range_trainer_local@localhost:54329/poker_range_trainer npm run test:integration   # 5 + 32 passed
```

Key files: `apps/api/src/app.ts` (Express composition), `apps/api/src/practice/repository.ts` + `scoring.ts` (transactional idempotent drill recording), `apps/api/src/auth/{tokens,cookies,middleware,password}.ts` (sessions/CSRF/Argon2id), `apps/api/src/imports/{service,repository}.ts` (legacy import), `packages/database/src/migrations/0001_persistence_foundation.sql` + `migrator.ts` (schema), `packages/domain/src/domain/{spacedRepetition,freePractice,edgeHands,weaknessDrill}.ts` (what to drill), `packages/contracts/src/practice.ts` (modes/contracts), `apps/web/lib/{api-client,drill}.ts` + `apps/web/next.config.ts` (client/proxy), `scripts/verify-shared-package-runtime.ts` + `.github/workflows/ci.yml` (gate), `docs/architecture/rebuild-status.md` (source of truth for what exists).
