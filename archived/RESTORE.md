# Restoring an archived feature

Each section lists what `git mv` moved (restore by moving the file back to the path shown, i.e. strip the `archived/<slug>/` prefix), the call sites that were edited to unhook the feature, the routes that were unregistered, and the storage left behind.
The authoritative pre-trim snapshot is the tag `pre-trim-full-featureset` (branch `archive/full-featureset`); diff a restored file against it to recover any call-site wiring this file under-describes.
`archived/` is excluded from typecheck (`tsconfig.app.json`, `mobile/tsconfig.json`), lint (both `eslint.config.js`), tests (`vitest.config.ts`, `mobile/jest.config.js`), Metro (`blockList` in `mobile/metro.config.js`) and EAS uploads (root `.easignore`); restored files leave `archived/`, so no exclusion change is needed.
Cross-cutting notes:
- Test files wholly owned by a feature moved with it; restoring the feature restores its tests.
- Removed mobile dependencies (see TRIM-REPORT.md): `expo-clipboard`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, and the `expo-sharing` entry in `mobile/app.json` plugins. Restore whichever a restored feature imports.
- The cloud sync payload (`trimBackupForSync` in `src/cloud/backupRepo.ts` - itself archived since, under `archived/cloud-sync/`) strips `handActions`, `mixedStrategies`, `comboSelections`, `handNotes` and `tags` from pushed ranges; when restoring the owning feature, remove its field from that strip list so pushes carry it again.

## Postflop tools (`postflop-tools`)

### Moved files (original paths)

- `mobile/__tests__/board-screen.test.tsx`
- `mobile/__tests__/postflop-drill.test.ts`
- `mobile/app/board.tsx`
- `mobile/app/postflop.tsx`
- `mobile/components/postflopDrill.ts`
- `src/components/FlopTexture.css`
- `src/components/FlopTexture.test.tsx`
- `src/components/FlopTexture.tsx`
- `src/components/PostflopDrillSetup.test.tsx`
- `src/components/PostflopDrillSetup.tsx`
- `src/components/PostflopPractice.test.tsx`
- `src/components/PostflopPractice.tsx`
- `src/components/RangeVsBoard.css`
- `src/components/RangeVsBoard.test.tsx`
- `src/components/RangeVsBoard.tsx`
- `src/domain/boardTexture.test.ts`
- `src/domain/boardTexture.ts`
- `src/domain/handCategory.test.ts`
- `src/domain/handCategory.ts`
- `src/domain/postflopScenario.test.ts`
- `src/domain/postflopScenario.ts`
- `src/domain/rangeVsBoard.test.ts`
- `src/domain/rangeVsBoard.ts`

### Call sites edited to unhook

- `src/practice/PracticeHost.tsx` / `mobile/components/practice/PracticeHost.tsx` - the `postflop`/`board` modes and their overlay branches removed.
- `src/practice/ModePicker.tsx` / `mobile/components/practice/ModePicker.tsx` - the two picker entries removed; `PracticeMode` no longer includes `postflop`/`board`.
- `mobile/app/practice.tsx` - the modes are gone from the accepted deep-link list.
- `src/cssIntegrity.test.ts` - table-count guard lowered (the postflop tables left).

### Routes unregistered

- Routes `board` and `postflop` (mobile route files moved; no web route existed - both were practice-overlay modes).

### Storage left behind

- None.

## Range compare (`range-compare`)

### Moved files (original paths)

- `mobile/__tests__/diff-screen.test.tsx`
- `mobile/app/diff.tsx`
- `src/components/RangeDiffView.css`
- `src/components/RangeDiffView.test.tsx`
- `src/components/RangeDiffView.tsx`
- `src/domain/rangeDiff.test.ts`
- `src/domain/rangeDiff.ts`

### Call sites edited to unhook

