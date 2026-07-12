# Coach mobile port progress

State file for porting the shipped web "Coach" UI to the mobile app (`mobile/`, Expo + React Native).
Spec: `prompts/002-coach-mobile-port.md`. Web reference: `src/` (commits `ebbadb4..f94f658`), mapped in `docs/coach-ui-refactor.md`.
Update this every slice so a future session can resume.

## Milestones

- [x] 1. Design system: light + dark Coach palettes, `useTheme()` (driven by `useColorScheme()`), `actionColors(theme)`, fonts (Bricolage Grotesque + Instrument Sans) loaded in `_layout`, `userInterfaceStyle: automatic`. Old screens still working.
- [ ] 2. Tab shell + routing skeleton: `(tabs)` group (Today / Library / Progress / Account), stack routes for range page + practice modal, existing screens reachable during transition.
- [ ] 3. Today screen (streak chip, Start review CTA, due list, week tiles, empty states).
- [ ] 4. Library screen (search, filters/sorts, favorites/archived, thumbnail rows -> Range page, New range).
- [ ] 5. Range page with tabs (Overview / Edit / Actions / Combos / Frequencies / Stats) + overflow menu.
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

## Status log

- (init) Progress file created; repo mapped.
- M1 done: `theme/colors.ts` (light/dark/`ThemeColors`/`useTheme`), `theme/actionColors.ts` (`actionColors(theme)` + legacy static kept), `theme/fonts.ts`, fonts loaded via `useFonts` in `_layout` (splash held via `expo-router`'s `SplashScreen`, no new dep), `app.json` `userInterfaceStyle: automatic` + `expo-font` plugin, `theme.test.ts` locks both palettes. Legacy `colors`/`ACTION_COLORS` kept for un-ported flat screens (removed at M8). lint+typecheck+test:run+bundle-check green.
