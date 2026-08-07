# Poker Range Trainer

A local-only trainer for Texas Hold'em preflop starting-hand ranges: build a range
on a standard 13×13 grid, then drill yourself on it until you know it cold.

The repo holds two apps sharing one domain core:

- **`mobile/`** — the native iOS app (Expo / React Native), the product being
  launched to the App Store. It reuses the web app's domain, storage, and type
  modules via the `@core/*` alias.
- **`src/`** — the React + TypeScript + Vite web app. Since the v1 launch decision
  it is a development surface and the home of the shared `@core` code, not a
  deployed product.

Everything is stored on-device (browser `localStorage` on web, MMKV behind a
`localStorage` shim on iOS). There are no accounts and no backend. The one network
feature is optional crash reporting on iOS (Sentry), enabled only when
`EXPO_PUBLIC_SENTRY_DSN` is set at build time and completely inert otherwise.

## Features (shipped v1)

- **Range editor** — 13×13 grid with click/tap-to-toggle, drag-to-paint, and (web)
  arrow-key navigation as a single tab stop; range shortcut buttons (pairs, 77+,
  broadways); live hand count, combo count, and percentage; live save.
- **Scenario metadata** — optional game type, table size, stack depth, position,
  versus position, action type, and notes per range, offered straight out of a
  recognizable range name ("SB 3-bet vs BTN open (6-max 100bb)").
- **Range library** — saved ranges as rows with search (by name, hand — type "a5s"
  to find every chart that plays it — or scenario notes), filters (position /
  action / stack depth / game type), four sorts, favorite, archive, duplicate,
  multi-select with a bulk practice queue and bulk actions, and an in-memory
  **Undo** for deletes that restores the practice record too.
- **Practice drills** — recognition (in/out with immediate feedback), build-from-
  memory, timed, weakness-weighted, and a range-edge drill; swipe-to-answer with
  haptics on iOS; every miss is explained and held on screen until you continue.
- **Practice recording** — each finished session writes per-range stats, per-hand
  accuracy, session history, and the spaced-repetition schedule.
- **Spaced repetition & goals** — a due-for-review queue and streak on Today, a
  caught-up next-step suggestion, and an optional daily hands goal with week tiles.
- **Progress analytics** — weekly hands and accuracy, an accuracy-by-week trend,
  leaks by hand type, a which-way-you-miss read (with per-seat leans), and a
  weakest-hands table — each one tap from a targeted drill.
- **JSON backup** — export the whole library (ranges, stats, history, schedules,
  goal) as one file and restore it, on both apps; the only way data moves between
  devices, and validated before it replaces anything.
- **Reset practice stats** — a clean slate that keeps the charts.
- **Crash reporting (iOS only, optional)** — Sentry, gated on
  `EXPO_PUBLIC_SENTRY_DSN`; no session replay, screenshots, or view hierarchies.

Thirteen features from the pre-launch build (cloud sync and accounts among them)
are archived, not deleted: see [`TRIM-REPORT.md`](TRIM-REPORT.md) for what and why,
and [`archived/RESTORE.md`](archived/RESTORE.md) for how each one comes back. The
`archived/` tree is fenced off from typecheck, lint, tests, Metro, and EAS.

## Getting started

Requires Node.js and npm.

```bash
npm install                # web deps (first time only)
npm install --prefix mobile  # mobile deps (first time only)
npm run dev                # start the Vite dev server (default http://localhost:5173)
```

For the iOS app, see [`docs/ios-roadmap.md`](docs/ios-roadmap.md) and run from
`mobile/` with `npm run ios` (Expo). No environment variables are required for
either app; `.env.example` documents the single optional one (the Sentry DSN).

## Scripts

Run these from the repo root — the root scripts drive both apps, and running the
same names from `mobile/` runs the mobile-only variants instead.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Type-check + build the web bundle, then type-check the mobile app. |
| `npm run preview` | Serve the production web build locally. |
| `npm run lint` | ESLint over both apps. |
| `npm run test` | Vitest (web) in watch mode. |
| `npm run test:run` | The web (Vitest) and mobile (Jest) suites once, CI-style. |

The same three commands (`lint`, `test:run`, `build`) run in CI on every push and
pull request (`.github/workflows/ci.yml`), and are the local validation gate before
any commit.

## Project structure

```text
src/
  App.tsx        Top-level routed app shell.
  app/           App shell, hash routing, id minting, session-recording helpers.
  screens/       The routed screens (Today, Library, the per-range page, Progress, Account).
  practice/      Full-screen practice overlay (mode picker, drills, session summary).
  components/    Shared UI (hand grid, editors, error boundary, performance views).
  domain/        Pure poker logic (hand generation, range math, practice scoring, spaced repetition, ...).
  storage/       localStorage persistence (ranges, practice stats, accuracy, history, review state, backup).
  types/         Shared TypeScript types (range.ts, practice.ts).
mobile/          The Expo (React Native) iOS app — its own package, reusing src/ via the @core alias.
archived/        The 13+1 archived features, fenced from every toolchain; see archived/RESTORE.md.
docs/            Roadmaps, the manual testing guide, store listing and privacy policy drafts.
supabase/        SQL migrations for the retired cloud backend, kept as the reference for
                 verifying/retiring the live project (LAUNCH-CHECKLIST.md, step 1).
```

Tests live beside the code they cover (e.g. `domain/practice.ts` /
`domain/practice.test.ts`); mobile tests live in `mobile/__tests__/`.

## Data & persistence

All data lives on-device under nine keys prefixed with `poker-range-trainer.`
(ranges, practice stats, per-hand / per-action / per-spot accuracy, session
history, review state, training goal, workout flag). There is no migration
machinery — see the storage-versioning rule in [`CLAUDE.md`](CLAUDE.md) before
changing any stored shape. The JSON backup carries every key except the day-scoped
workout flag; clearing site data (web) or uninstalling (iOS) without a backup
loses local data. Keys and reset instructions are in the
[manual testing guide](docs/manual-testing-guide.md#2-managing-test-state-important).

## Testing

Web: Vitest with Testing Library. Mobile: Jest (jest-expo) with RNTL, run
`--runInBand`. `npm run test:run` from the repo root runs both.

## Documentation

- [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) — the iOS App Store launch checklist.
- [`TRIM-REPORT.md`](TRIM-REPORT.md) / [`archived/RESTORE.md`](archived/RESTORE.md) — the v1 scope trim and how to restore archived features.
- [`docs/manual-testing-guide.md`](docs/manual-testing-guide.md) — current feature list and a manual test checklist.
- [`docs/roadmap.md`](docs/roadmap.md) / [`docs/ios-roadmap.md`](docs/ios-roadmap.md) — the product roadmaps (forward-looking plans).
- [`CLAUDE.md`](CLAUDE.md) — workflow rules, storage-versioning rule, and validation gate.