- `src/screens/RangeScreen.tsx` - the Compare… menu item, `ComparePanel` and its state removed.
- `mobile/app/range/[id].tsx` - the Compare… menu item removed.

### Routes unregistered

- Route `diff` (mobile). On web the comparison was a panel inside the range screen, not a route.

### Storage left behind

- None.

## Combo tools (`combo-tools`)

### Moved files (original paths)

- `mobile/__tests__/blocker-drill.test.ts`
- `mobile/__tests__/combo-drill.test.tsx`
- `mobile/__tests__/combo-enumeration.test.ts`
- `mobile/__tests__/combo-explorer.test.tsx`
- `mobile/__tests__/combo-selector.test.tsx`
- `mobile/__tests__/editor-combo-selection.test.tsx`
- `mobile/components/ComboExplorer.tsx`
- `mobile/components/ComboSelector.tsx`
- `mobile/components/blockerDrill.ts`
- `mobile/components/comboEnumeration.ts`
- `mobile/components/practice/ComboDrill.tsx`
- `src/components/ComboBlockerDrill.css`
- `src/components/ComboBlockerDrill.test.tsx`
- `src/components/ComboBlockerDrill.tsx`
- `src/components/ComboSelector.css`
- `src/components/ComboSelector.test.tsx`
- `src/components/ComboSelector.tsx`

### Call sites edited to unhook

- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Combos tab removed; Overview counts fall back to `countSelectedCombos`/`calculateRangePercentage` (169-cell model).
- `src/screens/LibraryScreen.tsx` / `mobile/app/(tabs)/library.tsx` - row percentages fall back to `calculateRangePercentage(range.hands)`.
- `src/screens/RangeEditTab.tsx` / `mobile/components/RangeStatsBar.tsx` - live editor counts use the 169-cell model.
- `src/practice/PracticeHost.tsx` / `mobile/components/practice/PracticeHost.tsx` - the `combo` mode removed.
- `src/practice/ModePicker.tsx` / `mobile/components/practice/ModePicker.tsx` - the Combo drill entry removed.
- `src/cloud/backupRepo.ts` - `comboSelections` stripped from the pushed sync payload.

### Routes unregistered

- None (the combo drill was a practice-overlay mode).

### Storage left behind

- `SavedRange.comboSelections` stays in the storage model: `src/storage/rangeStorage.ts` still normalizes it, both editors carry it through a save (with an in-session restore for deselected hands), and a pulled cloud payload restores it. Nothing reads it for display; pushes omit it.

## Per-hand notes (`per-hand-notes`)

### Moved files (original paths)

- `mobile/__tests__/notes-editor-screen.test.tsx`
- `mobile/app/notes-editor.tsx`
- `src/components/HandNotesEditor.css`
- `src/components/HandNotesEditor.test.tsx`
- `src/components/HandNotesEditor.tsx`

### Call sites edited to unhook

- `src/screens/RangeEditTab.tsx` - the notes editor block and draft state removed; stored `handNotes` are carried through a save untouched.
- `mobile/components/RangeEditor.tsx` - the “Edit hand notes →” link removed; same carry-through.
- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Overview note count removed.
- `src/practice/RecognitionDrill.tsx` / `mobile/components/practice/RecognitionDrill.tsx` - the “Your note:” line removed from miss feedback.
- `src/domain/missExplanation.ts` - `handNoteFor` removed (the explanation itself stays).
- `src/cloud/backupRepo.ts` - `handNotes` stripped from the pushed sync payload.

### Routes unregistered

- Route `notes-editor` (mobile). On web the notes editor was a block inside the Edit tab.

### Storage left behind

- `SavedRange.handNotes` stays in the storage model and survives edits and pulls, exactly like `comboSelections`.

## Import/export and backup files (`import-export-backup`)

### Moved files (original paths)

