# Feature audit - iOS App Store build

Scope: the Expo app in `mobile/`.
Web-only items are at the end.
Paths are repo-relative; `@core/*` resolves to `src/`.

## Original purpose

A local-first trainer for Texas Hold'em preflop starting-hand ranges: build and save a range on a 13x13 grid, then drill yourself on it until you know it cold.
The first commits build exactly that and nothing else (hand matrix, range math, selectable grid, saved-range storage, library UI, practice session, practice UI).
Everything from v2 on is layered on that loop.

## At a glance

4 core, 17 add-on, 4 nice-to-have.

## Core

### Range editor
- What: 13x13 grid with tap and drag-paint, shortcut buttons, live combo count, live save.
- Where: `mobile/components/RangeEditor.tsx`, `HandGrid.tsx`, `RangeShortcuts.tsx`.
- Why this category: making a range by hand is half the original job.
- If removed: ranges arrive only from starter charts, imports or links; `range/new.tsx` and the Edit tab go dark.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Recognition drill
- What: deals a hand, you answer in or out; misses are explained and held on screen.
- Where: `mobile/components/practice/RecognitionDrill.tsx`, `PracticeHost.tsx`.
- Why this category: this is the practice the app was built to deliver.
- If removed: every drill link on Today, Library and Progress dead-ends; workout and spot play lose their engine.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Practice recording
- What: writes each finished session to per-range stats, per-hand accuracy, history and the review schedule.
- Where: `mobile/lib/sessionRecording.ts`, `src/storage/`.
- Why this category: without it practice leaves no trace and nothing improves.
- If removed: Progress, Today tiles, due queue, goal, workout and two library sorts all read empty.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Range library and storage
- What: saved ranges as cards, a per-range page with six tabs, create and delete, persisted on device.
- Where: `mobile/app/(tabs)/library.tsx`, `app/range/[id].tsx`, `mobile/platform/installStorage.ts`.
- Why this category: the saved range is the unit everything else operates on.
- If removed: there is no app.
- [ ] Keep   [ ] Cut   [ ] Undecided

## Add-ons

Ordered easiest to cut first.

