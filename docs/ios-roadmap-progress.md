# iOS roadmap slice progress

State file for the [`build-ios-app`](../.claude/skills/build-ios-app/SKILL.md)
skill. The skill reads this file on every invocation to find the next slice to
build, and rewrites it as part of each committed slice. You can hand-edit the
**Next slice** prompt below to steer what gets built next — the skill uses
whatever is here.

- Scope and ordering come from [`ios-roadmap.md`](./ios-roadmap.md).
- Project rules (validation, commit style, separation of concerns) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- This is a **separate track** from the web roadmap's
  [`roadmap-progress.md`](./roadmap-progress.md); the two never collide.
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken
  in milestone order — never a whole milestone at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline

Nothing built yet. The web app (`src/`) is complete through web-roadmap v6 and is
the source of the reusable `@core` logic. The iOS app does not exist; `mobile/`
has not been created.

The first target is **M0 — Foundation: Expo app + shared-core reuse**.

## Completed slices

| # | Slice | Milestone | Date |
|---|-------|-----------|------|
| 1 | Scaffold Expo app in `mobile/` with isolated toolchain | M0 | 2026-06-13 |
| 2 | Wire `@core/*` alias + bundle-check; prove shared-core reuse bundles | M0 | 2026-06-13 |
| 3 | Synchronous `localStorage` shim over MMKV (+ `@core/storage` round-trip test) | M1 | 2026-06-13 |
| 4 | Hermes `crypto.randomUUID` polyfill for identity, installed at entry | M1 | 2026-06-13 |
| 5 | Storage parity test: web keys + full backup round-trip through the shim | M1 | 2026-06-13 |

## Next slice

**Slice 6 — Themed navigation shell: dark theme tokens + styled Stack + home screen (opens M2)**

Milestone: M2 — Core trainer MVP (parity with web v1). This is the **first M2
slice**: the navigation shell + theme the rest of M2 (HandGrid, editor, library,
practice) builds on.

Context: M1 is complete — storage shim + identity polyfill installed at entry,
with parity locked. The app currently has a single placeholder screen
(`mobile/app/index.tsx`, exporting `APP_TITLE` + rendering `ALL_HANDS.length`) and
a bare `<Stack />` root (`mobile/app/_layout.tsx`). Both use hardcoded light colors
(`#fff` / `#555`). This slice introduces a shared **dark theme** and applies it to
the navigation shell, matching the web app.

Web palette to match (from `src/index.css` dark block + `public/manifest.webmanifest`):
- brand/`theme_color`: `#1a1626` (nav header background)
- background: `#16171d`
- surface (cards): `#1f2028`
- border: `#2e303a`
- text (secondary): `#9ca3af`
- text strong (headings): `#f3f4f6`
- accent: `#c084fc`
- text on accent: `#fff`

Scope is intentionally narrow — theme + shell only. **Do NOT decide tab-vs-stack
information architecture** here: keep the existing `Stack` shell (the home screen
becomes the range library in a later M2 slice), so no new product decision is
forced. Dark-only is fine for now (the web supports light too; a light theme can
come later if wanted).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Create `mobile/theme/colors.ts` exporting a typed `colors` token object with the
  values above (e.g. `background`, `surface`, `border`, `text`, `textStrong`,
  `accent`, `onAccent`, `brand`). Optionally add minimal `spacing`/`radius` tokens
  if a screen needs them. This is the single source of truth for RN styling
  (parallel to the web CSS vars) and is **not** a `@core` concern — it's mobile UI.
- Apply the theme in `mobile/app/_layout.tsx`: give `<Stack>` `screenOptions` with
  `headerStyle.backgroundColor = colors.brand`, `headerTintColor = colors.accent`,
  `headerTitleStyle.color = colors.textStrong`, and
  `contentStyle.backgroundColor = colors.background`. Keep the storage/crypto
  side-effect imports first. Set the status bar to light (dark background) — e.g.
  `<StatusBar style="light" />` from `expo-status-bar` rendered in the layout.
- Restyle `mobile/app/index.tsx` to use the theme tokens (themed container
  background, `textStrong` title, `text` subtitle). **Keep** the `APP_TITLE` export
  and the `ALL_HANDS.length` line so `mobile/__tests__/home-screen.test.tsx` keeps
  passing. Optionally give the screen a `Stack.Screen options={{ title: ... }}`.
- Add `mobile/__tests__/theme.test.ts`: assert the `colors` tokens equal the exact
  web hex values above (locks visual parity with the web palette, mirroring how
  the storage parity test locks keys).

Files to create/modify:
- Create: `mobile/theme/colors.ts`, `mobile/__tests__/theme.test.ts`.
- Modify: `mobile/app/_layout.tsx` (themed Stack + status bar),
  `mobile/app/index.tsx` (themed styles).

Validation (mobile only — does NOT modify shared `src/` or root config, so the web
trio is not required):
- In `mobile/`: `npm run lint`, `npm run typecheck`, `npm run test:run`, and
  `npm run bundle-check` — all must pass.

Constraints: theme/UI lives in `mobile/` (`mobile/theme/`, `mobile/app/`); reused
logic still comes from `@core`. Keep it minimal and reversible; no navigation
library change, no IA decision, no new heavy dependency. Do not edit anything under
`src/`.

Suggested commit message:
`feat(ios): add dark theme tokens and themed navigation shell`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
