# Coach UI refactor progress

State file for the "Coach" UI refactor: a training-first app shell (Today / Library / Progress / Account) replacing the old single stacked page.
The refactor is COMPLETE; this file stays as a map of where things live.

## Milestones

- [x] 1. Design tokens + fonts + app shell with hash routing; old page still reachable (default route).
- [x] 2. Today screen (streak chip, Start review CTA, due list, week tiles, empty states); now the default route.
- [x] 3. Library screen (search, filters/sorts, favorites/archived, thumbnail rows linking to `#/library/:id`, New range -> `#/library/new`).
- [x] 4. Range page with tabs (Overview / Edit / Actions / Combos / Frequencies / Stats) + header menu (duplicate, favorite, archive, delete, exports, share, publish, compare). New-range mode at `#/library/new`.
- [x] 5. Practice flow: mode picker (conditional modes), full-screen recognition drill (cards, scenario line, action-verb buttons, swipe, 20-question sessions, hit/miss dwell), timed + weakness variants, session-end ring with growth delta + streak, review queue with Next range. Build/action/mixed/combo/postflop/board modes run inside the overlay frame.
- [x] 6. Progress screen: streak/30-day/all-time tiles, 7-day gold bar chart (today emphasized), library analytics, weakest hands across ranges + "Drill these" (per-range pools via `PracticeRequest.handPools`). Domain helpers: `domain/weakHands.ts`, `dailyHandCounts` in `domain/weeklyStats.ts`.
- [x] 7. Account & data screen: AuthPanel, push/pull sync (confirm before overwrite), delete cloud data, publish/unpublish pack link, sync status; backup export/import, range JSON/CSV/pack import, pack export; local-only note. Same gating as before (configured + signed in).
- [x] 8. Legacy layout and dead components deleted (`LegacyPage`, `RangeLibrary`, `LibraryAnalytics`, `DueToday`, `GettingStarted`, `PracticeSession`, `TimedDrillSession`, `WeaknessFocusedDrill`, `App.css`, the `#/legacy` route). Shared-link pages restyled (`SharedPage.css`). Grid/heatmap moved onto Coach tokens (`--cellbg`/`--pairbg`/`--gold-fill`, heat ramp + legend). Legacy CSS vars aliased to Coach tokens in `src/index.css`. PWA theme colors updated; SW cache bumped to v2.

## Where things live

- Tokens + shared component classes: `src/theme.css` (light default, dark via `prefers-color-scheme`; global base typography). Legacy var aliases (`--text`, `--border`, `--code-bg`, ...) map onto Coach tokens in `src/index.css` so the remaining pre-Coach component CSS themes automatically.
- Fonts: imported in `src/main.tsx` (`@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/instrument-sans`).
- Routing: `src/app/routes.ts` (`#/today`, `#/library`, `#/library/new`, `#/library/:id[/:tab]`, `#/progress`, `#/account`; empty/unknown hash = Today). Share routes (`#/r/:id`, `#/p/:id`, `#range=` import) are handled in `App.tsx` before the shell router.
- Shell: `src/app/AppShell.tsx` (icon rail, bottom tabs under 640px).
- Screens: `src/screens/` - `TodayScreen`, `LibraryScreen`, `RangeScreen` (+ `RangeEditTab`), `ProgressScreen`, `AccountScreen`. Each loads its own storage state on mount; practice replaces the shell entirely, so screens re-read fresh data when the overlay closes.
- Practice module: `src/practice/` - `PracticeHost` (picker -> drill -> summary state machine, queue advance, recording), `RecognitionDrill` (standard/weakness/timed variants), `OverlayFrame`, `ModePicker`, `SessionSummary`, `PlayingCards`, `scenario.ts` (verbs/scenario/feedback copy).
- Shared session recorder: `src/app/sessionRecording.ts` (stats + hand accuracy + history + review schedule).
- File/share helpers: `src/app/rangeFiles.ts`; id minting in `src/app/ids.ts`; date/format helpers in `src/app/format.ts`.
- Range grid thumbnail: `src/components/RangeThumbnail.tsx` (SVG, gold-on-well, decorative).
- Domain additions for this UI: `weeklyStats.ts` (`summarizeWeek`, `dailyHandCounts`), `weakHands.ts` (`rankWeakHands`, `weakHandPools`).

## Behavior notes

- Closing a drill with zero answers records NOTHING (the old page always advanced the review schedule, even for empty sessions). Closing with answers records the partial session and shows the peak-end summary.
- The review queue (Today -> Start review) is recognition-mode straight through; the Range page's Practice button opens the mode picker; weak-hand drills skip the picker with a restricted pool.
- Answer buttons use the range's action verb (from `metadata.actionType`) vs Fold, and never move between hands.

## Feature inventory checklist (verified reachable in the new IA)

- [x] Editor: grid, drag painting, shortcuts, live %/combos, notation, scenario metadata, source, per-hand notes (Range page -> Edit)
- [x] Library: search, position/action/stack/game filters, 4 sorts, duplicate, archive, favorite, per-range stats (Library + Range page menu)
- [x] Practice: recognition (+hand pool), build-from-memory, timed, weakness, action quiz, mixed quiz, combo drill, postflop drill, missing-hands review (Stats tab -> Practice mistakes), swipe, session stats
- [x] Tracking: per-range stats, per-hand heatmap (+legend), per-action accuracy, session history, due queue + streak with grace day
- [x] Advanced: multi-action + notation, combo selections, mixed frequencies + notation, range diff (menu -> Compare), range-vs-board (mode picker)
- [x] Data: backup export/import, range JSON/CSV/SVG, share links, packs, cloud publish/unpublish + fork, `#/r/:id` + `#/p/:id`
- [x] Cloud: auth, push/pull sync, delete cloud data, local-only mode (Account)
- [x] Platform: PWA (manifest/theme colors updated, SW cache v2), responsive (bottom tabs, 44px targets), code-split Supabase (lazy import intact)