- `mobile/__tests__/action-notation.test.tsx`
- `mobile/__tests__/backup-screen.test.tsx`
- `mobile/__tests__/mixed-notation.test.tsx`
- `mobile/__tests__/range-csv.test.tsx`
- `mobile/__tests__/range-files-panel.test.tsx`
- `mobile/__tests__/range-notation.test.tsx`
- `mobile/components/ActionNotation.tsx`
- `mobile/components/BackupPanel.tsx`
- `mobile/components/MixedNotation.tsx`
- `mobile/components/RangeCsv.tsx`
- `mobile/components/RangeFilesPanel.tsx`
- `mobile/components/RangeNotation.tsx`
- `src/app/rangeFiles.test.ts`
- `src/app/rangeFiles.ts`
- `src/components/ActionNotation.test.tsx`
- `src/components/ActionNotation.tsx`
- `src/components/MixedNotation.test.tsx`
- `src/components/MixedNotation.tsx`
- `src/components/RangeNotation.css`
- `src/components/RangeNotation.test.tsx`
- `src/components/RangeNotation.tsx`
- `src/domain/base64url.test.ts`
- `src/domain/base64url.ts`
- `src/domain/mixedNotation.test.ts`
- `src/domain/mixedNotation.ts`
- `src/domain/rangeTransfer.test.ts`
- `src/domain/rangeTransfer.ts`

### Call sites edited to unhook

- `src/screens/AccountScreen.tsx` - the Data section's export/import backup, range, CSV and pack actions removed (cloud push/pull stays; reset stays).
- `src/screens/RangeScreen.tsx` - Export JSON/CSV/SVG menu items removed.
- `src/screens/RangeEditTab.tsx` - the notation panel removed.
- `mobile/app/(tabs)/account.tsx` - `BackupPanel` and `RangeFilesPanel` unmounted.
- `mobile/components/RangeEditor.tsx` - the notation and CSV panels removed.
- `mobile/app/range/[id].tsx` - Copy notation / Copy CSV / Export range file menu items removed.
- `mobile/lib/format.ts` - `safeRangeFileName` removed (only exports used it).
- `src/cssIntegrity.test.ts` - the `SVG_PALETTE` block removed with the SVG export.

### Routes unregistered

- None.

### Storage left behind

- `src/storage/backup.ts` stays (the cloud sync payload builder); only its file UI left.

## Offline share links (`offline-share-links`)

### Moved files (original paths)

- `mobile/__tests__/import-screen.test.tsx`
- `mobile/__tests__/share-link.test.ts`
- `mobile/app/import.tsx`
- `mobile/lib/shareLink.ts`

### Call sites edited to unhook

- `src/App.tsx` - the `#range=` module-load import branch removed.
- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Copy share link menu item removed.
- `mobile/app/(tabs)/library.tsx` - the Import header button removed.

### Routes unregistered

- Route `import` (mobile) and the web `#range=` hash form.

### Storage left behind

- None.

## Starter charts (`starter-charts`)

### Moved files (original paths)

- `mobile/__tests__/starter-ranges-panel.test.tsx`
- `mobile/components/StarterRangesPanel.tsx`
- `src/domain/starterRanges.test.ts`
- `src/domain/starterRanges.ts`

### Call sites edited to unhook

- `src/screens/AccountScreen.tsx` / `mobile/app/(tabs)/account.tsx` - the Add starter ranges action removed (mobile: the panel was archived after the Reset action was extracted to `mobile/components/ResetStatsPanel.tsx`).
- `src/screens/LibraryScreen.tsx` / `mobile/app/(tabs)/library.tsx` - the empty-state starter offer replaced with a Create a range CTA.
- `src/screens/TodayScreen.tsx` / `mobile/app/(tabs)/index.tsx` - the welcome-card starter offer replaced with a Create a range CTA.

### Routes unregistered

- None.

### Storage left behind

- Starter charts a user already added are ordinary saved ranges and are untouched.

## Published share links (`published-share-links`)

### Moved files (original paths)

