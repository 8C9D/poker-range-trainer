# Claude Code Instructions

## Project

A trainer for Texas Hold'em preflop starting-hand ranges, being rebuilt from a
local-only app into a multi-user web product. One npm-workspaces monorepo:

- `apps/web` — Next.js 16 web app (the product). Talks to the API only through
  `apps/web/lib/api-client.ts` and the shared contracts; never touches the database
  and never duplicates authorization or business rules.
- `apps/api` — Express 5 API. The single authority for auth, validation, use
  cases, and PostgreSQL transactions. Routers take a service port and middleware;
  repositories own SQL; every response is parsed through its contract schema.
- `packages/domain` — pure poker logic and analytics (no framework, no I/O).
  Both apps reuse it; the API never re-implements analytics in SQL.
- `packages/contracts` — Zod schemas for every request/response and the legacy
  backup file. `packages/database` — Drizzle schema, SQL migrations, seed.
- `src/` and `mobile/` — the LEGACY local-only web and iOS apps, kept intact as
  the migration source (their JSON backup imports into the new app). `archived/`
  holds features cut from the legacy v1, fenced from every toolchain.

Design docs: `docs/architecture/target-architecture.md`,
`docs/architecture/data-and-migration.md`, `docs/adr/`. The rebuild ledger is
`docs/architecture/rebuild-status.md`; read it for what exists and what does not
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
  `apps/web/app/globals.css`, no CSS frameworks.

## Legacy apps (`src/`, `mobile/`)

- Mobile reaches `src/` through the `@core/*` alias; Metro resolves it through the
  `mobile/coresrc` symlink, so do not delete that link.
- Web UI fixes in `src/` do not reach mobile; only `@core` propagates.
- All persisted state lives in nine `localStorage` keys named
  `poker-range-trainer.<slice>.v1` (MMKV shim on mobile). There is no migration
  machinery: every loader re-validates on read and SILENTLY DROPS records that do
  not match. Never change a stored shape under an existing key; an incompatible
  change is a SUFFIX BUMP (`.v1` -> `.v2`) with a one-time forward transform, plus
  a `BACKUP_VERSION` bump in `src/storage/backup.ts`. Purely additive OPTIONAL
  fields may stay on the same key. Three guard tests classify every key
  (`src/storage/backup.test.ts`, `src/storage/statsReset.test.ts`,
  `mobile/__tests__/storage-parity.test.ts`).
- The legacy backup format (version 1) is also what the API imports and exports,
  so a change to it must be mirrored in `packages/contracts/src/legacy-backup.ts`.

## Validation

After code changes, run these from the repo root (never from `mobile/`, whose
same-named scripts run the mobile-only variants):

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run test:integration` — needs PostgreSQL (`docker compose up -d`) and
  `DATABASE_URL=postgresql://poker_range_trainer:poker_range_trainer_local@localhost:54329/poker_range_trainer`

If any command fails, diagnose and fix the root cause before committing.
