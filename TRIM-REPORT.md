# v1 scope trim report

The repo is trimmed to the 12-feature v1 keep list on both apps (web `src/`, iOS `mobile/`).
The authoritative restore point is the tag `pre-trim-full-featureset` (also branch `archive/full-featureset`).
Archived code lives under `archived/<feature-slug>/` with original relative paths preserved, and `archived/RESTORE.md` documents per feature the moved files, the unhooked call sites, the unregistered routes, and the storage left behind.
`archived/` is fenced from typecheck, lint, tests, Metro bundling, and EAS uploads, so its intentionally broken imports never reach a build.

Commits: `chore: archive the 13 cut features…` (Phase 1, moves only, intentionally non-building), `refactor: unhook the archived features…` (Phases 2 and 3 - the conflict rules and the kept-feature trims land together because they edit the same files), `chore: drop dead routes, panels CSS and dependencies…` (Phase 4), plus this report.

## What was archived and where it went

Each feature moved to `archived/<slug>/` with its wholly-owned source, CSS, and test files (tests were moved, not deleted, so restoring a feature restores its coverage):

- Postflop tools → `archived/postflop-tools/` (board/postflop screens, drill setup and practice, board-texture and range-vs-board domain).
- Range compare → `archived/range-compare/` (diff screen, diff view, `rangeDiff` domain).
- Combo tools → `archived/combo-tools/` (combo selector/explorer, blocker drill, combo enumeration).
- Per-hand notes → `archived/per-hand-notes/` (notes editors on both platforms).
- Import/export and backup files → `archived/import-export-backup/` (notation/CSV/action-notation/mixed-notation panels, backup and range-files panels, `rangeTransfer`, `rangeFiles`, `mixedNotation`, `base64url`).
- Offline share links → `archived/offline-share-links/` (mobile `shareLink` + import screen; the web `#range=` codec lived in `rangeTransfer`, archived above).
- Starter charts → `archived/starter-charts/` (`starterRanges` domain and the mobile panel, after the Reset action was extracted per conflict rule 1).
- Published share links → `archived/published-share-links/` (shared range/pack pages and repos, `shareRoute`, `forkShared`, share pack panel, `useMobileSession`).
- Action and frequency overlays → `archived/action-frequency-overlays/` (both editors, both quizzes, action grid/palette, mixed-strategy editor/grid, `actionColors`).
- Daily workout → `archived/daily-workout/` (workout hosts, `dailyWorkout` domain).
- Play the spot and coverage map → `archived/play-the-spot/` (spot drills, coverage maps, `spot*` and `seatAccuracy` domain, `scenarioParams`).
- Range thumbnails and accuracy heatmap → `archived/range-thumbnails-heatmap/`.
- Tags and source reference → `archived/tags-source-reference/` (tag editors, `sourceReference` domain).

Shared modules that define persisted data stayed in place even where their feature left, because kept code (storage normalization, cloud backup, reset) still touches them: `comboSelection`, `actionRange`, `mixedStrategy`, `spot`, `blockerPractice` (the kept recognition drill deals combos through it), `rangeNotation` (`describeRangeChart` labels kept surfaces), and the `spotAccuracyStorage`/`actionAccuracyStorage`/`workoutStorage` modules.
`src/cloud/rangesRepo.ts` also stays: the live `backupRepo` imports `NotSignedInError` from it.

## Kept features that were trimmed

- Range editor: the notation, CSV, action-notation, mixed-notation, backup and range-files panels and the combo selector are gone.
  Grid, drag-paint, shortcut buttons, live combo count and live save stay.
  Both editors now carry every stored overlay field (actions, frequencies, combo selections, notes, tags, source) through a save untouched, with an in-session restore so a transient deselect cannot destroy overlay data the storage layer would otherwise scope out.
- Range library and storage: the per-range page went from six tabs to three (Overview, Edit, Stats); the Combos, Actions and Frequencies tabs and the notes entry point are gone, and `RANGE_TABS` was recounted on both platforms.
  Range thumbnails came off the library cards, the Today due rows, and the range Overview.
- Recognition drill: the "Your note:" line is gone from miss feedback; the explanation itself stays.
- Extra drill modes: the picker offers exactly recognition, build-from-memory, timed, weakness-weighted and range-edge on both platforms.
  Combo, action-quiz, mixed-quiz, spot and postflop entries are gone.
  The audit's bug is fixed: `mode=edges` is now an accepted deep-link mode in `mobile/app/practice.tsx`.
- Progress analytics: weekly hands and accuracy, accuracy trend, leaks by hand type, the miss-direction read (including its per-seat leans, which are hand-accuracy-based) and weakest hands stay.
  Weakest spots, seat accuracy and action accuracy are gone rather than left to render empty (conflict rule 3).
  Every remaining drill shortcut targets recognition, which still exists.
- Today dashboard: greeting, streak, due-for-review queue, caught-up suggestion, daily goal picker with progress and week tiles stay.
  The workout card and its done-state, the spot card, and the starter-charts offer are gone; the empty-state welcome card now points at "Create a range" (conflict rule 6), as do the Library empty states.
- Practice recording: the five surviving drill modes record exactly as before (per-range stats, per-hand accuracy, history, review schedule).
  Nothing writes spot-accuracy or per-action records any more.
