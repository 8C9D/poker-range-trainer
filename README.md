# Poker Range Trainer

A web app for creating, saving, editing, and practicing Texas Hold'em ranges on a
standard 13×13 starting-hand grid. It is local-first — it runs entirely in the
browser and persists to `localStorage`, with no account required — and adds
OPTIONAL cloud accounts and sync (via Supabase) when configured. It also installs
as an offline-capable PWA. The repo additionally contains a native iOS app
(`mobile/`, Expo / React Native) that mirrors the web app and reuses the same
domain core (see [`docs/ios-roadmap.md`](docs/ios-roadmap.md)).

Built with React, TypeScript, and Vite. Poker-domain logic is kept separate from
the UI (see [Project structure](#project-structure)).

## Features

The app implements the full roadmap (**v1–v9**). At a glance:

- **Range editor** — 13×13 grid with click-to-toggle, drag-to-paint, and
  arrow-key selection (the grid is one tab stop, not 169), range shortcut
  buttons, live combo count and percentage, range
  notation import/export (e.g. `22+, A2s+, ATo+`), optional scenario metadata
  (game type, table size, stack depth, position, action type, notes), an optional
  source/reference, organization tags, and per-hand notes.
- **Starter ranges** — an empty library fills itself with nine standard 6-max
  100bb charts in one tap, so every drill, spot, and workout works on day one.
  They are ordinary editable ranges, tagged `Starter`.
- **Range library** — saved ranges as cards with search, filtering
  (position / action / stack depth / game type / tag), sorting, favorite, archive, and
  duplicate; each card summarizes combos, scenario, source, hand-notes, and
  practice accuracy.
- **Practice modes** — recognize-hands (in/out) with a missing-hands review,
  build-from-memory, timed drill, weakness-focused drill, an edge drill (only the
  hands on the range boundary), a "pick the correct action" quiz (for action
  charts), and a primary-action quiz (for mixed-frequency charts);
  swipe-to-answer on touch devices. A miss is explained — where the hand sits in
  the chart, how much of its hand type the range plays, and whether it is on the
  range edge — and holds on screen until you continue, so the explanation is
  actually readable (correct answers advance on their own; the timed drill never
  stops).
- **Play the spot** — train the preflop game rather than one range at a time: the
  app deals a table situation (seat, action in front of you, stack depth), finds
  the range in your library that covers it, and grades your decision — naming the
  chart afterwards. A correctly played hand continues into the follow-up spot (you
  open, someone 3-bets) when your library covers it. A spot-coverage map on the
  Library shows which standard spots you have a range for, and turns a gap into a
  new range with the situation pre-filled.
- **Mistake tracking & analytics** — per-hand accuracy, an accuracy heatmap, a
  weakest-hands performance view, a leak report grouping misses by hand type
  (suited connectors, offsuit broadway, …) with a one-tap drill, an accuracy
  breakdown by seat and by action ("you leak from the big blind"), a weakest-spots
  list naming the exact situations you play worst (each drillable on its own), a
  "which way you miss" read on whether your misses play too many hands or fold
  too many (and the seats that lean hardest each way),
  "practice mistakes only", session history, a library-wide practice summary, and
  an accuracy-by-week trend answering whether you are actually improving.
- **Spaced repetition & goals** — a "due for review" queue, a review streak, and an
  optional daily hands goal with progress on Today. Each session advances the
  range's review schedule by accuracy, pulled closer when its per-hand record
  still has stubbornly-wrong hands.
- **Daily workout** — one tap on Today runs a guided session composed from what
  the data says you need: due reviews, then your weakest recorded spots, then
  free spot play, sized to the daily goal, ending in one combined summary. A
  finished workout stays "done" for the rest of the day.
- **Multi-action ranges** — assign an action (fold/call/raise/3-bet/4-bet/jam/
  mixed) per hand on a multi-color grid, see per-action percentages, and
  import/export action-grouped notation.
- **Combo-level precision** — expand hand classes to exact combos, select specific
  combos per hand, see blocker-aware combo counts against a board, and drill
  un-blocked combos. Narrowed combos count toward the range's reported size
  everywhere it is summarized.
- **Mixed-frequency strategies** — assign per-hand action frequencies with
  sliders, view a primary-action grid, and import/export frequency notation.
- **Postflop training** — flop texture tagging, a range-vs-board made-hand/draw
  breakdown, and a self-graded postflop decision drill.
- **Import / export & sharing** — per-range JSON / CSV / SVG export and JSON/CSV
  import, a full backup file (export + import), a "reset practice stats" clean
  slate that keeps your charts, range packs (export/import),
  shareable range and pack links (public or private), and "save to my library"
  forking of shared ranges and packs.
- **Optional accounts & cloud sync** — sign in (Supabase email/OAuth) to push/pull
  your whole library and delete cloud data; entirely env-gated, so the app stays
  fully usable in local-only mode.
- **Mobile & PWA** — responsive grid, large tap targets, an installable
  offline-capable PWA, and a getting-started onboarding panel for new users.

For a feature-by-feature description (and a manual test checklist) see the
[manual testing guide](docs/manual-testing-guide.md).

Deferred (future work): the heavy v5.1 community features — study groups, group
leaderboards, coach-created assignments, comments on ranges, and shared version
history — are intentionally not built (they need a multi-user backend beyond the
current scope). See [`docs/roadmap.md`](docs/roadmap.md).

## Getting started

Requires Node.js and npm.

```bash
npm install      # first time only
npm run dev      # start the Vite dev server (default http://localhost:5173)
```

### Cloud sync (optional)

Cloud accounts and sync are **off by default** — the app is fully usable in
local-only mode. To enable them, copy `.env.example` to `.env.local` and set both
Supabase values:

```bash
cp .env.example .env.local   # then fill in your Supabase URL + anon key
```

Only the **public anon key** goes here. Every `VITE_`-prefixed variable is inlined
into the client bundle, so it must be safe to expose; your data is protected by
Supabase Row-Level Security, not by hiding the key. Never put a `service_role` key
(or any other secret) in a `VITE_` variable. The schema and RLS policies live in
[`supabase/migrations/`](supabase/migrations/).

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
  App.tsx        Top-level: renders the shared-link viewers, then the routed app shell.
  app/           App shell, hash routing, id minting, and file/share + session-recording helpers.
  screens/       The routed screens (Today, Library, the per-range page, Progress, Account).
  practice/      Full-screen practice overlay (mode picker, drills, session summary).
  components/    Shared UI (hand grid, editors, notation, performance views, range thumbnail).
  domain/        Pure poker logic (hand generation, range math, notation, practice scoring, spaced repetition, ...).
  storage/       localStorage persistence (ranges, practice stats, hand/action accuracy, session history, review state, backup).
  cloud/         Optional, env-gated Supabase integration (auth, client, and range/backup/shared-range/shared-pack repos).
  types/         Shared TypeScript types (range.ts, practice.ts).
  test/          Vitest setup.
docs/            Roadmap, manual testing guide, acceptance reviews, and the docs-sync report.
supabase/        SQL migrations documenting the optional cloud schema (ranges, backups, shared ranges, shared packs).
mobile/          The Expo (React Native) iOS app — its own package, reusing src/ domain/storage/cloud logic via the @core alias.
```

Tests live beside the code they cover (e.g. `domain/practice.ts` /
`domain/practice.test.ts`).

## Data & persistence

All data is stored in the browser's `localStorage` under keys prefixed with
`poker-range-trainer.` (saved ranges, practice stats, per-hand and per-action
accuracy, session history, and review state). You can export and re-import a full
backup file at any time, and — when cloud sync is configured and you are signed
in — push/pull your library across devices. Clearing site data without a backup
or cloud copy loses local data. The keys and how to reset them are documented in
the
[manual testing guide](docs/manual-testing-guide.md#2-managing-test-state-important).

## Testing

Core domain and storage logic is covered by Vitest, with component tests via
Testing Library. Run the suite with `npm run test:run`.

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) — product vision and the full version roadmap.
- [`docs/manual-testing-guide.md`](docs/manual-testing-guide.md) — current feature list and a manual test checklist.
- [`CLAUDE.md`](CLAUDE.md) — workflow rules and technical conventions for contributors (and AI agents).