- `mobile/__tests__/range-screen-share.test.tsx`
- `mobile/__tests__/share-pack-panel.test.tsx`
- `mobile/__tests__/shared-pack-screen.test.tsx`
- `mobile/__tests__/shared-range-screen.test.tsx`
- `mobile/app/p/[id].tsx`
- `mobile/app/r/[id].tsx`
- `mobile/components/SharePackPanel.tsx`
- `mobile/lib/useMobileSession.ts`
- `src/app/forkShared.test.ts`
- `src/app/forkShared.ts`
- `src/cloud/sharedPacksRepo.test.ts`
- `src/cloud/sharedPacksRepo.ts`
- `src/cloud/sharedRangesRepo.test.ts`
- `src/cloud/sharedRangesRepo.ts`
- `src/components/SharedPackPage.test.tsx`
- `src/components/SharedPackPage.tsx`
- `src/components/SharedPage.css`
- `src/components/SharedRangePage.test.tsx`
- `src/components/SharedRangePage.tsx`
- `src/domain/shareRoute.test.ts`
- `src/domain/shareRoute.ts`

### Call sites edited to unhook

- `src/App.tsx` - the `#/r/`/`#/p/` share-route branches and the fork handlers removed.
- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - Publish/Unpublish menu items, share status and auth gating removed.
- `src/screens/AccountScreen.tsx` - Publish/Unpublish pack actions removed; Delete cloud data now deletes the backup row only (it no longer calls `unpublishAllShared*`).
- `mobile/components/AuthPanel.tsx` - same delete-cloud-data trim.
- `mobile/platform/cryptoShim.ts` - doc comment no longer cites the shared repos.

### Routes unregistered

- Routes `r/[id]` and `p/[id]` (mobile) and the web `#/r/:id` / `#/p/:id` hash routes.

### Storage left behind

- Rows already published in `shared_ranges`/`shared_packs` are untouched - and now UNREACHABLE from the app: there is no in-app revocation until this feature is restored (flagged in TRIM-REPORT.md).

## Action and frequency overlays (`action-frequency-overlays`)

### Moved files (original paths)

- `mobile/__tests__/action-editor-screen.test.tsx`
- `mobile/__tests__/action-grid.test.tsx`
- `mobile/__tests__/action-palette.test.tsx`
- `mobile/__tests__/action-quiz-screen.test.tsx`
- `mobile/__tests__/frequency-editor-screen.test.tsx`
- `mobile/__tests__/mixed-quiz-screen.test.tsx`
- `mobile/__tests__/mixed-strategy-editor.test.tsx`
- `mobile/components/ActionGrid.tsx`
- `mobile/components/ActionPalette.tsx`
- `mobile/components/ActionsEditor.tsx`
- `mobile/components/FrequenciesEditor.tsx`
- `mobile/components/MixedStrategyEditor.tsx`
- `mobile/components/mixedStrategyStep.ts`
- `mobile/components/practice/ActionQuizDrill.tsx`
- `mobile/components/practice/MixedQuizDrill.tsx`
- `mobile/theme/actionColors.ts`
- `src/components/ActionGrid.css`
- `src/components/ActionGrid.test.tsx`
- `src/components/ActionGrid.tsx`
- `src/components/ActionPalette.css`
- `src/components/ActionPalette.test.tsx`
- `src/components/ActionPalette.tsx`
- `src/components/ActionQuiz.test.tsx`
- `src/components/ActionQuiz.tsx`
- `src/components/MixedActionQuiz.test.tsx`
- `src/components/MixedActionQuiz.tsx`
- `src/components/MixedStrategyEditor.css`
- `src/components/MixedStrategyEditor.test.tsx`
- `src/components/MixedStrategyEditor.tsx`
- `src/components/MixedStrategyGrid.css`
- `src/components/MixedStrategyGrid.test.tsx`
- `src/components/MixedStrategyGrid.tsx`
- `src/components/MultiActionEditor.css`
- `src/components/MultiActionEditor.test.tsx`
- `src/components/MultiActionEditor.tsx`
- `src/components/actionQuizShortcuts.ts`

