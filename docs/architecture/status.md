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
| PostgreSQL schema + migrations (0001–0004), seed, migrator with advisory lock | `packages/database` | Owner-scoped tables, check constraints, partial unique indexes for imported ids and session fingerprints. |
| Express foundation | `apps/api/src/app.ts` | Request ids, pino logging with redaction, helmet (the production CSP included), CORS allowlist, rate limits, 1 MiB JSON limit (larger only on `/api/v1/imports`), problem+json errors, health/readiness. With `WEB_DIST_DIR` set it also serves the built web bundle: immutable hashed assets and an `index.html` fallback for page URLs, mounted after the API routes so unknown `/api` paths keep their problem+json 404 ([ADR 0002](../adr/0002-vite-react-spa-served-by-express.md)). |
| Auth | `apps/api/src/auth` | Argon2 password hashing, server-side revocable sessions, HTTP-only cookie + double-submit CSRF, auth-specific rate limiter, session touch. |
| Ranges | `apps/api/src/ranges` | CRUD, list with search/filters/sorts/pagination, archive/favorite/restore/duplicate, atomic bulk mutations, optimistic versions. |
| Practice sessions | `apps/api/src/practice` | Server-side scoring from the saved range, one transaction per submission, idempotent replay ledger. |
| Practice read models | `apps/api/src/practice` | Per-range read, Today, Progress; computed with the domain functions over a library snapshot; time-zone aware via `zonedCalendarDays`. |
| Settings | `apps/api/src/settings` | Training goal (any bounded positive integer) and an explicit practice-stats reset. |
| Backup import/export | `apps/api/src/imports` | Preview (digest, counts, preservation warnings, conflicts), atomic commit with `merge`/`replace`, audit row, unsupported fields kept in `legacy_payload`, export as a version 1 file. |
| Web app | `apps/web` | Vite + React 19 single-page app on React Router 7 ([ADR 0002](../adr/0002-vite-react-spa-served-by-express.md)); every URL is a row in `src/routes.tsx`. Register/login, authenticated shell, range library and editor, `/app/practice` with six drill modes and idempotent saving, Today, Progress (with drill hand-offs), and Account (goal, backup export/import with preview, stats reset). |
| Browser end-to-end tests | `apps/e2e` | Playwright against the production shape: the compiled API serving the built bundle with `NODE_ENV=production`, behind TLS, on a database made by the compiled migrate and seed commands. Chromium runs everything, including axe WCAG 2.1 AA scans of every page; Firefox, WebKit, and a phone viewport run the core journeys. `npm run test:e2e` (needs `DATABASE_URL` on a server it may create a database on) and `.github/workflows/e2e.yml`. |
| Production image | `Dockerfile`, `scripts/smoke-image.sh`, [deployment.md](../deployment.md) | Non-root, health-checked, 37 MB of runtime dependencies. CI builds it on every push and proves migrate, seed, serve, register, and a clean SIGTERM (`.github/workflows/image.yml`). |

## Not built yet

- A hosted deployment. Nothing is running anywhere: no host is chosen, so there is
  no platform config, TLS proxy, or scheduled database backup yet.
  [deployment.md](../deployment.md) says what a host must provide.
- Account self-service: password change and reset, email verification, account
  deletion. A user who forgets a password has no way back in, and reset needs an
  email provider.
- An API-backed mobile client. The iOS app in `mobile/` reads and writes
  on-device storage only.
- Offline-first synchronization (explicitly out of scope in the architecture
  document).

## Known limitations

- Today and Progress read the trailing 65 days of sessions, merged into quarter
  hours and capped at 100,000 rows, and read further back only for a streak that
  reaches the window's edge. An import built to sit entirely inside the window
  makes those reads take about two seconds; nothing a person could play comes
  close. There are no per-account quotas on ranges, sessions, or imports beyond
  the 64 MiB, 10,000-range limits on one backup file.
- A drill is scored against the range as it stands when the drill is submitted. If
  the chart is edited in another tab mid-drill, the on-screen feedback came from
  the old chart and the recorded result from the new one. Refusing the submission
  would throw away the drill, and scoring the old chart needs a history of charts.
- `replace` imports soft-delete the previous library (and release their imported
  ids); the rows remain for recovery but there is no UI to restore them. The same
  backup file can be replaced from again, which is how a library is restored;
  merging a file a second time is refused because it could only add nothing.
- Rate limits live in the process, so several instances multiply them.
- Near the 64 MiB limit, a backup import takes minutes in one transaction.
- Imported sessions carry no mode and no per-question attempts, so they count
  toward totals, streaks, and stats but not toward per-hand accuracy (which the
  backup supplies separately as cumulative records).
