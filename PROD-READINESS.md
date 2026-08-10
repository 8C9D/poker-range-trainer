# Production readiness — state assessment

Run date: 2026-08-10.
Branch: `prod-readiness/2026-08-10`.
Baseline commit: `21f568bd228f30d7a99309bac544ad350825243b` (see [reviews/BASELINE.md](reviews/BASELINE.md)).

This is a bounded state assessment plus a bounded diff, not a guarantee of readiness.

## Context (established by inspection and execution, not assumption)

### Stack and commands

Two apps in one repo sharing a domain core, npm as the package manager (`package-lock.json` at both roots).

| Surface | What it is |
| --- | --- |
| `src/` | React 19 + TypeScript + Vite 8 web app |
| `mobile/` | Expo SDK 56 / React Native 0.85 iOS app (expo-router) |
| `src/domain`, `src/storage`, `src/types` | shared core, reached from mobile via the `@core/*` alias |

Commands are taken from `package.json` and `.github/workflows/ci.yml`, and every one was executed to confirm it works (raw output in `reviews/BASELINE.md`):

- `npm run lint` -> `eslint . && npm --prefix mobile run lint`
- `npm run test:run` -> `vitest run && npm --prefix mobile run test:run -- --runInBand`
- `npm run build` -> `tsc -b && vite build && npm --prefix mobile run typecheck`
- `npm run bundle-check --prefix mobile` -> `expo export --platform ios`, confirmed to produce a 5.5MB Hermes bundle

### How this ships

An **iOS App Store binary**, built by EAS (`mobile/eas.json`, `LAUNCH-CHECKLIST.md`).

The web app is **not a deployed product**. `README.md:11-13` states it is "a development surface and the home of the shared `@core` code, not a deployed product"; there is no deploy configuration anywhere in the repo (no netlify/vercel/firebase config) and `.github/workflows/ci.yml` has lint/test/build steps only, no deploy job.
This is load-bearing for severity: see ASSUMPTIONS.

### Boundaries actually present

| Boundary | Present? | Detail |
| --- | --- | --- |
| Persistence | **yes** | nine `localStorage` keys, MMKV-backed on iOS (`mobile/platform/localStorageShim.ts`) |
| Filesystem | **yes** | backup export/import via expo-file-system / document-picker / sharing |
| Third-party API | **yes, one** | Sentry crash reporting, gated on `EXPO_PUBLIC_SENTRY_DSN` |
| Network in | no | no server, no endpoints, no inbound surface |
| Network out | none in-app | except Sentry when the DSN is set |
| Auth | no | no accounts (`README.md:16-17`) |
| Payments | no | none |
| Background jobs | no | none |
| Database / queue | no | `supabase/migrations/` is orphaned; cloud sync was archived out of v1 |

Passes whose boundary does not exist here are skipped: authn/authz, injection, unsafe deserialization of untrusted input, retries/backoff/idempotency against remote dependencies, health endpoints.

### What can be executed to verify a change

