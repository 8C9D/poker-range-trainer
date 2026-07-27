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
| 6 | Dark theme tokens + themed navigation shell | M2 | 2026-06-14 |
| 7 | 13×13 tap-to-toggle `HandGrid`/`HandCell` reusing the core matrix | M2 | 2026-06-14 |
| 8 | Drag-paint `HandGrid` via gesture handler (+ fix react/renderer version skew) | M2 | 2026-06-14 |
| 9 | Range editor screen: name + grid + live save via `@core` storage | M2 | 2026-06-14 |
| 10 | Range library screen: list / open / edit / delete (home screen) | M2 | 2026-06-14 |
| 11 | Recognition practice screen + session stats (completes M2) | M2 | 2026-06-14 |
| 12 | Live hand/combo/percentage stats bar in the range editor | M3 | 2026-06-14 |
| 13 | Range shortcut buttons (pairs / broadways) in the editor | M3 | 2026-06-14 |
| 14 | Range notation import/export (clipboard) + clear-range (completes M3) | M3 | 2026-06-14 |
| 15 | Scenario metadata editor in the range editor | M4 | 2026-06-14 |
| 16 | Library search by name | M4 | 2026-06-14 |
| 17 | Library metadata filters (position / action / game) | M4 | 2026-06-14 |
| 18 | Library sorts (name / recent / practiced / accuracy) | M4 | 2026-06-14 |
| 19 | Duplicate a range from the library | M4 | 2026-06-14 |
| 20 | Favorite toggle + favorites filter in the library | M4 | 2026-06-14 |
| 21 | Archive ranges (hide-by-default + show-archived toggle) | M4 | 2026-06-15 |
| 22 | Per-range practice stats on library cards (completes M4) | M4 | 2026-06-15 |
| 23 | End-of-session mistakes review in recognition practice (opens M5) | M5 | 2026-06-15 |
| 24 | Persist recognition practice results into per-range practice stats | M5 | 2026-06-15 |
| 25 | Persist per-hand accuracy from recognition practice | M5 | 2026-06-15 |
| 26 | Weakest-hands view on the practice screen | M5 | 2026-06-15 |
| 27 | "Practice mistakes only" drill toggle on the practice screen | M5 | 2026-06-15 |
| 28 | Per-hand accuracy heatmap (`HandHeatmap`) on the practice screen | M5 | 2026-06-15 |
| 29 | Build-from-memory practice mode + practice-mode picker | M5 | 2026-06-21 |
| 30 | Timed drill practice mode | M5 | 2026-06-21 |
| 31 | Swipe-to-answer + haptics on recognition practice | M5 | 2026-06-21 |
| 32 | Practice session history (record on explicit End session + view) | M5 | 2026-06-21 |
| 33 | Advance spaced-repetition schedule on End session | M5 | 2026-06-21 |
| 34 | Due-for-review badge + practice streak on the library | M5 | 2026-06-21 |
| 35 | Multi-action editor foundation (palette + action grid + screen) | M5 | 2026-06-21 |
| 36 | Preserve overlay fields when saving from the binary editor (fix) | M5 | 2026-06-21 |
| 37 | Action quiz practice mode (per-action accuracy) | M5 | 2026-06-21 |
| 38 | Action notation import/export on the action editor | M5 | 2026-06-21 |
| 39 | Board explorer: board input + flop texture tagging (opens M6) | M6 | 2026-06-21 |
| 40 | Range-vs-board overlay on the board explorer | M6 | 2026-06-21 |
| 41 | Postflop decision practice (bet/check/call/raise/fold on a random spot) | M6 | 2026-06-22 |
| 42 | Combo explorer: enumerate a hand's combos + blocker-aware counts | M6 | 2026-06-22 |
| 43 | Controlled `ComboSelector` component (per-combo toggles) | M6 | 2026-06-22 |
| 44 | Refine + persist per-hand combo selections in the editor | M6 | 2026-06-22 |
| 45 | Blocker-aware combo drill (completes the combo cluster) | M6 | 2026-06-22 |
| 46 | Controlled `MixedStrategyEditor` component (per-action steppers) | M6 | 2026-06-22 |
| 47 | Frequency-editor screen persisting `mixedStrategies` | M6 | 2026-06-22 |
| 48 | Mixed-frequency primary-action quiz | M6 | 2026-06-22 |
| 49 | Mixed-frequency notation import/export (completes the mixed cluster) | M6 | 2026-06-22 |
| 50 | Range diff view (compare two ranges) | M6 | 2026-06-22 |
| 51 | Per-hand notes editor (`handNotes`) | M6 | 2026-06-22 |
| 52 | CSV import/export in the range editor (completes M6) | M6 | 2026-06-22 |
| 53 | Cloud env seam: native Supabase config wrapper + `import.meta` handling | M7 | 2026-06-22 |
| 54 | Native Supabase client factory (RN auth options + MMKV session storage) | M7 | 2026-06-22 |
| 55 | Cloud auth screen (sign up / in / out + session) | M7 | 2026-06-22 |
| 56 | Explicit push/pull library sync on the account screen | M7 | 2026-06-22 |
| 57 | Delete cloud data on the account screen | M7 | 2026-06-22 |
| 58 | File backup export/import (expo-file-system / sharing / document-picker) | M7 | 2026-06-22 |
| 59 | Shared-range deep-link viewer route (`r/:id`) | M7 | 2026-06-22 |
| 60 | Shared-pack deep-link viewer route (`p/:id`) — completes M7 | M7 | 2026-06-22 |
| 61 | Root error boundary + offline/empty-state polish (opens M8) | M8 | 2026-06-22 |
| 62 | iOS privacy manifest + build number in `app.json` | M8 | 2026-06-22 |
| 63 | `eas.json` build + submit profiles | M8 | 2026-06-22 |
| 64 | In-repo App Store metadata + privacy-policy drafts | M8 | 2026-06-22 |

