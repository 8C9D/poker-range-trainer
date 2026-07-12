# Coach UI refactor progress

State file for the "Coach" UI refactor: a training-first app shell (Today / Library / Progress / Account) replacing the old single stacked page.
Update this checklist in every slice's commit so a future session can resume.

## Milestones

- [x] 1. Design tokens + fonts + app shell with hash routing; old page still reachable (default route).
- [x] 2. Today screen (streak chip, Start review CTA, due list, week tiles, empty states); now the default route. Legacy page moved to `#/legacy`.
- [x] 3. Library screen (search, filters/sorts, favorites/archived, thumbnail rows linking to `#/library/:id`, New range -> `#/library/new`). Range page itself is still a placeholder (slice 4).
- [x] 4. Range page with tabs (Overview / Edit / Actions / Combos / Frequencies / Stats) + header menu (duplicate, favorite, archive, delete, exports, share, publish, compare). New-range mode at `#/library/new`. Practice button currently launches the recognition drill directly; the mode picker lands in slice 5.
- [x] 5. Practice flow: mode picker (conditional modes), full-screen recognition drill (cards, scenario line, action-verb buttons, swipe, 20-question sessions, hit/miss dwell), timed + weakness variants, session-end ring with growth delta + streak, review queue with Next range. Build/action/mixed/combo/postflop/board modes run inside the overlay frame (deep restyle deferred to slice 8 polish).
- [x] 6. Progress screen: streak/30-day/all-time tiles, 7-day gold bar chart (today emphasized), library analytics, weakest hands across ranges + "Drill these" (per-range pools via `PracticeRequest.handPools`). Domain helpers: `domain/weakHands.ts`, `dailyHandCounts` in `domain/weeklyStats.ts`.
- [ ] 7. Account & data screen (auth, sync, cloud data, backup/import/export).
- [ ] 8. Shared-link pages restyle; delete legacy layout and dead CSS/components; final polish pass.

## Where things live now

- Tokens + shared component classes: `src/theme.css` (light default, dark via `prefers-color-scheme`).
- Fonts: imported in `src/main.tsx` (`@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/instrument-sans`).
- Routing: `src/app/routes.ts` (`#/today`, `#/library`, `#/library/:id[/:tab]`, `#/progress`, `#/account`, `#/legacy`; empty/unknown hash = Today).
- Shell: `src/app/AppShell.tsx` (icon rail, bottom tabs under 640px).
- `src/App.tsx`: share routes -> shared pages; otherwise `CoachApp` (shell + routed screens + the review-queue runner). The old page lives on as `LegacyPage` inside `App.tsx` until slice 8.
- Today screen: `src/screens/TodayScreen.tsx`; loads its own storage state on mount (practice unmounts the screen, so it always re-reads on return).
- Shared session recorder: `src/app/sessionRecording.ts` (`recordFinishedPracticeSession` - stats + hand accuracy + history + review schedule); used by both the legacy page and the review queue. Note: it always advances the review schedule, even for a zero-answer session (pre-refactor behavior kept).
- Review queue: `CoachApp` state (`reviewQueue`/`reviewIndex`) rendering `PracticeSession` per range with a "Range k of N" bar; slice 5 replaces the visuals with the drill overlay.
- Range grid thumbnail: `src/components/RangeThumbnail.tsx` (SVG, gold-on-well, decorative).
- Weekly stats: `src/domain/weeklyStats.ts` (`summarizeWeek`); date/greeting helpers in `src/app/format.ts`.
- Library screen: `src/screens/LibraryScreen.tsx`; same filter/sort pipeline as the old `RangeLibrary` via `domain/rangeLibrary` helpers; per-range mutations move to the Range page.
- Range page: `src/screens/RangeScreen.tsx` (header/menu/tabs; Actions/Combos/Frequencies/Stats/Compare inline, Stats reuses `RangePerformance` until slice 8) + `src/screens/RangeEditTab.tsx` (ported legacy editor incl. metadata/source/per-hand notes; save keeps legacy merge semantics).
- Shared file/share helpers: `src/app/rangeFiles.ts` (downloads, JSON/CSV/SVG export, share-link copy); id minting in `src/app/ids.ts`. Both used by the legacy page too.
- Practice module: `src/practice/` - `PracticeHost` (picker -> drill -> summary state machine, queue advance, recording), `RecognitionDrill` (standard/weakness/timed variants), `OverlayFrame`, `ModePicker`, `SessionSummary`, `PlayingCards`, `scenario.ts` (verbs/scenario/feedback copy).
- `CoachApp` renders `PracticeHost` INSTEAD of the shell while practice runs, so screens remount (re-read storage) when it closes. `startReview(queue)` = recognition queue; `startPractice(range, handPool?)` = picker (or straight to recognition with a pool).
- Behavior change from legacy: closing a drill with zero answers records NOTHING (legacy always advanced the review schedule). Closing with answers records the partial session and shows the summary.

## Decisions

- Old `App.test.tsx` tests keep passing against the legacy default route; they are rewritten per slice as flows move into the new IA.
- Share routes (`#/r/:id`, `#/p/:id`, `#range=` import) are handled before the shell router, unchanged.

## Feature inventory checklist (nothing may be lost; tick when reachable in the NEW IA)

- [ ] Editor: grid, drag painting, shortcuts, live %/combos, notation, scenario metadata, source, per-hand notes
- [ ] Library: search, position/action/stack/game filters, 4 sorts, duplicate, archive, favorite, per-range stats
- [ ] Practice: recognition (+hand pool), build-from-memory, timed, weakness, action quiz, mixed quiz, combo drill, postflop drill, missing-hands review, swipe, session stats
- [ ] Tracking: per-range stats, per-hand heatmap, per-action accuracy, session history, due queue + streak
- [ ] Advanced: multi-action + notation, combo selections, mixed frequencies + notation, range diff, range-vs-board
- [ ] Data: backup export/import, range JSON/CSV/SVG, share links, packs, cloud publish/unpublish + fork, `#/r/:id` + `#/p/:id`
- [ ] Cloud: auth, push/pull sync, delete cloud data, local-only mode
- [ ] Platform: PWA, responsive, code-split Supabase
