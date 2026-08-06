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

## Validation

After code changes, run these commands:

- npm run lint
- npm run test:run
- npm run build

If any command fails, diagnose and fix the root cause before committing.