Lint, both test suites, both typechecks, the Vite production build, and the iOS Hermes bundle export — all local, all confirmed working. Nothing here is a P0.
What **cannot** be exercised: real MMKV native behavior (Jest mocks it — `mobile/__mocks__/react-native-mmkv.ts`), and anything in the EAS build environment (remote, and prohibited by this run's rules).

### What "production" means here, and who breaks

A single-player, offline, on-device study tool. There is no server to take down and no other user to affect. **The person who breaks is the individual user on their iPhone, and the thing they lose is their own data** — hand-built ranges and months of practice history that exist in exactly one place, with no account, no backend, and no automatic backup. The only recovery net is a JSON backup the user must have chosen to export.
That shapes every severity call below: data durability on device outranks everything, and web-app defects are near-cosmetic because no user ever loads the web app.

### Entry points, trust boundaries, config surface

- Entry points: `mobile/app/_layout.tsx` (router root; installs the storage/crypto shims on lines 3-4 before any `@core` module loads), `src/main.tsx` (web root).
- Trust boundary: exactly one — imported backup JSON. It is validated by `validateBackup` (`src/storage/backup.ts:136`) before it replaces the library, and every per-slice loader re-validates on read.
- Config surface: one variable, `EXPO_PUBLIC_SENTRY_DSN` (`.env.example:7`), absence-tolerant by design. Build-time only: `SENTRY_AUTH_TOKEN`, plus the two undocumented ones in P1-1.

## Findings

Severity: **P0** = data loss, security exposure, silent failure, or cannot deploy. **P1** = fails under realistic load or edge input, or undiagnosable in prod. **P2** = everything else.

### Work list (P0/P1) — frozen after Review 0

| id | area | sev | evidence (file:line) | fix | blast radius |
| --- | --- | --- | --- | --- | --- |
| P0-1 | persistence | P0 | `mobile/platform/localStorageShim.ts:34` | pass `recoveryStrategy: 'recover-on-error'` to `createMMKV` | one call site, one option; changes native recovery behavior for the single MMKV instance holding all nine keys |
| P1-1 | observability | P1 | `mobile/app.json:84`, `LAUNCH-CHECKLIST.md:54`, `LAUNCH-CHECKLIST.md:185` | document `SENTRY_ORG` and `SENTRY_PROJECT` next to `SENTRY_AUTH_TOKEN` | documentation only; zero runtime effect |

**P0-1 — MMKV silently discards every stored key on a CRC or file-length error.**
`mobile/platform/localStorageShim.ts:34` calls `createMMKV({ id: 'poker-range-trainer' })` with no `recoveryStrategy`. Traced through the installed package and the vendored core, every step read from source:

1. `mobile/node_modules/react-native-mmkv/lib/specs/MMKVFactory.nitro.d.ts:100-105` — `recoveryStrategy?: RecoveryStrategy`, `@default undefined`.
2. `mobile/node_modules/react-native-mmkv/cpp/HybridMMKV.cpp:261-263` — when unset, `getRecoveryStrategy` returns `std::nullopt`, passed as `.recover` at `HybridMMKV.cpp:33`.
3. `mobile/ios/Pods/MMKVCore/Core/MMKV.h:89` — `std::optional<MMKVRecoverStrategic> recover = std::nullopt; // if not set, use the old style callback`.
4. `mobile/ios/Pods/MMKVCore/Core/MMKV.cpp:1725-1730` — the old-style callback returns `OnErrorDiscard` when no handler is registered.
5. react-native-mmkv registers no handler: `grep -rn "registerHandler\|MMKVHandler\|g_handler"` over `mobile/node_modules/react-native-mmkv/cpp/` and `ios/` returns nothing.
6. `mobile/ios/Pods/MMKVCore/Core/MMKVPredef.h:156-159` — `OnErrorDiscard = 0`.

All nine storage keys live in that one instance, so a single CRC failure discards the entire library and practice record at once, with no error shown: the app reads back an empty store and renders as a fresh install. `recover-on-error` instead attempts recovery.
Severity is P0 because "data loss" is the named P0 criterion and the loss here is total, silent, and unrecoverable without a user-initiated backup. It is not inflated by likelihood — the trigger (storage corruption) is uncommon — but the consequence has no floor.

**P1-1 — production crash reports will be unsymbolicated.**
`mobile/app.json:84` registers the Sentry plugin as the bare string `"@sentry/react-native"` with no `organization` or `project`. The prebuild artifact this produced, `mobile/ios/sentry.properties` (generated, gitignored), records the consequence verbatim:

```
# no org found, falling back to SENTRY_ORG environment variable
# no project found, falling back to SENTRY_PROJECT environment variable
```

`git grep` for `SENTRY_ORG` and `SENTRY_PROJECT` across the tracked tree returns **nothing** — neither is set in `mobile/eas.json`, mentioned in `.env.example`, or listed in `LAUNCH-CHECKLIST.md`, which documents only `SENTRY_AUTH_TOKEN` (`:54`, `:185`). A build that follows the documented checklist exactly therefore uploads no source maps, and every production crash arrives as minified Hermes frames.
Severity is P1, not P0: crash reporting is optional and its absence does not lose data or break the app, but it is precisely "undiagnosable in prod". Whether the EAS environment happens to supply the two variables is CANNOT ASSESS (remote).

### P2 — documented, not fixed

| id | area | sev | evidence (file:line) | fix | blast radius |
| --- | --- | --- | --- | --- | --- |
| P2-1 | web SW | P2 | `public/service-worker.js:51` | `.catch()` the floating `cache.put` | web only, not deployed |
| P2-2 | web SW | P2 | `public/service-worker.js:12`, `:33` | version `CACHE_NAME` per release | web only; cache grows across deploys, never pruned |
| P2-3 | web SW | P2 | `public/service-worker.js:1`, `:8`, `:12` | header says "v3.1" while `CACHE_NAME` is `prt-shell-v2`; line 8 cites Supabase, archived out of v1 | comments only |
| P2-4 | persistence | P2 | `src/storage/backup.ts:244-250` | wrap the rollback loop so a rollback failure cannot replace the original error | restore path only |
| P2-5 | persistence | P2 | `src/storage/statsReset.ts:44-46` | make the reset atomic like `restoreBackup` | a mid-loop throw leaves some stores cleared and others not; user sees a readable error and can retry |
| P2-6 | persistence | P2 | `src/storage/sessionHistoryStorage.ts:105-116` | none proposed — see note | history appends forever with no cap; whole map re-serialized per session |
| P2-7 | build config | P2 | `mobile/__tests__/app-config.test.ts:38-39` | assert `ios.bundleIdentifier` as `buildNumber` already is | test-only |
| P2-8 | dead code | P2 | `supabase/migrations/0001_ranges.sql` and three siblings | report only — deleting files this run did not create is prohibited | four orphaned SQL files implying a backend that no longer exists |
| P2-9 | web observability | P2 | `src/main.tsx:21-23` | none proposed; failure is genuinely non-fatal | SW registration failure is swallowed with no signal |
| P2-10 | web | P2 | `src/main.tsx:10` | none proposed; `index.html` provides `#root` | non-null assertion on `getElementById` |
| P2-11 | dependencies | P2 | mobile prod tree: `image-size` (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq, high), `uuid` (GHSA-w5hq-g745-h8pq, moderate) | none — see NOT DEFECTS | build-time tooling only |

P2-6 note: capping session history would silently delete user records. That is a product decision, not a hardening fix, so no fix is proposed here. On the shipping iOS app MMKV has no small quota, so this degrades (slower synchronous JSON work per session) rather than failing; on web it would eventually exhaust the ~5MB origin quota, but web is not deployed. Recorded at P2 for that reason.

## ASSUMPTIONS

1. **"Production" is the iOS App Store binary; the web app is not deployed.** Evidence: `README.md:11-13`, absence of any deploy config, CI with no deploy job. Consequence: every web-only defect is capped at P2. This is the single most load-bearing assumption in this ledger — if the web app were in fact served to users, P2-1 through P2-3, P2-9 and P2-10 would all need re-rating.
2. **All nine keys share one MMKV instance**, so P0-1's blast radius is the whole library. Evidence: `mobile/platform/localStorageShim.ts:31-37` creates exactly one instance and every shim method routes through `getStore()`.
3. **The MMKVCore under `mobile/ios/Pods/` is the code that will ship.** It is the pod resolved by the committed `mobile/ios/Podfile.lock` for the pinned `react-native-mmkv@4.3.2`. Chosen conservatively: if EAS resolves a different MMKVCore, P0-1's trace would need re-confirming, but the shipped default could only be the same or worse.
4. **Severity ties break downward.** Where a finding could be argued either way it is recorded at the lower severity with the reason stated inline (P1-1 and P2-6 both).

## DEFERRED

Nothing deferred at Stage 0. This section is filled in during the passes if a fix's blast radius exceeds its prediction.

## NOT DEFECTS

- **`workout.v1` excluded from the backup.** Deliberate and documented, with the exclusion and its reason asserted by the coverage guard at `src/storage/backup.test.ts:69-73`: "the day-scoped 'workout done today' flag — restoring it would mark another device done". Restoring it would be the defect.
- **Bare `catch {}` blocks** at `src/storage/storageHelpers.ts:52`, `:58`, `src/storage/backup.ts:120`, `src/app/routes.ts:29`, `mobile/app/practice.tsx:53`. Each is a documented parse/IO guard that degrades to a defined value, not a swallowed failure. `storageHelpers.ts:41-46` explains the `SecurityError` case they exist for; writes still surface `SAVE_FAILED`.
- **No secrets in source or git history.** `git log --all --diff-filter=A` over every added path matches only `.env.example` (a template). A pickaxe search for DSN-shaped strings returns nothing. `mobile/ios/sentry.properties` is untracked and contains no token.
- **No PII reaches Sentry.** Every interpolated `throw` in `src/domain/` carries poker notation or card tokens only (`src/domain/cards.ts:42`, `src/domain/rangeNotation.ts:149`, and eleven siblings); `git grep` for range `notes`/`name` in a thrown message returns nothing. `attachScreenshot`, `attachViewHierarchy` and both replay sample rates are pinned off at `mobile/platform/crashReporting.ts:56-59`.
- **The `image-size` and `uuid` advisories (P2-11).** Both reach the tree only through `@expo/prebuild-config`, `@expo/config-plugins` and `expo-splash-screen`'s plugin — build-time tooling that parses the developer's own icon assets. Neither executes in the shipped Hermes bundle, and the app has no inbound network surface to carry attacker-controlled input to them. `npm audit --omit=dev` on the web root reports 0 vulnerabilities. Recorded rather than upgraded: this run may not upgrade dependencies except to patch a CVE on the work list.
- **Both error boundaries report rather than hide.** `mobile/components/ErrorBoundary.tsx:30-36` logs and calls `reportCaughtError`; `src/components/ErrorBoundary.tsx:34-37` logs.

## CANNOT ASSESS

- Whether `SENTRY_ORG` / `SENTRY_PROJECT` are already set as EAS secrets or profile env. The EAS environment is remote; connecting to it is prohibited.
- Real MMKV native recovery behavior against a genuinely corrupted store. Requires a device or simulator with a damaged MMKV file; Jest mocks the module entirely (`mobile/__mocks__/react-native-mmkv.ts`), so P0-1's fix is verifiable at the call site only.
- Whether an EAS-built binary resolves the same MMKVCore pod as the local `mobile/ios/Pods/` tree.
- Runtime behavior of the service worker in a real browser against a real redeploy. Only its unit tests were run.

## NEXT ROUND

Empty at Stage 0. Findings discovered after Review 0 — by the builder or any reviewer — are appended here and are **not** fixed in this run.
