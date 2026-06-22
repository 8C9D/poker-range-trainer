# Poker Range Trainer — iOS App Roadmap

## Goal

Ship an **App Store-downloadable iOS app** that is a feature-equivalent of the
existing web app, built with **React Native + Expo** so it reuses the existing,
already-tested TypeScript core instead of reimplementing it.

This roadmap is the iOS counterpart of [`roadmap.md`](./roadmap.md) (the web
roadmap, already implemented through v6). It is driven slice-by-slice by the
[`build-ios-app`](../.claude/skills/build-ios-app/SKILL.md) skill, with progress
tracked in [`ios-roadmap-progress.md`](./ios-roadmap-progress.md).

---

## Strategy: reuse the core, re-author the UI

The web app already separates concerns exactly the way a cross-platform port
needs (this is a standing `CLAUDE.md` principle):

| Layer | Location | iOS plan |
|-------|----------|----------|
| Poker domain logic | `src/domain/*` | **Reuse as-is** — pure TS, already unit-tested. Verified free of DOM/`window`/`localStorage`/`import.meta`. |
| Shared types | `src/types/*` | **Reuse as-is.** |
| Cloud (Supabase) | `src/cloud/*` | **Reuse**, behind a small env seam (see below). |
| Local storage | `src/storage/*` | **Reuse behind one shim** — a synchronous MMKV-backed `localStorage`. |
| UI | `src/components/*` (69 files), `src/App.tsx`, `src/App.css`, `src/main.tsx` | **Re-author** in React Native primitives. |

The bet: the hard, correctness-critical logic (hand math, combo counting, range
notation parser/exporter, practice scoring, spaced repetition, mixed-frequency
math, board texture, blocker math) is reused unchanged with its existing tests.
Only the presentation layer is rewritten.

### The two platform seams (verified against the code)

1. **Storage seam — `localStorage`.** `src/storage/storageHelpers.ts` reads via
   `localStorage.getItem`, and each storage module writes via
   `localStorage.setItem`. React Native has no `localStorage`. Plan: install a
   **synchronous** `localStorage` polyfill backed by
   [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv) (which is
   synchronous like `localStorage`, unlike `AsyncStorage`) at the app entry point,
   **before** any storage module is imported. Every `src/storage/*` module then
   works verbatim, and the on-disk JSON keeps the same keys/shapes as the web app
   (so a future backup/cloud transfer is byte-compatible). MMKV needs a native
   module, so the app runs as an **Expo dev build**, not Expo Go — fine, since the
   destination is the App Store anyway.

2. **Cloud env seam — `import.meta.env`.** `src/cloud/cloudConfig.ts` defaults its
   env source to `import.meta.env` (Vite-only). Its `getCloudConfig(env)` /
   `isCloudConfigured(env)` already accept an injected env, so the native side
   supplies Supabase creds from `EXPO_PUBLIC_SUPABASE_URL` /
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (via a thin mobile cloud-config wrapper, or a
   Babel `import.meta` transform). Cloud stays optional/local-first exactly as on
   web.

### Repo structure (monorepo, additive)

The web app stays exactly where it is. The iOS app is a self-contained Expo
project in `mobile/` that imports the shared core from `../src`:

```txt
poker-range-trainer/
  src/                 # existing web app — UNCHANGED ownership
    domain/  types/  cloud/  storage/  components/  App.tsx ...
  mobile/              # NEW — Expo (React Native) app
    app/               # screens (Expo Router)
    components/         # RN re-authored UI (HandGrid, etc.)
    platform/          # localStorage shim, cloud env wrapper, native adapters
    package.json       # its own deps + scripts (lint/typecheck/test)
    tsconfig.json      # path alias @core/* -> ../src/*
    metro.config.js    # watchFolders includes repo root so ../src bundles
    app.json / app.config.ts  # Expo + iOS config (bundle id, icons, etc.)
  docs/
    ios-roadmap.md           # this file
    ios-roadmap-progress.md  # slice state file
```

**Toolchain isolation (so the web build stays green):** `mobile/` must be added
to the root ESLint ignores, kept out of the root TypeScript project, and excluded
from the root Vitest config. The web `npm run lint` / `test:run` / `build` must
never see RN code; the mobile app carries its own ESLint, tsconfig, and Jest.

---

## What can be automated vs. what needs you

An agent can write and validate **all the code and config** headlessly (lint,
typecheck, Jest, and a Metro/`expo export` bundle check all run in Node). It
**cannot** create accounts, hold signing credentials, run an interactive device
build, or submit to Apple. Those are **user-action checkpoints** where the skill
stops and hands off:

