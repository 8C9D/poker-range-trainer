# Poker Range Trainer

A client-only web app for creating, saving, editing, and practicing Texas
Hold'em preflop ranges on a standard 13×13 starting-hand grid. It runs entirely
in the browser and persists to `localStorage` — there is no backend, account, or
network dependency.

Built with React, TypeScript, and Vite. Poker-domain logic is kept separate from
the UI (see [Project structure](#project-structure)).

## Features

The app is implemented through roadmap version **v2.3**. At a glance:

- **Range editor (v1–v1.3)** — 13×13 grid with click-to-toggle and drag-to-paint
  selection, range shortcut buttons, live combo count and percentage, range
  notation import/export (e.g. `22+, A2s+, ATo+`), and optional scenario
  metadata (game type, table size, stack depth, position, action type, notes).
- **Range library (v1.4)** — saved ranges as cards with search, filtering
  (position / action / stack depth / game type), sorting, favorite, archive, and
  duplicate.
- **Practice modes (v2, v2.3)** — recognize-hands (in/out) with a missing-hands
  review, build-from-memory, timed drill, weakness-focused drill, and a
  "pick the correct action" quiz for ranges that have an action chart.
- **Mistake tracking (v2.1)** — per-hand accuracy, an accuracy heatmap, a
  weakest-hands performance view, "practice mistakes only", and session history.
- **Spaced repetition (v2.2)** — a "due for review" queue and a review streak,
  with each session advancing the range's review schedule by accuracy.
- **Multi-action ranges (v2.3)** — assign an action (fold/call/raise/3-bet/
  4-bet/jam/mixed) per hand on a multi-color grid, see per-action percentages,
  and import/export action-grouped notation.

For a complete, current feature-by-feature description — including what each
practice mode records — see the
[manual testing guide](docs/manual-testing-guide.md).

Not yet implemented (on the roadmap): accounts, cloud sync, and a backend (v3);
mobile/PWA support (v3.1); file/link/pack-based sharing (v3.2); postflop and
combo-level features (v4+). See [`docs/roadmap.md`](docs/roadmap.md).

## Getting started

Requires Node.js and npm.

```bash
npm install      # first time only
npm run dev      # start the Vite dev server (default http://localhost:5173)
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Type-check (`tsc -b`) and build the production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint over the project. |
| `npm run test` | Run Vitest in watch mode. |
| `npm run test:run` | Run the Vitest suite once (CI-style). |

After code changes, the project convention is to run `npm run lint`,
`npm run test:run`, and `npm run build` and fix any failures before committing.

## Project structure

```text
src/
  App.tsx        Top-level app: wires the editor, library, practice, and views together.
  components/    React UI (hand grid, range library, practice modes, editors, notation, performance views).
  domain/        Pure poker logic (hand generation, range math, notation, practice scoring, spaced repetition, ...).
  storage/       localStorage persistence (ranges, practice stats, hand/action accuracy, session history, review state).
  types/         Shared TypeScript types (range.ts, practice.ts).
  test/          Vitest setup.
docs/            Roadmap, manual testing guide, acceptance reviews, and the docs-sync report.
```

Tests live beside the code they cover (e.g. `domain/practice.ts` /
`domain/practice.test.ts`).

## Data & persistence

All data is stored in the browser's `localStorage` under keys prefixed with
`poker-range-trainer.` (saved ranges, practice stats, per-hand and per-action
accuracy, session history, and review state). Clearing site data or switching
browsers/devices loses everything — there is no sync or backup yet. The keys and
how to reset them are documented in the
[manual testing guide](docs/manual-testing-guide.md#2-managing-test-state-important).

## Testing

Core domain and storage logic is covered by Vitest, with component tests via
Testing Library. Run the suite with `npm run test:run`.

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) — product vision and the full version roadmap.
- [`docs/manual-testing-guide.md`](docs/manual-testing-guide.md) — current feature list and a manual test checklist.
- [`CLAUDE.md`](CLAUDE.md) — workflow rules and technical conventions for contributors (and AI agents).