### Call sites edited to unhook

- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Actions and Frequencies tabs removed; tabs recounted to Overview/Edit/Stats.
- `src/app/routes.ts` - `RANGE_TABS` trimmed to `overview`/`edit`/`stats`.
- `src/practice/PracticeHost.tsx` / `mobile/components/practice/PracticeHost.tsx` - the `action`/`mixed` modes, their finish handlers and per-action recording removed.
- `src/practice/ModePicker.tsx` / `mobile/components/practice/ModePicker.tsx` - the two quiz entries removed.
- `src/practice/SessionSummary.tsx` / `mobile/components/practice/SessionSummary.tsx` - the action-miss recap removed.
- `src/domain/missRecap.ts` - `recapActionMisses` removed.
- `src/components/RangePerformance.tsx` / `mobile/components/RangeStats.tsx` - the per-action accuracy block removed.
- `src/cloud/backupRepo.ts` - `handActions` and `mixedStrategies` stripped from the pushed sync payload.

### Routes unregistered

- None (both quizzes were practice-overlay modes).

### Storage left behind

- `SavedRange.handActions`/`mixedStrategies` stay in the storage model; `src/domain/actionRange.ts`, `src/domain/mixedStrategy.ts` and `src/storage/actionAccuracyStorage.ts` stay in place because storage, backup and reset still touch them. The `poker-range-trainer.action-accuracy.v1` store is orphaned on disk (still cleared by Reset, still in the backup payload).

## Daily workout (`daily-workout`)

### Moved files (original paths)

- `mobile/__tests__/workout-host.test.tsx`
- `mobile/__tests__/workout-screen.test.tsx`
- `mobile/app/workout.tsx`
- `mobile/components/practice/WorkoutHost.tsx`
- `src/domain/dailyWorkout.test.ts`
- `src/domain/dailyWorkout.ts`
- `src/practice/WorkoutHost.test.tsx`
- `src/practice/WorkoutHost.tsx`

### Call sites edited to unhook

- `src/App.tsx` - the workout overlay, `onStartWorkout` wiring and the workout/practice Back-handler pairing removed.
- `src/screens/TodayScreen.tsx` / `mobile/app/(tabs)/index.tsx` - the workout card and its done-state removed; Start review is always the primary CTA again.

### Routes unregistered

- Route `workout` (mobile). On web the workout was a full-screen overlay.

### Storage left behind

- `src/storage/workoutStorage.ts` stays in place (`statsReset` still clears `poker-range-trainer.workout.v1`); the key is otherwise orphaned and remains OUTSIDE the backup payload, as before.

## Play the spot and coverage map (`play-the-spot`)

### Moved files (original paths)

- `mobile/__tests__/new-range-prefill.test.tsx`
- `mobile/__tests__/spot-coverage.test.tsx`
- `mobile/__tests__/spot-drill.test.tsx`
- `mobile/components/SpotCoverage.tsx`
- `mobile/components/practice/SpotDrill.tsx`
- `src/components/SpotCoverage.test.tsx`
- `src/components/SpotCoverage.tsx`
- `src/domain/scenarioParams.test.ts`
- `src/domain/scenarioParams.ts`
- `src/domain/seatAccuracy.test.ts`
- `src/domain/seatAccuracy.ts`
- `src/domain/spotCoverage.test.ts`
- `src/domain/spotCoverage.ts`
- `src/domain/spotDrill.test.ts`
- `src/domain/spotDrill.ts`
- `src/domain/spotLeaks.test.ts`
- `src/domain/spotLeaks.ts`
- `src/practice/SpotDrill.test.tsx`
- `src/practice/SpotDrill.tsx`

### Call sites edited to unhook

