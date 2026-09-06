# Claude Code Instructions

## Project

A trainer for Texas Hold'em preflop starting-hand ranges, delivered as a
multi-user web product. One npm-workspaces monorepo:

- `apps/web` — Vite + React 19 single-page app on React Router (the product).
  Every URL is a row in `apps/web/src/routes.tsx`. Talks to the API only through
  `apps/web/src/lib/api-client.ts` and the shared contracts; never touches the
  database and never duplicates authorization or business rules. In production
  the API serves its built bundle (`WEB_DIST_DIR`); in development the Vite dev
  server proxies `/api` to Express.
- `apps/api` — Express 5 API. The single authority for auth, validation, use
  cases, and PostgreSQL transactions. Routers take a service port and middleware;
  repositories own SQL; every response is parsed through its contract schema.
- `packages/domain` — pure poker logic and analytics (no framework, no I/O).
  Both apps reuse it; the API never re-implements analytics in SQL.
- `packages/contracts` — Zod schemas for every request/response and the version 1
  JSON backup file. `packages/database` — Drizzle schema, SQL migrations, seed.
- `mobile/` — an iOS client that stores its data on the device. `src/` — the
  TypeScript core it imports through `@core`, plus React components that no build
  target uses. `archived/` — fourteen trimmed features, fenced out of every
  toolchain; `archived/RESTORE.md` says how to hook one back up.

Design docs: `docs/architecture/architecture.md`,
`docs/architecture/data-and-import.md`, `docs/adr/`. The build ledger is
`docs/architecture/status.md`; read it for what exists and what does not
rather than restating it here.

## Workflow rules

- Work directly on main.
- Keep each change small, focused, and reversible.
- Push to the tracked remote after every commit (standing user authorization).
- Commit only after a completed slice passes validation.
- Do not add payments, solver imports, postflop boards, mixed frequencies, sharing,
  or AI features unless explicitly requested.
- Explain assumptions before making large design decisions.
- Report failures honestly. Do not claim tests passed unless they actually ran and passed.

## Technical preferences

- Keep poker-domain logic in `packages/domain`, separate from UI and HTTP code,
  and add or update its tests.
- Change an API contract in `packages/contracts` first; both apps validate against it.
- Schema changes are new numbered SQL files in `packages/database/src/migrations`
  plus the matching Drizzle schema edit; never edit an applied migration.
- The API owns ownership checks: every query is scoped by `user_id`, and a
  missing or foreign resource is the same 404.
- Web data loading happens in effects through promise callbacks (the
  `react-hooks/set-state-in-effect` rule is enforced); plain CSS in
  `apps/web/src/globals.css`, no CSS frameworks.

## iOS client and shared core (`mobile/`, `src/`)

- Mobile reaches `src/` through the `@core/*` alias; Metro resolves it through the
  `mobile/coresrc` symlink, so do not delete that link.
- Only the modules mobile imports through `@core` reach the iOS app; edits to the
  React components in `src/` do not.
- All persisted state lives in nine `localStorage` keys named
  `poker-range-trainer.<slice>.v1` (MMKV shim on mobile). There is no migration
  machinery: every loader re-validates on read and SILENTLY DROPS records that do
  not match. Never change a stored shape under an existing key; an incompatible
  change is a SUFFIX BUMP (`.v1` -> `.v2`) with a one-time forward transform, plus
  a `BACKUP_VERSION` bump in `src/storage/backup.ts`. Purely additive OPTIONAL
  fields may stay on the same key. Three guard tests classify every key
  (`src/storage/backup.test.ts`, `src/storage/statsReset.test.ts`,
  `mobile/__tests__/storage-parity.test.ts`).
- The version 1 backup format is also what the API imports and exports, so a
  change to it must be mirrored in `packages/contracts/src/legacy-backup.ts`.

## Validation

After code changes, run these from the repo root (never from `mobile/`, whose
same-named scripts run the mobile-only variants):

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run test:integration` — needs PostgreSQL (`docker compose up -d`) and
  `DATABASE_URL=postgresql://poker_range_trainer:poker_range_trainer_local@localhost:54329/poker_range_trainer`

If any command fails, diagnose and fix the root cause before committing.
