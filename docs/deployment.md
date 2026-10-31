# Deployment

The product ships as one container: a Node process serving the API and the built
web app on one origin, in front of PostgreSQL 16. No hosting target is chosen yet,
so this describes what any host must provide. The image is built and exercised in
CI on every push (`.github/workflows/image.yml`, `scripts/smoke-image.sh`).

## Build

```bash
docker build -t poker-range-trainer .
```

The image runs as the non-root `node` user, listens on `PORT` (3001), declares a
health check against `/api/v1/health/ready`, and starts Node directly so it receives
SIGTERM. Its database commands are compiled, so no development tooling is needed.

## What the host must provide

- **PostgreSQL 16** with a role that can create tables, reachable through
  `DATABASE_URL`. Encrypt the connection where the host supports it, by adding
  `sslmode=require` to the URL.
- **A TLS-terminating proxy or load balancer.** The app sets `Secure` cookies and
  `upgrade-insecure-requests` in production, so it must be reached over HTTPS. The
  proxy must set `X-Forwarded-For` and `X-Forwarded-Proto`.
- **Secret storage** for `DATABASE_URL`. There are no other secrets: session and
  CSRF tokens are random per session, and only their hashes are stored.

## Configuration

The process validates its environment at startup and refuses to start on a bad
value. These are required in production:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL. |
| `API_ORIGINS` | Comma-separated exact `https://` origins allowed to call the API. Use the public origin of the app. Wildcards are refused. |
| `TRUST_PROXY` | How many proxies stand in front of the process, usually `1`, or `false` for none. Production refuses `true`, which would believe any client-written `X-Forwarded-For` and let callers choose the address every rate limit keys on. |

`NODE_ENV=production`, `PORT=3001`, and `WEB_DIST_DIR` are set by the image. These
are optional:

| Variable | Default | Meaning |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | Pino level. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | 100 per minute | Per-address limit on `/api`. Health checks and static files are outside it. |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | 10 per 15 minutes | Per-address limit on register and login. |
| `SESSION_TTL_SECONDS` | 7 days | Session lifetime, up to 31 days. |

Rate-limit counters live in the process, so running several instances multiplies
each limit by the instance count.

## Release

Run one release step, then start the new version. Migrations take an advisory lock
and apply each file in its own transaction, so a repeated or concurrent run is safe,
and the seed is idempotent.

```bash
docker run --rm --env DATABASE_URL poker-range-trainer node packages/database/dist/migrate.js
docker run --rm --env DATABASE_URL poker-range-trainer node packages/database/dist/seed.js
docker run --detach --env DATABASE_URL --env API_ORIGINS --env TRUST_PROXY \
  --publish 3001:3001 poker-range-trainer
```

The seed writes the 169 hand classes every range depends on. Without it, saving any
range fails on a foreign key.

To roll back, start the previous image; this relies on keeping each migration
compatible with the version before it. Never edit an applied migration; fix forward
with a new numbered file.

## Health and shutdown

- `GET /api/v1/health/live` answers while the process runs. Point restarts here.
- `GET /api/v1/health/ready` also queries PostgreSQL, and answers 503 while the
  process shuts down. Point traffic routing here.

On SIGTERM the process stops accepting connections and lets requests finish for up
to 8 seconds before cutting them, then closes the pool and exits 0. Give the
platform a stop timeout of at least 10 seconds. A near-limit backup import can run
for minutes, so raise the proxy's request timeout if accounts that large are real.

Logs are JSON on stdout, one line per request, keyed by `requestId`, which is also
returned in the `x-request-id` header and in every problem response. A failure logs
its error name, SQLSTATE, constraint, schema paths, and call frames, never its
message, which can quote query parameters.

## Backups

PostgreSQL is the only state. Take logical backups on a schedule, or use the
host's point-in-time recovery, and keep copies away from the database host:

```bash
pg_dump --dbname "$DATABASE_URL" --format=custom --file "prt-$(date +%F).dump"
```

Restore into an empty database, then run the release step, which applies any
migrations newer than the dump:

```bash
pg_restore --dbname "$DATABASE_URL" --no-owner "prt-2026-10-31.dump"
```

Rehearse a restore before relying on it. Users can also export their own library
from **Account**, but that is a portability feature, not a server backup: it holds
no accounts.

Sessions that expired or were revoked over 30 days ago are purged hourly by the
running process, so no scheduled job is needed.