- Cloud accounts and sync: sign-up, sign-in, push/pull and delete-cloud-data stay.
  Publish/unpublish, the share pack panel and the `r/[id]`/`p/[id]` routes are gone.
  The pushed sync payload is trimmed to the surviving model (no action overlays, frequency overlays, combo selections, per-hand notes, or tags - `trimBackupForSync` in `src/cloud/backupRepo.ts`); a pulled payload that still carries those fields restores them to disk without erroring.
  Delete-cloud-data now deletes the backup row only (see launch blockers).
- Reset practice record: extracted from the archived `StarterRangesPanel` into `mobile/components/ResetStatsPanel.tsx`, still on the Account tab; it still clears the now-orphaned spot-accuracy, action-accuracy and workout stores.
- Scenario metadata: stays editable and attached to ranges; its surviving consumers are the Library filters (and the name-based suggestion in the editor).
  The coverage-map prefill plumbing (`scenarioParams` in web routes and `range/new`) went with the coverage map, and the metadata editor lost its Source/Reference fields (tags-source-reference).

## Behaviour changes a user would notice

- Empty first run: a fresh install has an empty library and no starter-charts offer; Today and Library point at creating a range.
- Changed range percentages: all range-size, combo-count and percentage figures use the 169-cell hand-class model.
  A range whose combo selections narrowed a hand class (e.g. AA down to one combo) now reports the full class size everywhere; the stored selections are untouched.
- The per-range page has three tabs instead of six, no thumbnail preview, no note count, and no source line; its overflow menu is down to Duplicate/Favorite/Archive/Delete.
- The Progress tab is smaller: no weakest spots, no seat/action accuracy breakdown.
- Today is smaller: no workout card, no spot card.
- Misses in the drill no longer show the user's own hand note.
- The Library search no longer matches tags, and the tag filter and tag chips are gone; name, hand and scenario-notes search, the metadata filters, all four sorts, favourite, archive, duplicate, multi-select, bulk practice queue and undo delete all remain.
- Cloud round-trips shed archived-feature range fields: a push then pull will come back without action overlays, frequencies, combo selections, notes and tags (local data is only replaced when the user confirms a pull; nothing strips the local store by itself).
- Previously shared links (offline `#range=` links, published `/r/`+`/p/` links) no longer open.

## Dependencies removed

Removed from `mobile/package.json` (zero references in the shipped tree):

- `expo-clipboard` (copy notation/CSV/share links - all archived).
- `expo-document-picker` (backup and range-file imports - archived).
- `expo-file-system` (range-file export - archived).
- `expo-sharing` (export share sheet - archived; also removed from `mobile/app.json` plugins).

Kept deliberately: `expo-haptics` (swipe answers stay), `expo-linking` and `expo-constants` (expo-router requires them), `react-native-url-polyfill` and `@supabase/supabase-js` (cloud sync ships).

`@supabase/supabase-js` is now declared in `mobile/package.json` as the audit asked - but it is ADDED there rather than moved, because the web app's `src/cloud/*` imports it directly and removing it from the root `package.json` would break the web build.
`mobile/tsconfig.json` maps the package to the mobile copy so the two installs cannot produce conflicting type identities.
As a side effect of making `npx expo-doctor` pass (a verification requirement), the mobile Expo packages were aligned to the SDK 56 expected patch versions (`expo` 56.0.19, `expo-router` 56.2.18, `react-native-screens` 4.26.0, etc.); `react` stays pinned at exactly 19.2.3.

## Verification

- `tsc -b` (web) and `tsc --noEmit` (mobile) clean; `npm run build` clean.
- `npm run lint` clean on both apps.
- Web: 87 files / 1229 tests pass; mobile: 35 suites / 217 tests pass.
- `npx expo-doctor`: 21/21 checks pass.
- A whole-word ripgrep sweep over ~70 archived-feature identifiers finds zero references outside `archived/` (and the pre-trim audit documents).
- Remaining routes: web `#/today`, `#/library`, `#/library/new`, `#/library/:id[/edit|/stats]`, `#/progress`, `#/account`; mobile tabs (`index`, `library`, `progress`, `account`) plus `practice`, `range/new`, `range/[id]`.
  Every remaining nav entry, card, menu item, empty state and deep link targets one of these.
- Tests that only covered archived features were moved to `archived/` with their features (see the per-feature file lists in `archived/RESTORE.md`); the notable deletions-in-place were the archived-feature blocks inside shared test files (e.g. the action-quiz/spot blocks of both PracticeHost suites, the tag blocks of both library suites, the workout/spot blocks of both Today suites, the SVG-palette and action-palette blocks of `cssIntegrity`).

## Launch blockers still open

Reported, not fixed (out of scope for this trim):

- No in-app account deletion: cloud sync ships sign-up, but "Delete cloud data" removes the backup row only - it does not delete the Supabase auth account.
  App Store review requires in-app account deletion for apps with account creation.
- The privacy manifest in `mobile/app.json` declares `NSPrivacyCollectedDataTypes: []` (no collected data), while cloud sync uploads the user's email address and their whole library.
  If sync ships enabled, the manifest must declare the collected data types.
- `eas.json` sets no `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, so a default production build ships cloud sync visible but inert ("not configured").
  Either supply the env in the production build profile or hide the panel when unconfigured is the intended state.
- New with this trim: published share links created before the trim stay live in `shared_ranges`/`shared_packs`, and with publishing archived there is no in-app way to revoke them.
  If any real users published links, revoke server-side or restore the feature before shipping.
- Pre-existing and unchanged: cloud push is last-writer-wins with no version check (see `review/findings.md` S3), and the deployed Supabase schema/RLS is unverified against the checked-in SQL.
