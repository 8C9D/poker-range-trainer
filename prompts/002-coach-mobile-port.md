# Port the "Coach" UI to the mobile app

## Mission and authorization

Restructure the entire mobile app UI/UX (`mobile/`, Expo + React Native) to the "Coach" design that
already shipped on the web app: a training-first shell that opens on "what's due today" with one
primary action, native bottom tabs (Today / Library / Progress / Account), a tabbed per-range page,
and a full-screen practice overlay with playing-card prompts.
This prompt is explicit authorization for that large UI refactor.

The web app is the reference implementation - it shipped this exact design in commits
`ebbadb4..f94f658`. Read `docs/coach-ui-refactor.md` first: it maps the web architecture
(`src/app/` routing+shell, `src/screens/`, `src/practice/` overlay, tokens in `src/theme.css`).
Mirror its decisions unless a native pattern is clearly better; visual parity with the web app in
both themes is the goal.

Constraints:

- Mobile app only. Do NOT touch the web app (`src/`, `index.html`, `public/`) - everything you
  need from the core already exists and is consumed via the `@core/*` alias.
- Zero feature loss. Every capability in the "Mobile feature inventory" below must exist in the
  new IA.
- `@core` (repo `src/domain|storage|types|cloud`) is a stable API. The Coach-era helpers you need
  are already there: `@core/domain/weeklyStats` (`summarizeWeek`, `dailyHandCounts`),
  `@core/domain/weakHands` (`rankWeakHands`, `weakHandPools`), `@core/domain/spacedRepetition`
  (`selectDueRanges`, `currentStreak` - one-day grace built in).
- Keep every platform seam intact: `mobile/platform/` (MMKV localStorage shim installed in
  `app/_layout.tsx` before any storage import, crypto polyfill, `cloudEnv`, RN Supabase client),
  the `mobile/coresrc -> ../src` symlink, and the `@core` mappings in `tsconfig.json`,
  `metro.config.js`, and `jest.config.js`.
- Toolchain pins (do not "upgrade" past them): Expo SDK 56, `react` EXACTLY `19.2.3` (RN 0.85.3
  renderer exact-match, enforced via package.json `overrides`), RNTL v14 (async render - queries
  populate only after `await`; screen tests use `userEvent` + `waitFor`).
- The only new dependencies allowed: `expo-font`, `@expo-google-fonts/bricolage-grotesque`,
  `@expo-google-fonts/instrument-sans`. Use built-in `Animated` for the summary ring (no
  reanimated). Install with `npx expo install` so versions match SDK 56.
- Keep the deep-link viewers (`app/r/[id].tsx`, `app/p/[id].tsx`, scheme `pokerrangetrainer://`)
  working, restyled to the new design.
- Keep swipe-to-answer (`react-native-gesture-handler`) and haptics (`expo-haptics`) in the drills.

## Design system (port of web `src/theme.css`)

Replace `mobile/theme/colors.ts`'s single dark palette with light + dark Coach palettes and a
`useTheme()` hook driven by `useColorScheme()`. Set `"userInterfaceStyle": "automatic"` in
`app.json`. Tokens (identical to web):

```ts
export const light = {
  bg: '#efede6', surface: '#f7f6f1', card: '#ffffff', well: '#eceade',
  line: '#dfdcd0', line2: '#cfccbe',
  ink: '#22252a', ink2: '#66696a', ink3: '#94958f',
  accent: '#a97e14', accentStrong: '#8a6608', accentSoft: '#a97e1420', onAccent: '#241c05',
  goldFill: '#d9ab33',                                  // selected cells, primary buttons, bars
  raise: '#c2502f', call: '#2e8a5c', bet3: '#7261c9',   // action colors, CVD-validated
  good: '#2e8a5c', bad: '#c2502f',
  heart: '#c2502f', diamond: '#3a76c9', club: '#2e8a5c', spade: '#22252a', // 4-color deck
  h1c: '#ecdfb6', h2c: '#d3ab4d', h3c: '#8a6608',       // accuracy heat: low / mid / high
  pairbg: '#efede4', cellbg: '#f1efe8', cardface: '#fffef9',
}
export const dark = {
  bg: '#101316', surface: '#16191c', card: '#1e2227', well: '#121518',
  line: '#2a2f35', line2: '#3a4048',
  ink: '#e9eaec', ink2: '#9aa1a8', ink3: '#6d747b',
  accent: '#e2b64d', accentStrong: '#efc75f', accentSoft: '#e2b64d1f', onAccent: '#241c05',
  goldFill: '#d9ab33',
  raise: '#e0603c', call: '#35a068', bet3: '#8f7ae0',
  good: '#35a068', bad: '#e0603c',
  heart: '#e0603c', diamond: '#6d9fe8', club: '#35a068', spade: '#22252a',
  h1c: '#4a3c1c', h2c: '#8a6a24', h3c: '#d9b04a',
  pairbg: '#23272d', cellbg: '#1b1f24', cardface: '#f4f1e8',
}
```

