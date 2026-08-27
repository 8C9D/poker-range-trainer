# Claude Code Instructions

## Project

Two apps in one repo, sharing one domain core, for drilling Texas Hold'em preflop starting-hand ranges.

- `mobile/` is the Expo / expo-router iOS app, and it is the product being launched to the App Store.
- `src/` is the React + TypeScript + Vite web app; since the v1 launch decision it is a development surface and the home of the shared `@core` code, not a deployed product.
- Mobile reaches `src/` through the `@core/*` alias; Metro resolves it through the `mobile/coresrc` symlink, so do not delete that link.
- Everything is on-device. No accounts, no backend.
- The single network feature is Sentry crash reporting on iOS, gated on `EXPO_PUBLIC_SENTRY_DSN` and inert when unset.
- `archived/` holds the 13 features cut from v1, fenced from typecheck, lint, tests, Metro, and EAS; see `TRIM-REPORT.md` and `archived/RESTORE.md`.

## Status

`LAUNCH-CHECKLIST.md` is the live progress ledger; `PROD-READINESS.md` and `reviews/` hold nine rounds of adversarial review.
Read the checklist for build state, submission blockers, and what still has to run rather than restating any of it here — a copy in this file goes stale, and the checklist wins.

## Workflow rules

- Work directly on main.
- Keep each change small, focused, and reversible.
- Push to the tracked remote after every commit (standing user authorization).
- Commit only after a completed slice passes validation.
- Do not add accounts, backend, payments, solver imports, postflop boards, mixed frequencies, or AI features unless explicitly requested.
- Explain assumptions before making large design decisions.
- Report failures honestly. Do not claim tests passed unless they actually ran and passed.

## Technical preferences

- Keep poker-domain logic separate from UI components.
- Add or update tests for core domain logic.
- Web UI fixes do not reach mobile; only `@core` propagates, so sweep `mobile/` for the mirror after hardening a web screen.

## Storage versioning

- All persisted state lives in nine `localStorage` keys named `poker-range-trainer.<slice>.v1` (backed by MMKV through a shim on mobile).
- There is no migration machinery.
  Every loader re-validates on read and SILENTLY DROPS records that do not match its expected shape.
- Because of that, never change a stored shape under an existing key: every device that already has data would silently lose that store on its next read.
- The rule for an incompatible shape change is a SUFFIX BUMP, not an in-place migration: create the new key (`.v1` -> `.v2`), have the new module's loader read the old key once, transform forward, write the new key, and leave the old key in place as a recovery net.
  Also bump `BACKUP_VERSION` in `src/storage/backup.ts` and teach `validateBackup` to accept the old file shape, so backups written before the change still import.
- Purely additive OPTIONAL fields (absence means "feature never used") may stay on the same key; that is how every overlay field and `spotAccuracy`/`trainingGoal` were added.
- Three guards classify every key, so adding or renaming one fails tests until it is accounted for: backup coverage (`src/storage/backup.test.ts`), reset coverage (`src/storage/statsReset.test.ts`), and verbatim web/mobile key parity (`mobile/__tests__/storage-parity.test.ts`).

## Validation

After code changes, run these commands from the repo root:

- npm run lint
- npm run test:run
- npm run build

Run them from the repo root, never from `mobile/`: the root scripts drive both apps, and the same-named scripts inside `mobile/` run the mobile-only variants instead.

If any command fails, diagnose and fix the root cause before committing.
