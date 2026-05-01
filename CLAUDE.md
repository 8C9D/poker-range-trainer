# Claude Code Instructions

## Project

This is a poker range trainer web app.

The v1 goal is to let users create, save, edit, delete, and practice Texas Hold'em preflop ranges using a standard 13x13 starting-hand grid.

## Workflow rules

- Work directly on main.
- Keep each change small, focused, and reversible.
- Do not push unless explicitly asked.
- Commit only after a completed slice passes validation.
- Do not add accounts, backend, payments, solver imports, postflop boards, mixed frequencies, or AI features unless explicitly requested.
- Prefer simple, maintainable code over over-engineering.
- Explain assumptions before making large design decisions.
- Report failures honestly. Do not claim tests passed unless they actually ran and passed.

## Technical preferences

- Use React, TypeScript, and Vite.
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

## v1 scope

Implement only:

- 13x13 Texas Hold'em starting-hand grid.
- Click-to-toggle hand selection.
- Named range creation.
- Local saved ranges.
- View saved ranges.
- Edit saved ranges.
- Delete saved ranges.
- Practice mode using one saved range.
- Random starting-hand prompts.
- User answers "in range" or "out of range."
- Immediate feedback.
- Current-session stats: total, correct, accuracy.
- Tests for hand generation, combo counting, range percentage, storage behavior, and practice answer correctness.
