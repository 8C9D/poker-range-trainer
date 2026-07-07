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
from the root install, no mobile duplicate). Next: the auth screen (which first imports the factory,
so Metro will then bundle `@supabase/supabase-js`), push/pull sync, delete-cloud-data, file backup,
and deep links. Local-first throughout: with no `EXPO_PUBLIC_SUPABASE_*` set, the app stays fully
usable offline and anonymous.

## Next slice

**Slice 55 — Auth screen (sign up / in / out + session)**

Milestone: M7 — Cloud, sync, and sharing. THIRD M7 slice: an account screen over the reused
`@core/cloud/auth`, using the slice-54 client factory. This is the FIRST screen to import the factory,
so Metro will now bundle `@supabase/supabase-js` — the bundle-check is the real test of that. Still
local-first: when unconfigured the screen shows an offline message and no form.

Context: `@core/cloud/auth` exposes `signUp(email, pw, client?)`, `signIn(email, pw, client?)`,
`signOut(client?)`, `getCurrentSession(client?)`, `onAuthChange(cb, client?)`, and
`CloudNotConfiguredError`; each accepts an injected `client`. The screen resolves the client once via
`getMobileSupabaseClient()` (null when unconfigured) and passes it to these functions. On RN,
`@supabase/supabase-js` needs a WHATWG `URL` at runtime, so install `react-native-url-polyfill` and
import `react-native-url-polyfill/auto` at app entry (`mobile/app/_layout.tsx`) before any cloud use.

Reuse (verified — read `src/cloud/auth.ts` + `mobile/platform/supabaseClient.ts`):
- `@core/cloud/auth` `signIn`, `signUp`, `signOut`, `getCurrentSession`, `onAuthChange`,
  `CloudNotConfiguredError`; `type Session` from `@supabase/supabase-js`.
- `mobile/platform/supabaseClient` `getMobileSupabaseClient()`.

DESIGN NOTE (resolve when building): a `mobile/app/auth.tsx` screen reached from a header "Account"
link on the library (the header already has Boards/Compare on the left and New on the right — pick a
slot, e.g. an "Account" link grouped with "New" on the right). Resolve the client on mount; if null,
render an offline/"set EXPO_PUBLIC_SUPABASE_* to enable sync" message. Otherwise show the current
session (`getCurrentSession` + subscribe via `onAuthChange`): when signed out, email + password fields
with Sign in / Sign up; when signed in, the email + a Sign out button. Surface auth errors inline.

Task (mobile-only; reuse `@core`, do NOT edit `src/`): build the auth screen wiring the `@core/cloud/auth`
functions with the resolved client; add the header entry; install `react-native-url-polyfill` and import
it at entry. Keep all auth logic in `@core` (the screen only gathers input + renders state).

Tests (RNTL): mock `../platform/supabaseClient` so `getMobileSupabaseClient` resolves to `null` →
the screen shows the offline message and no sign-in form. Then mock it to resolve a fake client and mock
`@core/cloud/auth` (`signIn` a `jest.fn`, `getCurrentSession` → null) → entering email/password and
pressing Sign in calls `signIn` with the entered values. Use `waitFor` for the async client resolution.

Files: add `mobile/app/auth.tsx` + `mobile/__tests__/auth-screen.test.tsx`; edit `mobile/app/index.tsx`
(header link) + `mobile/app/_layout.tsx` (url polyfill import); edit `mobile/package.json` (+ lockfile)
to add `react-native-url-polyfill`. No `src/` edits.

Validation (mobile only): run `npm install` first (sandbox disabled), then `npm run lint`,
`npm run typecheck`, `npm run test:run`, `npm run bundle-check` — all must pass. The bundle-check now
pulls in `@supabase/supabase-js`; if Metro cannot bundle it (or `import.meta`/Node built-ins surface),
diagnose, and if it cannot be fixed mobile-side, STOP and report (do not edit `src/`).

Constraints: reuse `@core/cloud/auth` for all auth ops (no hand-rolled Supabase calls); screen in
`mobile/app/`; keep local-first when unconfigured. Do not edit `src/`.

Suggested commit message:
`feat(ios): add a cloud auth screen`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