### Postflop tools
- What: a range-vs-board breakdown with flop texture tags, and a self-graded flop decision drill.
- Where: `mobile/app/board.tsx`, `app/postflop.tsx`, `components/postflopDrill.ts`.
- Why this category: the purpose is preflop ranges; this is a different street.
- If removed: two mode-picker entries vanish; nothing else references them.
- Flags: results are never recorded, so they earn no stats, streak or goal credit; the "correct" answer is a heuristic, not solver output.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Range compare
- What: diff of two saved ranges as a tri-colour grid.
- Where: `mobile/app/diff.tsx`.
- Why this category: a study aid, not part of build-then-drill.
- If removed: the "Compare" item in the range menu goes too.
- Flags: reachable only from that overflow menu.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Combo tools
- What: expand a hand class to concrete combos, pick individual combos, drill unblocked combos.
- Where: `mobile/components/ComboExplorer.tsx`, `ComboSelector.tsx`, `components/practice/ComboDrill.tsx`.
- Why this category: precision beyond the 169-cell model the app is built around.
- If removed: the Combos tab and one drill mode go; saved combo selections stop counting toward reported range size.
- Flags: the combo drill records nothing; combo selection feeds range percentages app-wide, so it is not a clean cut.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Per-hand notes
- What: attach a note to a hand; a miss on that hand hands the note back.
- Where: `mobile/app/notes-editor.tsx`.
- Why this category: enriches the drill without being needed to run it.
- If removed: the "Edit notes" link, the note line in miss explanations and the Overview note count go.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Import, export and backup files
- What: notation and CSV import/export, whole-library JSON backup, and range pack files.
- Where: `mobile/components/RangeNotation.tsx`, `RangeCsv.tsx`, `ActionNotation.tsx`, `MixedNotation.tsx`, `BackupPanel.tsx`, `RangeFilesPanel.tsx`.
- Why this category: data portability, not training.
- If removed: two range-menu items, four editor panels and two Account sections go; users lose their offline escape hatch.
- Flags: four overlapping export paths; uses the document picker and share sheet, neither of which prompts for permission.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Offline share links
- What: copy a link that carries a whole range inside the URL, plus an import screen that decodes one.
- Where: `mobile/lib/shareLink.ts`, `app/import.tsx`.
- Why this category: sharing is adjacent to the training loop.
- If removed: the "Copy share link" item and the `import` deep-link route go; links already sent stop opening.
- Flags: needs no account and no cloud, unlike published links.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Starter charts
- What: fills an empty library with nine standard 6-max 100bb charts in one tap.
- Where: `mobile/components/StarterRangesPanel.tsx`, `app/(tabs)/index.tsx`, `library.tsx`.
- Why this category: onboarding content; the app works on user-built ranges.
- If removed: a new install is empty and every drill, spot and workout has nothing to run on.
- Flags: offered from three places.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Published share links
- What: publish a range or the whole library as a public or token-guarded cloud link others open in-app.
- Where: `mobile/app/r/[id].tsx`, `app/p/[id].tsx`, `components/SharePackPanel.tsx`.
- Why this category: distribution, well outside build-then-drill.
- If removed: publish and unpublish menu items, the pack panel and two deep-link routes go.
- Flags: App Store review - user content published to other users normally needs reporting and moderation; needs an account plus Supabase env, and shows "not configured" otherwise.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Cloud accounts and sync
- What: email and password sign-up, sign-in, push and pull the whole library, delete cloud data.
- Where: `mobile/components/AuthPanel.tsx`, `mobile/platform/supabaseClient.ts`, `cloudEnv.ts`.
- Why this category: the app is fully usable local-only, by design.
- If removed: published share links go with it; local practice is untouched.
- Flags: account creation with no in-app account deletion (delete removes the cloud backup and revokes links, not the account); `@supabase/supabase-js` sits in the root `package.json`, not `mobile/package.json`; `eas.json` sets no `EXPO_PUBLIC_SUPABASE_*`, so a default production build ships this inert; the privacy manifest declares no collected data while sync uploads email and library.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Action and frequency overlays
- What: assign an action per hand on a colour grid, or per-hand action frequencies with sliders, each with its own quiz.
- Where: `mobile/components/ActionsEditor.tsx`, `FrequenciesEditor.tsx`, `components/practice/ActionQuizDrill.tsx`, `MixedQuizDrill.tsx`.
- Why this category: overlays on a range; the core drill is in or out.
- If removed: two range tabs, two drill modes, the per-action block on Stats and two notation panels go; saved overlays are orphaned.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Extra drill modes
- What: build-from-memory, timed, weakness-weighted and range-edge variants of the drill.
- Where: `mobile/components/practice/ModePicker.tsx`, `BuildDrill.tsx`, `RecognitionDrill.tsx`.
- Why this category: variations on the core drill rather than the drill itself.
- If removed: the mode picker shrinks; Today and Progress links still work, since they preset recognition.
- Flags: the edge drill is offered in the picker, but `mode=edges` is missing from the accepted deep-link modes in `mobile/app/practice.tsx`, so a preset link would fall back to the picker.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Library organization
- What: search by name, tag or hand, filters, four sorts, favourite, archive, duplicate, multi-select, bulk queue, undo delete.
- Where: `mobile/app/(tabs)/library.tsx`.
- Why this category: management convenience over a list that already works.
- If removed: the Library becomes a plain list; the multi-range practice queue and the undo path go.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Daily workout
- What: one tap runs a composed session - due reviews, weakest spots, free spot play - sized to the daily goal.
- Where: `mobile/app/workout.tsx`, `components/practice/WorkoutHost.tsx`.
- Why this category: an orchestration layer over drills that already exist.
- If removed: the Today workout card and its done-state go; nothing else depends on it.
- Flags: duplicates what the due queue and spot play already offer separately.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Progress analytics
- What: weekly hands and accuracy, accuracy trend, leaks by hand type, weakest spots, seat and action accuracy, miss-direction read, weakest hands - each drillable.
- Where: `mobile/app/(tabs)/progress.tsx`.
- Why this category: reporting on the loop, not the loop.
- If removed: one whole tab and about a dozen shortcut drill links go; the recorded data survives.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Today dashboard
- What: greeting, streak, due-for-review queue, caught-up suggestion, daily goal picker with progress, week tiles.
- Where: `mobile/app/(tabs)/index.tsx`, plus spaced repetition and goal logic in `@core/domain`.
- Why this category: scheduling and motivation around the drill.
- If removed: the first tab goes, and the review schedule loses its only surface; the workout and spot cards live here too.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Play the spot and coverage map
- What: deals a seat, action and stack depth, finds the covering range, grades the decision, chains into follow-ups; a coverage grid turns gaps into new ranges.
- Where: `mobile/components/practice/SpotDrill.tsx`, `SpotCoverage.tsx`.
- Why this category: trains the preflop game rather than one chart, which is past the original scope.
- If removed: Today and Library cards, the Progress weakest-spots section and one workout segment lose their source; spot accuracy storage is orphaned.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Scenario metadata
- What: optional game type, table size, stack depth, position, action type and notes per range, offered from its name.
- Where: `mobile/components/RangeMetadataEditor.tsx`.
- Why this category: descriptive data, not required to draw or drill a range.
- If removed: spot play, the coverage map, the workout's spot segments, seat and action analytics and the library filters all lose their input.
- Flags: the most entangled add-on here, despite being optional per range.
- [ ] Keep   [ ] Cut   [ ] Undecided

