# Implementation status

The ledger of what is built in the React + Express + PostgreSQL product described
in [architecture.md](architecture.md) and
[data-and-import.md](data-and-import.md). Update it when a slice lands or a
limitation is removed; this file, not the README, is the source of truth for
"what exists".

## Built

| Slice | Where | Notes |
| --- | --- | --- |
| Monorepo, shared packages, compiled-package smoke test | root, `packages/*`, `scripts/` | Domain is a NodeNext package consumed by both apps. |
| PostgreSQL schema + migrations (0001–0003), seed, migrator with advisory lock | `packages/database` | Owner-scoped tables, check constraints, partial unique indexes for imported ids and session fingerprints. |
| Express foundation | `apps/api/src/app.ts` | Request ids, pino logging with redaction, helmet (the production CSP included), CORS allowlist, rate limits, 1 MiB JSON limit (larger only on `/api/v1/imports`), problem+json errors, health/readiness. With `WEB_DIST_DIR` set it also serves the built web bundle: immutable hashed assets and an `index.html` fallback for page URLs, mounted after the API routes so unknown `/api` paths keep their problem+json 404 ([ADR 0002](../adr/0002-vite-react-spa-served-by-express.md)). |
| Auth | `apps/api/src/auth` | Argon2 password hashing, server-side revocable sessions, HTTP-only cookie + double-submit CSRF, auth-specific rate limiter, session touch. |
| Ranges | `apps/api/src/ranges` | CRUD, list with search/filters/sorts/pagination, archive/favorite/restore/duplicate, atomic bulk mutations, optimistic versions. |
| Practice sessions | `apps/api/src/practice` | Server-side scoring from the saved range, one transaction per submission, idempotent replay ledger. |
| Practice read models | `apps/api/src/practice` | Per-range read, Today, Progress; computed with the domain functions over a library snapshot; time-zone aware via `zonedCalendarDays`. |
| Settings | `apps/api/src/settings` | Training goal (any bounded positive integer) and an explicit practice-stats reset. |
| Backup import/export | `apps/api/src/imports` | Preview (digest, counts, preservation warnings, conflicts), atomic commit with `merge`/`replace`, audit row, unsupported fields kept in `legacy_payload`, export as a version 1 file. |
| Web app | `apps/web` | Vite + React 19 single-page app on React Router 7 ([ADR 0002](../adr/0002-vite-react-spa-served-by-express.md)); every URL is a row in `src/routes.tsx`. Register/login, authenticated shell, range library and editor, `/app/practice` with six drill modes and idempotent saving, Today, Progress (with drill hand-offs), and Account (goal, backup export/import with preview, stats reset). |

## Not built yet

- Signed-in browser end-to-end tests (Playwright against the real stack). The
  pages are covered by component tests and the production build; an API-level
  smoke of every route passed on 2026-09-03, but no automated click-through
  exists yet.
- Deployment: no Dockerfile, hosting config, or migration/backup runbook beyond
  the npm scripts.
- An API-backed mobile client. The iOS app in `mobile/` reads and writes
  on-device storage only.
- Offline-first synchronization (explicitly out of scope in the architecture
  document).

## Known limitations

- `readLibrarySnapshot` loads a user's whole session history for Today and
  Progress (the streak needs it). Fine at current sizes; bound it if a heavy
  user appears.
- `replace` imports soft-delete the previous library (and release their imported
  ids); the rows remain for recovery but there is no UI to restore them.
- Imported sessions carry no mode and no per-question attempts, so they count
  toward totals, streaks, and stats but not toward per-hand accuracy (which the
  backup supplies separately as cumulative records).