Re-point `mobile/theme/actionColors.ts` at the tokens: `raise` -> `raise`, `call` -> `call`,
`threeBet` -> `bet3`; derive the rest as muted variants; keep the `Record<RangeAction, string>`
shape.

Fonts: Bricolage Grotesque (display: headings, hero numbers) + Instrument Sans (UI/body), loaded
with `useFonts` in `app/_layout.tsx` (splash held until loaded). Use
`fontVariant: ['tabular-nums']` wherever digits align (stats, counts, percentages).

Component language: cards with 13-16px radius and 1px `line` borders on `surface`; pill chips;
one segmented-control style; primary buttons `goldFill` with `onAccent` text; ghost buttons
bordered. Grid cells `cellbg` (`pairbg` on the pair diagonal), selected = `goldFill` with dark
text, 2px gaps. Card prompts: `cardface` faces with 4-color-deck suit colors. Animations
100-300ms; respect `AccessibilityInfo.isReduceMotionEnabled`.

## Information architecture (Expo Router)

Restructure `app/` into a `(tabs)` group with native bottom tabs - Today, Library, Progress,
Account - plus stack/modal routes:

- `(tabs)/index` -> **Today** (default route)
- `(tabs)/library` -> **Library**; `range/[id]` (stack) -> the per-range page; `range/new` -> new-range editor
- `(tabs)/progress` -> **Progress**
- `(tabs)/account` -> **Account**
- **Practice** runs as a full-screen modal (or state-driven overlay) above everything
- `r/[id]` and `p/[id]` stay as standalone deep-link routes

Fold the existing 21 flat routes into that IA (nothing may be lost):

| Existing route | New home |
|---|---|
| `index.tsx` (library home) | Library tab |
| `editor.tsx` | Range page -> Edit tab (and `range/new`) |
| `action-editor.tsx` | Range page -> Actions tab |
| `frequency-editor.tsx` | Range page -> Frequencies tab |
| `notes-editor.tsx` | Range page -> Edit tab (per-hand notes section) |
| `practice-modes.tsx` | Practice overlay mode picker |
| `practice.tsx`, `build.tsx`, `timed.tsx`, `action-quiz.tsx`, `mixed-quiz.tsx`, `blocker-drill.tsx`, `postflop.tsx` | Practice overlay modes |
| `board.tsx` (explorer) | Practice mode picker entry ("Range vs board") |
| `combos.tsx` (combo explorer) | Range page -> Combos tab |
| `diff.tsx` | Range page overflow menu -> Compare |
| `auth.tsx`, `backup.tsx` | Account tab |
| `r/[id].tsx`, `p/[id].tsx` | unchanged routes, restyled |

### Screen specs (match the web implementation in `src/screens/` and `src/practice/`)

1. **Today**: date line, time-of-day greeting (display font), streak chip (flame + "N days";
   copy mentions the one-day grace honestly). Primary CTA card "Today's review - N ranges due ·
   ~X min" with the gold **Start review** button running a queued recognition drill through all
   due ranges (`selectDueRanges`). "Due now" rows: grid thumbnail, name, last accuracy, last
   practiced, per-row Review button. Three "this week" tiles from `summarizeWeek`: hands answered,
   accuracy, sharpest range. Empty states: no ranges -> onboarding pointing to Library; nothing
   due -> "All caught up" + free-practice shortcut.
2. **Library**: search always visible; position/action/game(/stack) filters + sorts
   (name/edited/practiced/accuracy) + favorites-only/show-archived in a compact collapsible;
   rows = 13x13 thumbnail (gold on `well`), name, chips (position, action, size %, Due),
   accuracy + last practiced on the right; rows push the Range page; "New range" button.
3. **Range page**: header with back, name, metadata chips, gold **Practice** button, overflow
   menu (duplicate, favorite, archive, delete, notation/CSV export via clipboard/share, deep-link
   share, cloud publish/unpublish, compare). Segmented tabs, reusing the existing editors'
   logic: **Overview** (read-only grid, size/combos/%, next review, last session, recent
   sessions), **Edit** (grid + drag-paint, shortcuts, notation, metadata, per-hand notes),
   **Actions**, **Combos** (selection refinement + explorer), **Frequencies**, **Stats**
   (accuracy heatmap with heat tokens + Untested/<50/50-79/80+ legend, weakest hands,
   "Practice weak hands" mistakes pool, per-action accuracy, session history).