- Apple Developer Program enrollment ($99/yr).
- Choosing the bundle identifier (e.g. `com.yourname.pokerrangetrainer`).
- Expo (EAS) account login and Apple credential generation/signing.
- Creating the App Store Connect app record.
- Running `eas build` / `eas submit` (cloud builds tied to your accounts).
- Final "Submit for Review" and anything Apple does after that.

The roadmap is sequenced so everything before M8 is fully buildable and testable
without any of those, and M8 is explicit about which steps are yours.

---

# Milestones

Each milestone is broken into small, commit-sized slices (the unit the skill
builds). Granularity matches the web roadmap: one coherent, reversible change per
slice, each validated and committed on its own.

## M0 — Foundation: Expo app + shared-core reuse

Goal: a runnable Expo app that imports and tests the existing domain core.

Slices:
- Scaffold an Expo (TypeScript) app in `mobile/` with Expo Router.
- Add `mobile/` to root ESLint ignores; exclude it from root Vitest; keep it out
  of the root TS project. Confirm web `lint` / `test:run` / `build` still pass.
- Configure Metro `watchFolders` + a `@core/*` TS path alias so `../src/domain`
  and `../src/types` resolve and bundle from inside `mobile/`.
- Add the mobile validation toolchain: ESLint, `tsc --noEmit`, Jest +
  `@testing-library/react-native`, and a `bundle-check` script
  (`expo export --platform ios`). Wire `lint` / `typecheck` / `test:run` /
  `bundle-check` npm scripts in `mobile/package.json`.
- Smoke slice: render a placeholder screen that calls a reused domain function
  (e.g. `generateAllHands()` from `@core/domain/pokerHands`) and run one reused
  domain test under the mobile Jest to prove cross-package reuse works.

Success: `mobile` lints, typechecks, tests, and bundles headlessly; the web trio
is untouched; domain logic is imported, never copied.

## M1 — Platform adapters: storage + identity

Goal: every `src/storage/*` module works on device, unchanged.

Slices:
- Add `react-native-mmkv`; implement a synchronous `localStorage`-compatible shim
  (`getItem`/`setItem`/`removeItem`/`clear`) over MMKV in `mobile/platform/`.
- Install the shim at app entry **before** any storage import; add a test proving
  `loadSavedRanges`/`saveSavedRange` (imported from `@core/storage`) round-trip
  through it.
- Verify/polyfill ID + randomness helpers used by the core (e.g. `createRangeId`,
  any `crypto.randomUUID`) so they work under Hermes.
- Parity test: assert stored keys/shapes match the web app's (forward-compatible
  with backup/cloud transfer).

Success: all local persistence runs natively via one shim; no storage module was
forked.

## M2 — Core trainer MVP (parity with web v1)

Goal: the full create → save → practice loop on device.

Slices:
- Navigation shell + theme (dark palette matching the web `theme_color`).
- `HandGrid` / `HandCell` in RN: 13×13, tap-to-toggle, drag-paint via gesture
  handler; reuse `generateAllHands` and grid ordering from the core.
- Range editor screen: name field, toggle hands, live save via `saveSavedRange`.
- Range library screen: list, open, edit, delete (`loadSavedRanges`,
  `deleteSavedRange`).
- Recognition practice screen + session stats, reusing `domain/practice` and
  `domain/practiceStats` (`createPracticeAttempt`, `summarizePracticeAttempts`).

Success: a user can create, name, save, edit, delete, and practice a range
entirely on device — the v1 loop, on iOS. **This is the first TestFlight-worthy
build.**

## M3 — Range power tools (web v1.1–v1.2)

Goal: fast range building + notation interchange.

Slices: range shortcut buttons (`domain/rangeShortcuts`); live range percentage +
combo counts (`domain/rangeMath`, `domain/combos`); notation import/export UI
(`domain/rangeNotation`) with copy/paste via `expo-clipboard`; clear-range.

## M4 — Library & organization (web v1.3–v1.4)

Goal: manage many ranges.

Slices: scenario metadata editor (`domain` + `types/range` metadata); search;
filters (position / action / stack / game); sorts (name / recently edited /
recently practiced / accuracy); duplicate (`domain/rangeDuplication`); archive +
favorite toggles; per-range stat summaries on cards.

## M5 — Practice depth (web v2–v2.3)

Goal: the full training suite.

Slices: practice-mode picker; build-from-memory; timed drill; weakness-focused
drill; missing-hands review; per-hand accuracy + weakest-hands view + heatmap
(`domain/accuracy`, `practiceStats`); "practice mistakes only"; session history;
spaced repetition + due-today + streak (`domain/spacedRepetition`); multi-action
editor + action palette + per-action accuracy + action notation
(`domain/actionRange`). Add **swipe-to-answer** (RN gestures) and `expo-haptics`
feedback — the native upgrade over the web swipe.