- `src/App.tsx` - `onPlaySpots`/`onDrillSpot` wiring and the `spots` request fields removed.
- `src/screens/TodayScreen.tsx` / `mobile/app/(tabs)/index.tsx` - the Play-the-spot card removed.
- `src/screens/LibraryScreen.tsx` / `mobile/app/(tabs)/library.tsx` - the coverage map footer removed.
- `src/screens/ProgressScreen.tsx` / `mobile/app/(tabs)/progress.tsx` - the Weakest spots section removed; per rule 3 the seat-accuracy and action-accuracy (“Where you leak”) section went with it.
- `src/practice/PracticeHost.tsx` / `mobile/components/practice/PracticeHost.tsx` - the `spots` mode, `finishSpots` and spot-accuracy recording removed.
- `mobile/app/practice.tsx` - the `spots` mode and its `table`/`stack`/`spot` params removed; `edges` added to the accepted modes (it was missing).
- `src/app/routes.ts` / `mobile/app/range/new.tsx` - the scenario-prefill plumbing removed (the coverage map was its only producer).

### Routes unregistered

- None (the spot drill was a practice-overlay mode).

### Storage left behind

- `src/domain/spot.ts` and `src/storage/spotAccuracyStorage.ts` stay in place (backup and reset still touch them). The `poker-range-trainer.spot-accuracy.v1` store is orphaned on disk (still cleared by Reset, still in the backup payload).

## Cloud accounts and sync (`cloud-sync`)