4. **Practice overlay**: mode picker listing only valid modes (recognition, build-from-memory,
   timed with 30/60/120s, mistakes-only, action quiz if `handActions`, frequency quiz if
   `mixedStrategies`, combo drill, postflop drill, range-vs-board). Recognition-style drills:
   top bar = close + progress bar + range name (+ "k/N" in a queue); two concrete playing cards
   (same suit for suited, different for offsuit/pairs - deal via
   `@core/domain/blockerPractice.drawPracticeCombo([hand])`); scenario line and answer verbs
   ported from web `src/practice/scenario.ts` (the range's action verb vs Fold, fixed positions,
   44px+ targets); swipe + haptics kept. 20-question sessions; feedback instant, colored,
   explanatory ("A9s isn't in this range - fold it"); hits advance after ~900ms, misses hold
   ~1600ms. Session end: animated accuracy ring, count line, delta vs the range's previous
   session (growth-framed; below-usual sessions say the misses are queued, never shame), streak
   line, Done/Next-range. Record through the shared recorder pattern (port web
   `src/app/sessionRecording.ts` into the mobile layer or a shared helper): practice stats,
   per-hand accuracy, session history, review scheduling; action quiz records per-action
   accuracy. Closing with zero answers records NOTHING (web behavior).
5. **Progress**: streak / 30-day accuracy / all-time hands tiles; 7-day gold bar chart
   (`dailyHandCounts`, today emphasized); library-wide analytics; weakest hands across ranges
   with "Drill these" (per-range pools via `weakHandPools`).
6. **Account**: auth (sign up/in/out), push/pull sync with confirm-before-overwrite, delete
   cloud data, file backup export/import, CSV/pack import if present today, local-only note when
   Supabase env is unset. Same gating as today.

## Psychology acceptance criteria (check every screen)

1. Exactly one gold primary action per screen; everything else quiet.
2. Drill answer buttons never move or resize between hands; 44pt+ touch targets.
3. A range is always listed with its grid thumbnail; icons always have labels.
4. Every answer scores instantly; every miss explains why; misses dwell longer than hits.
5. Drills are short with an always-visible progress bar.
6. Sessions end on the ring + improvement delta, growth-framed.
7. Gold is reserved for "your next action" - never decoration.
8. Transitions 100-300ms; respect reduce-motion.
9. Stats in groups of three; metadata as chips.
10. No dark patterns: drills offered never forced, streak grace visible, the due queue is the
    real spaced-repetition schedule and nothing else.

## Process

- Read the repo root `CLAUDE.md` and follow it (work on main, small reversible slices, push after
  every commit - standing authorization, one-sentence commit messages, no AI attribution, no
  ticket IDs).
- Validate every slice with `cd mobile && npm run lint && npm run typecheck && npm run test:run`
  and (at least at milestone boundaries) `npm run bundle-check`. Also run the web checks at repo
  root (`npm run lint && npm run test:run && npm run build`) whenever anything outside `mobile/`
  changes - it shouldn't. Fix root causes; never weaken a test. Rewrite screen tests to the new
  IA as flows move (there are 47 mobile test files; keep the platform/parity/config ones green
  untouched).
- Environment notes: npm/npx/expo installs and exports need the sandbox disabled (npm cache), and
  `git push` needs the sandbox disabled (credential helper). RNTL v14 renders async under React
  19 - `await` before querying.
- Create `docs/coach-mobile-port.md` as your progress checklist/state file (mirroring this spec);
  update it every slice so a future session can resume. Do NOT touch `docs/ios-roadmap.md`,
  `docs/ios-roadmap-progress.md`, or `docs/roadmap-progress.md` (machine-owned by other skills).
- Suggested milestones: (1) tokens + fonts + useTheme + automatic light/dark, old screens still
  working; (2) tab shell + routing skeleton, existing screens reachable; (3) Today; (4) Library;
  (5) Range page tabs; (6) Practice overlay + all modes; (7) Progress; (8) Account + deep-link
  viewers restyle, delete dead screens/styles, polish pass against the psychology checklist.
- Definition of done: old flat-route layout gone (only the new IA + `r/[id]`/`p/[id]` remain);
  every inventory item reachable; both themes correct; `app.json` icon/splash colors consistent
  with the new palette (the real icon artwork remains a separate pending design decision);
  all validation green.

## Mobile feature inventory (nothing may be lost)

Editor: 13x13 tap + drag-paint grid, live auto-save, name + scenario metadata
(position/action/stack/game), shortcut buttons, clear, live hands/combos/% stats, notation
import/export via clipboard, CSV import/export, multi-action editor + action notation,
mixed-frequency editor + mixed notation, per-hand notes, per-hand combo selection.
Library: search, position/action/game filters, recent/name/practiced/accuracy sorts, favorite +
favorites-only, archive + show-archived, duplicate, delete with confirm, per-card practice stats,
due badge, streak.
Practice: recognition (swipe + haptics, mistakes review, mistakes-only pool), build-from-memory,
timed drill, action quiz, mixed-frequency quiz, blocker-aware combo drill, postflop decision
practice, board explorer (texture + range-vs-board), combo explorer, range diff.
Tracking: per-range stats, per-hand accuracy + heatmap, weakest hands, per-action accuracy,
session history, spaced repetition (due queue, streak with grace).
Cloud/data: Supabase auth, push/pull library sync, delete cloud data, file backup export/import,
shared range/pack deep-link viewers with "Add to my library", local-only mode.
Platform: MMKV-backed storage shim (web-compatible keys), crypto polyfill, error boundary, iOS
privacy manifest, EAS build/submit profiles.