## M6 — Advanced training (web v4–v5)

Goal: postflop + combo-level depth.

Slices: flop texture tagging + display (`domain/boardTexture`); made-hand/draw
categorization (`domain/handCategory`); range-vs-board (`domain/rangeVsBoard`);
postflop decision practice (`domain/postflopScenario`); combo enumeration +
blocker-aware counts + combo selection (`domain/combos`, `comboSelection`,
`blockerPractice`); mixed-frequency editor + quiz + notation
(`domain/mixedStrategy`, `mixedNotation`); range diff (`domain/rangeDiff`);
per-hand notes; CSV import (`domain/rangeTransfer`).

## M7 — Cloud, sync, and sharing (web v3, v3.2, v5.1)

Goal: accounts + cross-device sync + shared links, on device.

Slices: the **cloud env seam** (wire `EXPO_PUBLIC_SUPABASE_*` into
`@core/cloud/cloudConfig`); auth screen on `@core/cloud/auth` (sign up/in/out +
session); explicit push/pull full-library sync (`@core/cloud/backupRepo`); delete
cloud data; backup export/import to a file via `expo-file-system` +
`expo-sharing` / `expo-document-picker`; deep links / universal links for shared
ranges and packs (`#/r/:id`, `#/p/:id` → native linking), reusing
`domain/shareRoute` + `cloud/sharedRangesRepo` / `sharedPacksRepo`.

Local-first throughout: with no `EXPO_PUBLIC_SUPABASE_*` set, the app is fully
usable offline and anonymous (matching web behavior).

## M8 — Native polish + App Store pipeline

Goal: a submittable, polished build.

Code/config slices (automatable):
- App icon set + splash (`expo-splash-screen`), adaptive assets.
- Onboarding/empty states, error boundaries, offline messaging.
- `app.config.ts`: app name, version/build number, iOS `infoPlist` usage strings
  for any permission touched, privacy manifest (`PrivacyInfo.xcprivacy`).
- EAS config (`eas.json`): dev, preview, and production build profiles + submit
  profile.
- Draft store metadata in-repo: app name, subtitle, description, keywords,
  promotional text, and the App Privacy questionnaire answers, plus a privacy
  policy page/URL.

User-action checkpoints (the skill stops and hands these to you):
- Enroll in the Apple Developer Program; pick the bundle identifier.
- `eas login`; let EAS generate/manage Apple signing credentials.
- Create the App Store Connect app record.
- `eas build --platform ios --profile production`; distribute to **TestFlight**
  for internal testing.
- Capture screenshots on the required device sizes.
- `eas submit` → App Store Connect → **Submit for Review**.

Success: the app passes review and is **downloadable from the App Store**.

---

## Cross-cutting rules

- **Keep the web app green.** Any change to shared `src/` must keep the web
  `npm run lint` / `test:run` / `build` passing. Mobile work is additive; prefer
  adapting via the seams (shim, env wrapper, injected deps) over editing core
  modules. If a core module genuinely must change, do it as a tiny,
  behavior-preserving edit and re-run the web trio.
- **Reuse, don't copy.** Domain/types/cloud come from `@core/*`. Copy-pasting a
  domain module into `mobile/` is a regression, not a slice.
- **One slice = one commit**, validated and pushed, exactly like the web roadmap.
- **Separation of concerns** holds on mobile too: reused logic stays in `@core`,
  native adapters in `mobile/platform/`, screens in `mobile/app/`, RN UI in
  `mobile/components/`.

## Validation per slice

- **Mobile slices:** `mobile` → `lint`, `typecheck`, `test:run`, `bundle-check`
  (all headless, all must pass).
- **Slices that touch shared `src/`:** additionally run the root web trio
  (`npm run lint`, `npm run test:run`, `npm run build`).
- **Device/EAS/store steps:** user-action — never reported as "passed" unless a
  real build/submit actually succeeded.

## Definition of done

The iOS app is done when a user can install it from the App Store and, on device:
create/name/save/edit/delete ranges on a 13×13 grid; build ranges with shortcuts
and notation; organize a library with metadata/search/filter/sort; run every
practice mode with mistake tracking, heatmaps, spaced repetition, and multi-action
charts; train postflop/combo/mixed-frequency content; optionally sign in and sync
across devices and open shared range links — i.e. **feature parity with the web
app**, with native navigation, gestures, haptics, offline use, and a polished
icon/splash. The shared core is reused (not reimplemented) and the web app remains
fully functional throughout.
