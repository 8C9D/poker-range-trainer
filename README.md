# Poker Range Trainer

A trainer for Texas Hold'em preflop starting-hand ranges: build a range on the
13×13 grid, drill yourself on it, and let spaced repetition and progress analytics
tell you what to practise next.

The product is a multi-user web application: a React single-page app served by an
Express API over PostgreSQL, in one npm-workspaces monorepo.

## Architecture

| Part | Path | Role |
|------|------|------|
| Web app | `apps/web` | Vite + React 19 single-page app on React Router. An explicit route table, accessible UI, and an API client. Talks to the API only through same-origin `/api/v1` calls: the Vite dev server proxies them to Express, and in production Express serves the built bundle itself. Never touches the database. |
| API | `apps/api` | Express 5. The single authority for authentication (email + password, Argon2, HTTP-only session cookie with a double-submit CSRF token), authorization, validation, use cases, and PostgreSQL transactions. Structured JSON logging, rate limits, security headers, RFC 9457 problem responses. |
| Database | PostgreSQL 16 | System of record. Schema and SQL migrations live in `packages/database`. |
| Domain | `packages/domain` | Framework-neutral poker logic: hand matrix, range math, drill scoring, spaced repetition, streaks, leaks, and analytics. Shared by the API and the web app. |
| Contracts | `packages/contracts` | Zod schemas for every request, response, and the JSON backup file. Both apps validate against them. |
| Database package | `packages/database` | Drizzle schema, migrations, migrator, seed, and connection helpers. |

The design is written up in
[`docs/architecture/architecture.md`](docs/architecture/architecture.md),
[`docs/architecture/data-and-import.md`](docs/architecture/data-and-import.md),
[`docs/adr/0001-postgresql-over-nosql.md`](docs/adr/0001-postgresql-over-nosql.md), and
[`docs/adr/0002-vite-react-spa-served-by-express.md`](docs/adr/0002-vite-react-spa-served-by-express.md).
[`docs/architecture/status.md`](docs/architecture/status.md) records
what has been built and what has not.

## Features

- **Accounts** — register, sign in, sign out; sessions are server-side and revocable.
- **Range editor** — 13×13 grid with click-to-toggle, drag-to-paint, and keyboard
  navigation; optional scenario metadata (game type, table size, stack depth,
  positions, action, notes); optimistic-version conflict handling.
- **Range library** — search (by name, note, or hand such as `a5s`), filters,
  sorts, pagination, favorite, archive, duplicate, delete with undo, and atomic
  bulk actions.
- **Practice drills** — recognition, timed, weak-spot, range-edge, past-mistakes,
  and build-from-memory modes. The API scores every submission from the saved
  range and records it once, keyed by an idempotency key.
- **Today** — due reviews from the spaced-repetition schedule, streak, daily
  goal, and a suggested free practice when nothing is due.
- **Progress** — hands per day, accuracy by week, leaks by hand class, which way
  you miss (overall and by seat), and the weakest hands, each one click from a
  targeted drill.
- **Backup** — export the whole library as a version 1 JSON file; import one back
  after a preview, atomically, with merge or replace semantics.
- **Settings** — daily hands goal and an explicit practice-stats reset.

## Getting started

Requirements: Node.js 24.15 or later, npm 11.12.1, and Docker (for PostgreSQL).

```bash
npm ci                     # root workspaces: apps/* and packages/*
docker compose up -d       # PostgreSQL 16 on localhost:54329

# Environment: copy the values from .env.example into your shell (there is no
# dotenv loader). At minimum the API needs DATABASE_URL and API_ORIGINS.
export DATABASE_URL=postgresql://poker_range_trainer:poker_range_trainer_local@localhost:54329/poker_range_trainer
export API_ORIGINS=http://localhost:5173

npm run db:migrate         # apply packages/database/src/migrations in order
npm run db:seed            # the 169 canonical hand classes
npm run dev:api            # Express on http://localhost:3001
npm run dev:web            # Vite on http://localhost:5173, proxying /api to 3001
```

Register an account at `http://localhost:5173/register`. To try the import path,
use **Account → Import backup** with `screenshots/seed-backup.json`, a realistic
fixture.

To run the production shape locally, build everything and point the API at the
web bundle; one process then serves both the app and `/api`:

```bash
npm run build
WEB_DIST_DIR=apps/web/dist npm run start:api   # http://localhost:3001
```

