# Claude Code Instructions

## Project

This is a poker range trainer web app.

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

After code changes, run these commands:

- npm run lint
- npm run test:run
- npm run build

If any command fails, diagnose and fix the root cause before committing.
