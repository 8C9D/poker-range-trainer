# Claude Code Instructions

## Project

Two apps in one repo, sharing one domain core, for drilling Texas Hold'em preflop starting-hand ranges.

- `mobile/` is the Expo SDK 56 / React Native 0.85 iOS app (expo-router), and it is the product being launched to the App Store.
- `src/` is the React 19 + TypeScript + Vite 8 web app; since the v1 launch decision it is a development surface and the home of the shared `@core` code, not a deployed product.
- Mobile reaches `src/` through the `@core/*` alias; Metro resolves it through the `mobile/coresrc` symlink, so do not delete that link.
- Everything is on-device: nine `localStorage` keys on web, the same keys through an MMKV shim on iOS. No accounts, no backend.
- The single network feature is Sentry crash reporting on iOS, gated on `EXPO_PUBLIC_SENTRY_DSN` and inert when unset.
- `archived/` holds the 13 features cut from v1, fenced from typecheck, lint, tests, Metro, and EAS; see `TRIM-REPORT.md` and `archived/RESTORE.md`.

## Status (2026-08-15)

- v1 is feature-complete and the launch infrastructure is provisioned; `LAUNCH-CHECKLIST.md` is the live progress ledger and `PROD-READINESS.md` plus `reviews/` hold nine rounds of adversarial review.
- Build 1.0.0 (3) is uploaded to App Store Connect and Ready to Submit in TestFlight; `mobile/app.json` carries buildNumber 5.
- Submission is blocked on two user-owned items, not on code: the anonymity gate (the Apple membership must convert from Individual to Organization before any submit) and, for paid distribution, a CRA Business Number for the GST/HST form.
- The real-device TestFlight pass has never run; every test to date has run under jsdom or Jest.

## Workflow rules

- Work directly on main.
- Keep each change small, focused, and reversible.
- Push to the tracked remote after every commit (standing user authorization).
- Commit only after a completed slice passes validation.
- Do not add accounts, backend, payments, solver imports, postflop boards, mixed frequencies, or AI features unless explicitly requested.
- Prefer simple, maintainable code over over-engineering.
- Explain assumptions before making large design decisions.
- Report failures honestly. Do not claim tests passed unless they actually ran and passed.

## Technical preferences

- Keep poker-domain logic separate from UI components.
- Put reusable poker logic under src/domain/.
- Put storage logic under src/storage/.
- Put shared types under src/types/.
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
The same three commands run in CI on every push and pull request (`.github/workflows/ci.yml`).
Last verified green 2026-08-18 at `3b0599c`: web 79 files / 1187 tests, mobile 39 suites / 244 tests.

If any command fails, diagnose and fix the root cause before committing.