The iOS client in `mobile/` has its own dependency tree; install it with
`npm ci --prefix mobile` only if you intend to build or type-check it.

## Scripts

Run these from the repo root.

| Command | What it does |
|---------|--------------|
| `npm run dev:web` / `npm run dev:api` | Development servers (packages are built first). |
| `npm run lint` | ESLint over the workspaces and the iOS app. |
| `npm run test:run` | Unit suites: packages (Vitest), web (Vitest + Testing Library), API (Vitest + supertest), iOS app (Jest). |
| `npm run test:integration` | Database and API tests against a real PostgreSQL (`DATABASE_URL` required; each file creates and drops its own database). |
| `npm run build` | Builds packages, the web bundle, and the API; runs the compiled-package smoke test and the API runtime smoke (which serves the bundle); type-checks the remaining TypeScript projects, the iOS client included. |
| `npm run db:migrate` / `npm run db:seed` | Apply migrations / seed hand classes. |
| `npm run format` / `npm run format:check` | Prettier. |

`lint`, `test:run`, `build`, and `test:integration` run in CI on every push and
pull request (`.github/workflows/ci.yml`), and are the local validation gate
before any commit.

## API overview

All routes are under `/api/v1`. Mutations require the session cookie plus the
`x-csrf-token` header; reads require the session cookie. Successful responses
are `{ data }` (collections add `meta`); failures are `application/problem+json`.

| Area | Routes |
|------|--------|
| Health | `GET /health/live`, `GET /health/ready` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Ranges | `GET\|POST /ranges`, `GET\|PATCH\|DELETE /ranges/:id`, `POST /ranges/:id/{archive,favorite,restore,duplicate}`, `POST /ranges/bulk` |
| Practice | `POST /practice/sessions`, `GET /practice/ranges/:id`, `GET /practice/today?timeZone=`, `GET /practice/progress?timeZone=` |
| Settings | `GET\|PUT /settings/training-goal`, `POST /settings/reset-practice-stats` |
| Backup | `POST /imports/legacy-backup/preview`, `POST /imports/legacy-backup`, `GET /exports/backup` |

## Project structure

```text
apps/
  api/            Express API: auth/, ranges/, practice/, settings/, imports/, app.ts, server.ts
  web/            Vite + React SPA: src/routes.tsx (route table), src/components/, src/lib/ (api-client, drill logic)
packages/
  domain/         Pure poker logic and analytics (no framework, no I/O)
  contracts/      Zod request/response schemas shared by both apps
  database/       Drizzle schema, SQL migrations, migrator, seed, connection
docs/             Architecture, ADRs, implementation status, the iOS app's privacy and support pages
compose.yaml      Local PostgreSQL
mobile/           iOS client (on-device storage)
src/              TypeScript core the iOS client imports, plus React components no build target uses
archived/         Fourteen trimmed features, fenced out of every toolchain (archived/RESTORE.md)
```

Tests live beside the code they cover; API HTTP tests live in `apps/api/test`.

## The iOS client

`mobile/` is an iOS app that stores its data on the device. It reaches `src/`
through the `@core/*` alias, which Metro resolves through the `mobile/coresrc`
symlink, so that link must stay in place. Only what it imports through `@core`
reaches the app: the domain, storage, type, and app-helper modules. The React
components alongside them in `src/` are not part of any build target, so editing
one changes nothing that ships.

Everything the iOS app persists lives in `localStorage`-style keys named
`poker-range-trainer.<slice>.v1` with no migration machinery; see
[`CLAUDE.md`](CLAUDE.md) for the storage-versioning rule before touching a stored
shape. Its JSON backup file is the same version 1 format the web app imports and
exports, so a library moves between them.

`archived/` holds fourteen features trimmed out of the product — postflop tools,
share links, cloud sync, combo tools, per-hand notes, daily workout, range
compare, and others. Every toolchain excludes the directory: typecheck, lint,
tests, Metro, and EAS uploads. [`archived/RESTORE.md`](archived/RESTORE.md)
records what each one moved and how to hook it back up.

## Documentation

- [`docs/architecture/`](docs/architecture/) — architecture, data model and import design, implementation status.
- [`docs/adr/`](docs/adr/) — architecture decision records.
- [`CLAUDE.md`](CLAUDE.md) — workflow rules and the validation gate.