**M5 — Practice depth: COMPLETE** (slices 23–38). The full training suite is on device:
mistakes review, per-range/per-hand stats, weakest-hands, mistakes-only drill, accuracy
heatmap, build-from-memory, practice-mode picker, timed drill, swipe-to-answer + haptics,
session history, spaced repetition (record + due-badge + streak), and the multi-action
cluster (editor, quiz, notation). **M6 — Advanced training** is underway: board explorer
(slice 39), range-vs-board overlay (slice 40), and postflop decision practice (slice 41).
**Combo cluster COMPLETE** (slices 42–45): combo explorer, `ComboSelector` component, per-hand
combo refinement persisted as `comboSelections` in the editor, and the blocker-aware combo drill
(a practice mode dealing unblocked combos, honoring `comboSelections` via `selectionForRange`).
**Mixed-frequency cluster COMPLETE** (slices 46–49): the `MixedStrategyEditor` component, a
frequency-editor screen persisting `mixedStrategies`, a primary-action quiz, and notation
import/export. The range diff view (slice 50), the per-hand notes editor (slice 51 — `handNotes`), and CSV
import/export in the editor (slice 52 — `rangeTransfer`) are all done.

**M6 — Advanced training: COMPLETE** (slices 39–52): board explorer + texture, range-vs-board,
postflop decision practice, the combo cluster (explorer, selector, refinement, blocker drill), the
mixed-frequency cluster (editor, screen, quiz, notation), range diff, per-hand notes, and CSV
import/export. **M7 — Cloud, sync, and sharing** has begun (reusing the already-built `@core/cloud/*`). The cloud
env seam is done (slice 53 — `platform/cloudEnv.ts` injects `EXPO_PUBLIC_SUPABASE_*` into the core
`getCloudConfig`; a mobile `ImportMeta.env` ambient decl lets `@core/cloud/cloudConfig` type-check;
the jest run loaded that module, proving `babel-preset-expo` handles `import.meta` at runtime — so
Metro will too). The native Supabase client factory is also done (slice 54 —
`platform/supabaseClient.ts` injects the mobile config + an RN `create` that persists the session
through the MMKV `localStorage` shim with `detectSessionInUrl:false`; it short-circuits to `null`
when unconfigured so the core never falls back to its Vite default; `@supabase/supabase-js` resolves
from the root install, no mobile duplicate). The auth screen is done (slice 55 — sign up/in/out + session over `@core/cloud/auth`, reached from an
"Account" header link; importing the factory made Metro bundle `@supabase/supabase-js` +
`react-native-url-polyfill`, growing the JS bundle 3.9→4.6 MB and proving the whole cloud stack
bundles on Metro). Explicit push/pull library sync (slice 56), delete-cloud-data (slice 57), and file backup
export/import (slice 58 — share a JSON backup out / pick one back, offline, no account) are done.
Deep links: the user chose **custom-scheme deep links now** (defer universal `https://` links until a
domain exists). The app's custom scheme `pokerrangetrainer://` was already set at scaffold, so
`pokerrangetrainer://r/:id` opens the shared-range viewer route (slice 59 — `app/r/[id].tsx`: fetch
via `@core/cloud/sharedRangesRepo`, "Add to my library", local-first). The shared **pack** route `p/:id` (slice 60) mirrors the range route and **completes M7 — Cloud, sync,
and sharing**.

