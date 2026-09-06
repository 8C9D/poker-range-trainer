# Poker Range Trainer

A trainer for Texas Hold'em preflop starting-hand ranges: build a range on the
13×13 grid, drill yourself on it, and let spaced repetition and progress analytics
tell you what to practise next.

The product is a web application backed by an API and a relational database. It
is the multi-user rebuild of an earlier local-only app; that earlier
implementation still lives in this repo (see [Legacy apps](#legacy-apps)) and its
backup files import into the new one.

## Architecture

| Part | Path | Role |
|------|------|------|
| Web app | `apps/web` | Vite + React 19 single-page app on React Router. An explicit route table, accessible UI, and an API client. Talks to the API only through same-origin `/api/v1` calls: the Vite dev server proxies them to Express, and in production Express serves the built bundle itself. Never touches the database. |
| API | `apps/api` | Express 5. The single authority for authentication (email + password, Argon2, HTTP-only session cookie with a double-submit CSRF token), authorization, validation, use cases, and PostgreSQL transactions. Structured JSON logging, rate limits, security headers, RFC 9457 problem responses. |
| Database | PostgreSQL 16 | System of record. Schema and SQL migrations live in `packages/database`. |
| Domain | `packages/domain` | Framework-neutral poker logic: hand matrix, range math, drill scoring, spaced repetition, streaks, leaks, and analytics. Shared by the API and the web app. |
| Contracts | `packages/contracts` | Zod schemas for every request, response, and the legacy backup file. Both apps validate against them. |
| Database package | `packages/database` | Drizzle schema, migrations, migrator, seed, and connection helpers. |

The design is written up in
[`docs/architecture/target-architecture.md`](docs/architecture/target-architecture.md),
[`docs/architecture/data-and-migration.md`](docs/architecture/data-and-migration.md),
[`docs/adr/0001-postgresql-over-nosql.md`](docs/adr/0001-postgresql-over-nosql.md), and
[`docs/adr/0002-vite-react-spa-served-by-express.md`](docs/adr/0002-vite-react-spa-served-by-express.md).
[`docs/architecture/rebuild-status.md`](docs/architecture/rebuild-status.md) records
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
- **Backup** — export the library as the v1 JSON backup file the legacy app
  reads; import a legacy backup after a preview, atomically, with merge or
  replace semantics.
- **Settings** — daily hands goal and an explicit practice-stats reset.

## Getting started

Requirements: Node.js 24.15 or later, npm 11.12.1, and Docker (for PostgreSQL).

```bash
npm ci                     # root workspaces: apps/* and packages/*
npm ci --prefix mobile     # only if you also want to run the legacy iOS app
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
use **Account → Import legacy backup** with `screenshots/seed-backup.json`, a
realistic legacy fixture.

To run the production shape locally, build everything and point the API at the
web bundle; one process then serves both the app and `/api`:

```bash
npm run build
WEB_DIST_DIR=apps/web/dist npm run start:api   # http://localhost:3001
```

## Scripts

Run these from the repo root.

| Command | What it does |
|---------|--------------|
| `npm run dev:web` / `npm run dev:api` | Development servers (packages are built first). |
| `npm run lint` | ESLint over the workspaces and the legacy mobile app. |
| `npm run test:run` | Unit suites: packages (Vitest), web (Vitest + Testing Library), API (Vitest + supertest), mobile (Jest). |
| `npm run test:integration` | Database and API tests against a real PostgreSQL (`DATABASE_URL` required; each file creates and drops its own database). |
| `npm run build` | Builds packages, the web bundle, and the API; runs the compiled-package smoke test and the API runtime smoke (which serves the bundle); type-checks the legacy apps. |
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
docs/             Architecture, ADRs, rebuild status, the legacy iOS app's privacy and support pages
compose.yaml      Local PostgreSQL
src/, mobile/     Legacy local-only apps (see below)
archived/         Features cut from the legacy v1, fenced from every toolchain
```

Tests live beside the code they cover; API HTTP tests live in `apps/api/test`.

## Legacy apps

`src/` (React) and `mobile/` (Expo, iOS) are the original local-only
implementation, kept as the migration source: their JSON backup is what the new
app imports. The `src/` web shell (its Vite entry point) has been removed, so
`src/` is no longer runnable on its own; it remains the shared code the mobile
app builds against. `mobile/` reaches `src/` through the `@core/*` alias and the
`mobile/coresrc` symlink. Everything they persist lives in `localStorage` keys
named `poker-range-trainer.<slice>.v1` with no migration machinery; see
[`CLAUDE.md`](CLAUDE.md) for the storage-versioning rule before touching a stored
shape.

## Documentation

- [`docs/architecture/`](docs/architecture/) — target architecture, data model and import design, rebuild status.
- [`docs/adr/`](docs/adr/) — architecture decision records.
- [`CLAUDE.md`](CLAUDE.md) — workflow rules and the validation gate.
