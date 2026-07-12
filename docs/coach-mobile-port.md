# Coach mobile port progress

State file for porting the shipped web "Coach" UI to the mobile app (`mobile/`, Expo + React Native).
Spec: `prompts/002-coach-mobile-port.md`. Web reference: `src/` (commits `ebbadb4..f94f658`), mapped in `docs/coach-ui-refactor.md`.
Update this every slice so a future session can resume.

## Milestones

- [x] 1. Design system: light + dark Coach palettes, `useTheme()` (driven by `useColorScheme()`), `actionColors(theme)`, fonts (Bricolage Grotesque + Instrument Sans) loaded in `_layout`, `userInterfaceStyle: automatic`. Old screens still working.
- [x] 2. Tab shell + routing skeleton: `(tabs)` group (Today / Library / Progress / Account), stack routes for range page + practice modal, existing screens reachable during transition.
- [x] 3. Today screen (streak chip, Start review CTA, due list, week tiles, empty states).
- [x] 4. Library screen (search, filters/sorts, favorites/archived, thumbnail rows -> Range page, New range).
- [x] 5. Range page with tabs (Overview / Edit / Actions / Combos / Frequencies / Stats) + overflow menu. (Cloud publish/unpublish + deep-link share + `range/new` deferred to M8 cloud/cleanup.)
- [ ] 6. Practice overlay + all modes (recognition/build/timed/mistakes/action/frequency/combo/postflop/board), session summary ring, shared recorder.
- [ ] 7. Progress screen (tiles, 7-day bar chart, analytics, weakest hands "Drill these").
- [ ] 8. Account + deep-link viewers restyle, delete dead flat routes/styles, polish pass vs the psychology checklist, app.json icon/splash colors.

## Where things live (target)

- Tokens + `useTheme`: `mobile/theme/colors.ts` (`light`, `dark`, `ThemeColors`, `useTheme`). Action colors: `mobile/theme/actionColors.ts` (`actionColors(theme)`).
- Fonts: loaded via `useFonts` in `mobile/app/_layout.tsx`; splash held until loaded.
- Routing: `mobile/app/(tabs)/` + `range/[id]`, `range/new`, practice modal, `r/[id]`, `p/[id]`.

## Notes / decisions

- Do NOT touch the web app (`src/`, `index.html`, `public/`). `@core/*` is a stable API consumed via alias (tsconfig/metro/jest).
- Platform seams kept intact: `mobile/platform/*`, `mobile/coresrc -> ../src` symlink.
- Toolchain pins: Expo SDK 56, react EXACTLY 19.2.3, RNTL v14 (async render; `await` before querying).
- Validate each slice: `cd mobile && npm run lint && npm run typecheck && npm run test:run`; `npm run bundle-check` at milestone boundaries.
- Env: npm/npx/expo installs and `git push` need the sandbox disabled.
- On-device visual QA is PENDING: the app uses native-only modules (MMKV, gesture-handler, haptics), so Expo web can't faithfully render it and no iOS simulator is available in this environment. Each slice is gated on typecheck + lint + test:run + `expo export` (bundle-check); a real light/dark simulator pass should be done at M8 / by the user.

## Status log

- (init) Progress file created; repo mapped.
- M1 done: `theme/colors.ts` (light/dark/`ThemeColors`/`useTheme`), `theme/actionColors.ts` (`actionColors(theme)` + legacy static kept), `theme/fonts.ts`, fonts loaded via `useFonts` in `_layout` (splash held via `expo-router`'s `SplashScreen`, no new dep), `app.json` `userInterfaceStyle: automatic` + `expo-font` plugin, `theme.test.ts` locks both palettes. Legacy `colors`/`ACTION_COLORS` kept for un-ported flat screens (removed at M8). lint+typecheck+test:run+bundle-check green.
- M2 done: `app/(tabs)/_layout.tsx` (Tabs, `headerShown:false`, themed bar, View-drawn icons in `components/TabBarIcons.tsx`); `(tabs)/index` (Today), `progress`, `account` placeholders (themed, Account links to `/auth`+`/backup`); library relocated `app/index.tsx` -> `app/(tabs)/library.tsx` (in-content header, still legacy-dark, rewritten at M4); root `_layout` hides header for `(tabs)`, StatusBar `auto`; shared `components/Screen.tsx` (safe-area top inset); `jest.setup.js` mocks `react-native-safe-area-context` (`setupFilesAfterEnv`); eslint override for the setup file. All flat routes still reachable. Validation + bundle-check green.
- M5 done (a-d): Range page `app/range/[id].tsx` — themed shell (back to Library, name, metadata chips, gold Practice -> `/practice-modes`, overflow menu), horizontally-scrolling segmented tabs, and all six tabs inline: Overview (thumbnail + facts + recent sessions), Edit (`components/RangeEditor.tsx`, extracted from `editor.tsx`; combo refinement kept here), Actions (`ActionsEditor`), Combos (`ComboExplorer`), Frequencies (`FrequenciesEditor`), Stats (`RangeStats`: heatmap + legend + weak hands + "Practice weak hands" + per-action + history). Flat editor/action-editor/frequency-editor/combos screens are now thin wrappers around the shared components (kept + green until M8). Overflow menu: duplicate/favorite/archive/compare/copy-notation/copy-CSV(clipboard)/delete. Library rows -> `/range/[id]`. DEFERRED to M8: cloud publish/unpublish + deep-link share (needs cloud/auth consolidation), `range/new` (New range still -> `/editor`), re-theming the shared editor components + heatmap onto Coach tokens (matches the web's own M8 sequencing). All green + bundle-check.
- M4 done: `(tabs)/library.tsx` rewritten to the Coach design (title + gold "New range", always-visible search, collapsible "Filters (N)" with Sort/Position/Action/Stack/Game segmented groups + favorites-only/show-archived toggles, thumbnail rows w/ name+★+chips[position vs / action / size% / Due / Archived]+accuracy/last-practiced, FlatList). Shared `components/ui.tsx` (`Chip`, `Segmented`, both themed, non-gold selection). Rows link to `/editor?id=` transitionally; rewired to `range/[id]` + `range/new` at M5. Library test rewritten to the new IA (findByTestId for the async collapsible). All green + bundle-check.
- M3 done: `(tabs)/index.tsx` is the real Today screen (date + greeting in display font, streak chip w/ grace explained via tap-Alert, Today's-review CTA gold Start review, Due-now rows w/ thumbnail+accuracy+last-practiced+Review, three week tiles, onboarding + all-caught-up empty states; reloads on focus). `components/RangeThumbnail.tsx` (View grid, gold-on-well), `lib/format.ts` (port of web `src/app/format.ts`, name-table dates). Start review / Review wired to existing `/practice?id=` transitionally (M6 adds the real multi-range queue). Tests: today-screen, format, range-thumbnail. All green + bundle-check.