**M7 — COMPLETE** (slices 53–60): cloud env seam, native Supabase client factory, auth screen,
explicit push/pull sync, delete-cloud-data, offline file backup, and custom-scheme deep-link viewer
routes for shared ranges + packs. Universal `https://` links remain deferred (need a domain + hosted
apple-app-site-association). The app is local-first throughout: with no `EXPO_PUBLIC_SUPABASE_*` set
it is fully usable offline and anonymous.

Only **M8 — Native polish + App Store pipeline** remains. It mixes a few automatable config/UI slices
(error boundary + offline/empty-state polish, `app.config` iOS `infoPlist` + privacy manifest,
`eas.json` build/submit profiles, in-repo store-metadata drafts) with **design decisions** (app
display name, icon/splash artwork) and **user-action checkpoints** (Apple Developer enrollment,
bundle identifier, signing credentials, `eas build` / `eas submit`, TestFlight, screenshots,
"Submit for Review"). The loop will do the automatable slices and STOP at the first decision/action it
cannot make.

**M8 has begun.** The root error boundary (slice 61 — `mobile/components/ErrorBoundary.tsx`, a class
boundary with `getDerivedStateFromError` / `componentDidCatch`) now wraps the navigator in
`app/_layout.tsx`: a render error anywhere below shows a themed, recoverable fallback ("Something went
wrong" + the error message + a "Try again" reset) instead of unmounting to a blank screen. App display
name is already `Poker Range Trainer` and the custom scheme `pokerrangetrainer` is set; `ios.bundleIdentifier`
is still unset (a user-action item). The iOS **privacy manifest + build number** are now in `app.json`
(slice 62 — `expo.ios.privacyManifests` declares `NSPrivacyTracking:false`, empty tracking-domain /
collected-data lists, and required-reason APIs UserDefaults `CA92.1`, FileTimestamp `C617.1`, DiskSpace
`E174.1`, SystemBootTime `35F9.1`; plus `ios.buildNumber:"1"`. No `NS*UsageDescription` strings are
needed — the app touches no permission-gated APIs). The **EAS build/submit profiles** are now in
`mobile/eas.json` (slice 63 — `cli.appVersionSource:"local"` keeps `app.json` authoritative;
`build.development` is a simulator dev-client, `build.preview` an internal build, `build.production`
auto-increments; `submit.production` is left empty so Apple credentials are supplied at submit time).
The **in-repo store-metadata drafts** are now written (slice 64 — `docs/ios-store-listing.md` with
listing copy + a truthful App Privacy questionnaire, and `docs/privacy-policy.md`, both consistent with
the privacy manifest and with all user-supplied fields marked TODO).

**All automatable M8 slices are COMPLETE (slices 61–64).** The loop has reached the M8 wall: everything
remaining is a **design decision** (app icon + splash artwork) or a **user-action checkpoint** (Apple
Developer enrollment, bundle identifier, signing, App Store Connect record, `eas build`, TestFlight,
screenshots, `eas submit`). Per the skill, the loop **STOPS here and hands off** — see the Next slice
block for the exact steps. Re-invoking `build-ios-app` will re-hit this same gate until the user
supplies the design assets / Apple-side actions.

## Next slice

**🛑 BLOCKED — the loop has reached the M8 wall. No automatable slice remains.**

Slices 1–64 are done: M0–M7 in full, plus every **automatable** M8 slice (error boundary, privacy
manifest + build number, `eas.json` profiles, store-metadata + privacy-policy drafts). The app is
feature-complete and validates headlessly (mobile `lint` / `typecheck` / `test:run` / `bundle-check`
all green; web app untouched). What's left **cannot be done by the agent** — it requires design assets
and your Apple-side accounts/actions. A re-invocation of `build-ios-app` will stop right here until
these are resolved.

### 1. Design decision — app icon + splash artwork (do first; `eas build` needs an icon)

`mobile/app.json` still points at the scaffold placeholder `./assets/icon.png`. Provide real artwork
(or a brief and have it produced):
- A **1024×1024** app icon (PNG, no alpha) at `mobile/assets/icon.png`.
- A splash image + background color (wire via `expo-splash-screen` in `app.json`), ideally matching the
  dark theme (`#1a1626` / `#16171d`).
Once the assets exist, a small **automatable** follow-up slice can wire them into `app.json` (icon,
splash, iOS `userInterfaceStyle: "dark"`) and re-run the toolchain. Hand the agent the files (or an
approved design) to unblock that slice.

### 2. User-action checkpoints — Apple accounts, signing, build, submit (you must run these)

The agent must NOT fake or run these. Exact steps:

1. **Enroll** in the Apple Developer Program ($99/yr): https://developer.apple.com/programs/
2. **Choose the bundle identifier** (e.g. `com.<you>.pokerrangetrainer`). Tell the agent and it will
   set `ios.bundleIdentifier` in `mobile/app.json` (a tiny automatable slice).
3. **Install + log in to EAS** (from `mobile/`):
   - `npm install -g eas-cli` (or use `npx eas-cli`)
   - `eas login`
   - `eas build:configure` (links the project; generates an EAS project id)
4. **Let EAS manage Apple signing** when prompted during the first build (it creates the
   distribution certificate + provisioning profile under your account).
5. **Create the App Store Connect app record** at https://appstoreconnect.apple.com (name
   `Poker Range Trainer`, the bundle id from step 2). Paste the listing copy + App Privacy answers from
   `docs/ios-store-listing.md`; host `docs/privacy-policy.md` and enter its URL.
6. **Production build:** `eas build --platform ios --profile production`
7. **TestFlight:** distribute the build for internal testing; install via TestFlight and smoke-test on a
   real device.
8. **Screenshots:** capture on the required device sizes (App Store Connect lists them).
9. **Submit:** `eas submit --platform ios --profile production`, then in App Store Connect attach the
   build, finish metadata/screenshots, and click **Submit for Review**.

### What to do next

- To unblock **design**: give the agent the icon/splash assets (or approve a brief), and it will wire
  them into `app.json` as the next slice.
- To unblock **submission**: run the steps above; when you have the **bundle id**, ask the agent to set
  it and it can also adjust `eas.json`/`app.json` as needed.
- Until then, there is **no further code to write** — the iOS app build is complete up to the App Store
  pipeline.

(No commit is produced for a blocked/hand-off state — slice 64 was the last committed slice.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — DONE since this note was written: `mobile/app/notes-editor.tsx`
  shipped in `fa6484e` (with tests in `mobile/__tests__/notes-editor-screen.test.tsx`).
  No longer a candidate.