Cut after the trim, for the v1 launch (2026-08-06): accounts, push/pull sync and delete-cloud-data are out of v1 entirely.
Restoring also needs the dependencies back: `@supabase/supabase-js` in BOTH the root and `mobile/` `package.json` (the mobile copy plus the `mobile/tsconfig.json` path mapping keep the two installs' types from conflicting), and `react-native-url-polyfill` in `mobile/` with its `import 'react-native-url-polyfill/auto'` first in `mobile/app/_layout.tsx` (Supabase needs a WHATWG `URL` on Hermes).

### Moved files (original paths)

- `mobile/__tests__/auth-screen.test.tsx`
- `mobile/__tests__/cloud-env.test.ts`
- `mobile/__tests__/supabase-client.test.ts`
- `mobile/components/AuthPanel.tsx`
- `mobile/platform/cloudEnv.ts`
- `mobile/platform/supabaseClient.ts`
- `mobile/types/import-meta.d.ts` (existed only so `@core/cloud/cloudConfig`'s `import.meta.env` read type-checked under the mobile tsconfig)
- `src/cloud/auth.test.ts`
- `src/cloud/auth.ts`
- `src/cloud/backupRepo.test.ts`
- `src/cloud/backupRepo.ts`
- `src/cloud/cloudConfig.test.ts`
- `src/cloud/cloudConfig.ts`
- `src/cloud/rangesRepo.test.ts`
- `src/cloud/rangesRepo.ts`
- `src/cloud/supabaseClient.test.ts`
- `src/cloud/supabaseClient.ts`
- `src/cloud/useAuthSession.test.ts`
- `src/cloud/useAuthSession.ts`
- `src/components/AuthPanel.css`
- `src/components/AuthPanel.test.tsx`
- `src/components/AuthPanel.tsx`
- `src/screens/AccountScreen.cloud.test.tsx`

### Call sites edited to unhook

- `src/screens/AccountScreen.tsx` - the Cloud section (AuthPanel, push/pull/delete-cloud-data handlers, sync status) removed; the Data section with the practice-record reset stays.
- `src/screens/AccountScreen.test.tsx` - the cloud-gating test ("local-only note when cloud is not configured") replaced with a no-cloud-actions assertion.
- `mobile/app/(tabs)/account.tsx` - `AuthPanel` and its divider unmounted; `ResetStatsPanel` stays.
- `mobile/app/_layout.tsx` - the `react-native-url-polyfill/auto` import removed (it existed only for Supabase on Hermes; nothing else in `mobile/` constructs a WHATWG `URL`).
- `src/vite-env.d.ts` - the `VITE_SUPABASE_*` typings removed from `ImportMetaEnv`.
- `mobile/tsconfig.json` - the `@supabase/supabase-js` path mapping removed.
- `.env.example` - the Supabase variables removed (web read `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; mobile read `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- Dependencies dropped: `@supabase/supabase-js` (root and `mobile/`), `react-native-url-polyfill` (`mobile/`).

### Routes unregistered

- None (all cloud UI lived inside the two Account screens).

### Storage left behind

- The Supabase auth session a signed-in device persisted (`sb-<project-ref>-auth-token` in web `localStorage` / the MMKV-backed shim on mobile) is orphaned; nothing reads or clears it.
- Server-side rows (`backups`, and the pre-trim `shared_ranges`/`shared_packs`) are out of the app's reach entirely - see LAUNCH-CHECKLIST.md "Your steps" step 1 for retiring the live Supabase project.
- `src/storage/backup.ts` (`buildBackup`/`restoreBackup`) stays in place: the restored JSON backup feature uses it.

## Range thumbnails and accuracy heatmap (`range-thumbnails-heatmap`)

### Moved files (original paths)

- `mobile/__tests__/hand-heatmap.test.tsx`
- `mobile/__tests__/range-thumbnail.test.tsx`
- `mobile/components/HandHeatmap.tsx`
- `mobile/components/RangeThumbnail.tsx`
- `src/components/HandHeatmap.css`
- `src/components/HandHeatmap.test.tsx`
- `src/components/HandHeatmap.tsx`
- `src/components/RangeThumbnail.test.tsx`
- `src/components/RangeThumbnail.tsx`

### Call sites edited to unhook

- `src/screens/LibraryScreen.tsx` / `mobile/app/(tabs)/library.tsx` - row thumbnails removed.
- `src/screens/TodayScreen.tsx` / `mobile/app/(tabs)/index.tsx` - due-row thumbnails removed.
- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Overview grid preview removed.
- `src/components/RangePerformance.tsx` / `mobile/components/RangeStats.tsx` - the accuracy heatmap (and its legend) removed from the Stats tab.

### Routes unregistered

- None.

### Storage left behind

- None.

## Tags and source reference (`tags-source-reference`)

### Moved files (original paths)

- `mobile/__tests__/range-tag-editor.test.tsx`
- `mobile/components/RangeTagEditor.tsx`
- `src/components/RangeTagEditor.css`
- `src/components/RangeTagEditor.test.tsx`
- `src/components/RangeTagEditor.tsx`
- `src/domain/sourceReference.test.ts`
- `src/domain/sourceReference.ts`

### Call sites edited to unhook

- `src/screens/LibraryScreen.tsx` / `mobile/app/(tabs)/library.tsx` - the tag filter, tag chips and tag search removed.
- `src/domain/rangeLibrary.ts` - `filterRangesByTag`/`collectRangeTags` removed; `filterRangesBySearch` no longer matches tags (`normalizeTags` stays for storage).
- `src/app/libraryView.ts` - the remembered `tag` filter removed from the view.
- `src/screens/RangeEditTab.tsx` / `mobile/components/RangeEditor.tsx` - the tag editor removed.
- `src/components/RangeMetadataEditor.tsx` - the Source kind and Reference fields removed (mobile's metadata editor never carried them; its source UI lived on the archived range-page Overview).
- `src/screens/RangeScreen.tsx` / `mobile/app/range/[id].tsx` - the Overview source line removed.
- `src/cloud/backupRepo.ts` - `tags` stripped from the pushed sync payload.

### Routes unregistered

- None.

### Storage left behind

- `SavedRange.tags` and `SavedRange.source` stay in the storage model and survive edits (both editors carry them through a save untouched).