## Nice-to-have

### Range thumbnails and accuracy heatmap
- What: mini grid previews on cards, and a 13x13 accuracy heatmap on the Stats tab.
- Where: `mobile/components/RangeThumbnail.tsx`, `HandHeatmap.tsx`, `RangeStats.tsx`.
- Why this category: polish; the heatmap duplicates the weakest-hands list beside it.
- If removed: cards and the Stats tab lose colour, nothing else.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Swipe answers and haptics
- What: swipe left or right to answer, with a haptic tap on each answer.
- Where: `mobile/components/swipeAnswer.ts`, `components/practice/RecognitionDrill.tsx`, `SpotDrill.tsx`.
- Why this category: input convenience; the buttons remain.
- If removed: nothing breaks; `expo-haptics` becomes unused.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Reset practice record
- What: clears all practice stats while keeping the charts.
- Where: `mobile/components/StarterRangesPanel.tsx`, `@core/storage/statsReset`.
- Why this category: a one-off convenience.
- If removed: users would delete and re-add ranges for the same effect.
- [ ] Keep   [ ] Cut   [ ] Undecided

### Tags and source reference
- What: free-text organization tags, and a source kind plus a tappable reference URL per range.
- Where: `mobile/components/RangeTagEditor.tsx`, `app/range/[id].tsx`.
- Why this category: cataloguing polish, duplicative of scenario metadata and search.
- If removed: the tag filter and tag search go too; the reference link opens an external browser today.
- [ ] Keep   [ ] Cut   [ ] Undecided

## Self-contained

Nothing else depends on these:

- Postflop tools
- Range compare
- Import, export and backup files
- Offline share links
- Published share links
- Starter charts
- Daily workout
- Progress analytics
- Range thumbnails and accuracy heatmap
- Swipe answers and haptics
- Reset practice record

## Needs a decision from me

- Cloud accounts, sync and published links: is Supabase configured for the App Store build?
  As it stands `eas.json` sets no Supabase env, so these ship visible but inert.
  If they do ship, in-app account deletion and a reporting path for shared content are review blockers, and the privacy manifest needs updating.
- Postflop tools: graded training or a reference toy?
  They record nothing and grade against a heuristic, so I cannot tell whether they are unfinished or deliberately informal.
- Android: `app.json` carries full Android adaptive-icon assets.
  Is Android in scope, or is that leftover config?

## Web-only (not in the App Store build)

- Installable PWA with an offline service worker (`public/service-worker.js`, `public/manifest.webmanifest`).
- SVG export of a range (`src/app/rangeFiles.ts`); mobile exports JSON, CSV and notation only.
- Keyboard navigation of the grid and action-quiz keyboard shortcuts (`src/components/useHandGridKeys.ts`, `actionQuizShortcuts.ts`).

Everything else under `src/` is either shared domain logic the iOS app reuses or a web mirror of a feature above.
