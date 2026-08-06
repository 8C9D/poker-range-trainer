# Restoring an archived feature

Each section lists what `git mv` moved (restore by moving the file back to the path shown, i.e. strip the `archived/<slug>/` prefix), the call sites that were edited to unhook the feature, the routes that were unregistered, and the storage left behind.
The authoritative pre-trim snapshot is the tag `pre-trim-full-featureset` (branch `archive/full-featureset`); diff a restored file against it to recover any call-site wiring this file under-describes.
`archived/` is excluded from typecheck (`tsconfig.app.json`, `mobile/tsconfig.json`), lint (both `eslint.config.js`), tests (`vitest.config.ts`, `mobile/jest.config.js`), Metro (`blockList` in `mobile/metro.config.js`) and EAS uploads (root `.easignore`); when restoring, no exclusion change is needed because restored files leave `archived/`.

## Postflop tools (`postflop-tools`)

### Moved files (original paths)

- `mobile/__tests__/board-screen.test.tsx`
- `mobile/__tests__/postflop-drill.test.ts`
- `mobile/app/board.tsx`
- `mobile/app/postflop.tsx`
- `mobile/components/postflopDrill.ts`
- `src/components/FlopTexture.test.tsx`
- `src/components/FlopTexture.tsx`
- `src/components/PostflopDrillSetup.test.tsx`
- `src/components/PostflopDrillSetup.tsx`
- `src/components/PostflopPractice.test.tsx`
- `src/components/PostflopPractice.tsx`
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

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Range compare (`range-compare`)

### Moved files (original paths)

- `mobile/__tests__/diff-screen.test.tsx`
- `mobile/app/diff.tsx`
- `src/components/RangeDiffView.test.tsx`
- `src/components/RangeDiffView.tsx`
- `src/domain/rangeDiff.test.ts`
- `src/domain/rangeDiff.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

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
- `src/components/ComboBlockerDrill.test.tsx`
- `src/components/ComboBlockerDrill.tsx`
- `src/components/ComboSelector.test.tsx`
- `src/components/ComboSelector.tsx`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Per-hand notes (`per-hand-notes`)

### Moved files (original paths)

- `mobile/__tests__/notes-editor-screen.test.tsx`
- `mobile/app/notes-editor.tsx`
- `src/components/HandNotesEditor.test.tsx`
- `src/components/HandNotesEditor.tsx`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

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
- `src/components/RangeNotation.test.tsx`
- `src/components/RangeNotation.tsx`
- `src/domain/base64url.test.ts`
- `src/domain/base64url.ts`
- `src/domain/mixedNotation.test.ts`
- `src/domain/mixedNotation.ts`
- `src/domain/rangeTransfer.test.ts`
- `src/domain/rangeTransfer.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Offline share links (`offline-share-links`)

### Moved files (original paths)

- `mobile/__tests__/import-screen.test.tsx`
- `mobile/__tests__/share-link.test.ts`
- `mobile/app/import.tsx`
- `mobile/lib/shareLink.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Starter charts (`starter-charts`)

### Moved files (original paths)

- `RM mobile/__tests__/starter-ranges-panel.test.tsx`
- `RM mobile/components/StarterRangesPanel.tsx`
- `src/domain/starterRanges.test.ts`
- `src/domain/starterRanges.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Published share links (`published-share-links`)

### Moved files (original paths)

- `mobile/__tests__/range-screen-share.test.tsx`
- `mobile/__tests__/share-pack-panel.test.tsx`
- `mobile/__tests__/shared-pack-screen.test.tsx`
- `mobile/__tests__/shared-range-screen.test.tsx`
- `mobile/app/p/[id].tsx`
- `mobile/app/r/[id].tsx`
- `mobile/components/SharePackPanel.tsx`
- `src/app/forkShared.test.ts`
- `src/app/forkShared.ts`
- `src/cloud/sharedPacksRepo.test.ts`
- `src/cloud/sharedPacksRepo.ts`
- `src/cloud/sharedRangesRepo.test.ts`
- `src/cloud/sharedRangesRepo.ts`
- `src/components/SharedPackPage.test.tsx`
- `src/components/SharedPackPage.tsx`
- `src/components/SharedRangePage.test.tsx`
- `src/components/SharedRangePage.tsx`
- `src/domain/shareRoute.test.ts`
- `src/domain/shareRoute.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

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
- `src/components/ActionGrid.test.tsx`
- `src/components/ActionGrid.tsx`
- `src/components/ActionPalette.test.tsx`
- `src/components/ActionPalette.tsx`
- `src/components/ActionQuiz.test.tsx`
- `src/components/ActionQuiz.tsx`
- `src/components/MixedActionQuiz.test.tsx`
- `src/components/MixedActionQuiz.tsx`
- `src/components/MixedStrategyEditor.test.tsx`
- `src/components/MixedStrategyEditor.tsx`
- `src/components/MixedStrategyGrid.test.tsx`
- `src/components/MixedStrategyGrid.tsx`
- `src/components/MultiActionEditor.test.tsx`
- `src/components/MultiActionEditor.tsx`
- `src/components/actionQuizShortcuts.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

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

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Play the spot and coverage map (`play-the-spot`)

### Moved files (original paths)

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

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Range thumbnails and accuracy heatmap (`range-thumbnails-heatmap`)

### Moved files (original paths)

- `mobile/__tests__/hand-heatmap.test.tsx`
- `mobile/__tests__/range-thumbnail.test.tsx`
- `mobile/components/HandHeatmap.tsx`
- `mobile/components/RangeThumbnail.tsx`
- `src/components/HandHeatmap.test.tsx`
- `src/components/HandHeatmap.tsx`
- `src/components/RangeThumbnail.test.tsx`
- `src/components/RangeThumbnail.tsx`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

## Tags and source reference (`tags-source-reference`)

### Moved files (original paths)

- `mobile/__tests__/range-tag-editor.test.tsx`
- `mobile/components/RangeTagEditor.tsx`
- `src/components/RangeTagEditor.test.tsx`
- `src/components/RangeTagEditor.tsx`
- `src/domain/sourceReference.test.ts`
- `src/domain/sourceReference.ts`

### Call sites edited to unhook

TODO(phase 2/3)

### Routes unregistered

TODO(phase 4)

### Storage left behind

TODO

