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
import/export. The roadmap now moves to **M7 — Cloud, sync, and sharing** (reusing the already-built
`@core/cloud/*`), starting with the cloud env seam. Local-first throughout: with no
`EXPO_PUBLIC_SUPABASE_*` set, the app stays fully usable offline and anonymous.

## Next slice

**Slice 53 — Cloud env seam (wire `EXPO_PUBLIC_SUPABASE_*` + handle `import.meta`)**

Milestone: M7 — Cloud, sync, and sharing (web v3). FIRST M7 slice and the second platform seam
(the cloud env seam). The web `@core/cloud/cloudConfig` reads Vite env vars, defaulting its env
source to `import.meta.env`; its `getCloudConfig(env)` / `isCloudConfigured(env)` already accept an
INJECTED env, so the native side just supplies creds from `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. No account/credentials are needed: with the vars absent, cloud is
unconfigured and the app stays local-first (this slice must NOT require a real Supabase project).

Context: `src/cloud/cloudConfig.ts` has `const defaultEnv = import.meta.env as unknown as EnvSource`
at MODULE LOAD. `import.meta` is Vite-only; on Metro/Hermes it may be a syntax/runtime problem the
moment `@core/cloud/cloudConfig` is first bundled (no mobile screen imports it yet, so this slice is
the first time Metro sees it). Resolving that is part of this slice.

Reuse (verified — read `src/cloud/cloudConfig.ts` to confirm shapes/names before building):
- `@core/cloud/cloudConfig` `getCloudConfig(env): CloudConfig | null`, `isCloudConfigured(env): boolean`,
  `interface CloudConfig`, and the `EnvSource` shape (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

Task (mobile-only; reuse `@core`, do NOT edit `src/`):
1. Add `mobile/platform/cloudEnv.ts` exporting `getMobileCloudConfig(): CloudConfig | null` and
   `isMobileCloudConfigured(): boolean`, which build an `EnvSource` `{ VITE_SUPABASE_URL:
   process.env.EXPO_PUBLIC_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY }`
   and delegate to the core `getCloudConfig` / `isCloudConfigured` (the injected-env seam — no `src/`
   edit).
2. Make `@core/cloud/cloudConfig` bundle on Metro. Run `npm run bundle-check`; if `import.meta`
   breaks it, add a Babel transform — install `babel-plugin-transform-import-meta` (dev dep) and add
   it to `mobile/babel.config.js` (the roadmap pre-authorizes this transform). Re-run bundle-check
   until the JS bundle builds. (`npm install` in `mobile/` needs the sandbox disabled per the env
   notes.)

Tests (`mobile/__tests__/cloud-env.test.ts`, no rendering): with the env vars unset,
`isMobileCloudConfigured()` is false and `getMobileCloudConfig()` is null; with both set (set
`process.env.EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` in the test, restore after), it is true and
returns a `CloudConfig` with the url + anonKey. Mirror how `src/cloud/cloudConfig.test.ts` injects env.

Files: add `mobile/platform/cloudEnv.ts` + `mobile/__tests__/cloud-env.test.ts`; possibly edit
`mobile/babel.config.js` + `mobile/package.json` (only if `import.meta` needs the transform). No
`src/` edits.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass. (If a dependency was added, run `npm install` first.)

Constraints: reuse `@core/cloud/cloudConfig` via its injected-env seam (no reimplemented config
parsing, no `src/` edit); wrapper lives in `mobile/platform/`. Keep the app local-first when the env
is absent. If Metro genuinely cannot bundle `import.meta` even with the transform, STOP and report
rather than editing `src/`.

Suggested commit message:
`feat(ios): wire the Supabase cloud env seam for native`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

## Deferred / candidate slices (not yet queued)

- **Weakness-focused drill** — likely redundant with the slice-27 mistakes-only toggle;
  reconsider whether it adds value before building.
- **Per-hand notes** (M6) — `SavedRange.handNotes` already exists in `@core`; a notes editor on
  the (action or binary) editor is a small, self-contained M6 slice that needs no postflop UX.
