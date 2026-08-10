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
| Network in | no server, but **one inbound surface** | no endpoints or listeners, but the binary registers two URL schemes (`mobile/app.json:5`), so any app or web page on the device can drive expo-router to any route with chosen params — corrected per R0-2 |
| Network out | none in-app | except Sentry when the DSN is set |
| Auth | no | no accounts (`README.md:16-17`) |
| Payments | no | none |
| Background jobs | no | none |
| Database / queue | no | `supabase/migrations/` is orphaned; cloud sync was archived out of v1 |

Passes whose boundary does not exist here are skipped: authn/authz, retries/backoff/idempotency against remote dependencies, health endpoints.

**Corrected per R0-2.** This originally also listed "injection, unsafe deserialization of untrusted input" as skipped, justified by a boundary row that was wrong. That pass was subsequently run against both untrusted-input paths and found no exploitable defect: deep-link params are validated at `mobile/app/practice.tsx:75-80` and `:108` (`asMode`, `commaList`, `handList`, and `parsePools` filtering through `isValidHand`), unknown ids are dropped by `findSavedRangeById`, `mobile/app/range/[id].tsx:69` resolves against the live library, and nothing arriving from a link is written to storage. The conclusion the ledger originally assumed is correct; it is now inspected rather than assumed.

### What can be executed to verify a change

Lint, both test suites, both typechecks, the Vite production build, and the iOS Hermes bundle export — all local, all confirmed working. Nothing here is a P0.
What **cannot** be exercised: real MMKV native behavior (Jest mocks it — `mobile/__mocks__/react-native-mmkv.ts`), and anything in the EAS build environment (remote, and prohibited by this run's rules).

### What "production" means here, and who breaks

A single-player, offline, on-device study tool. There is no server to take down and no other user to affect. **The person who breaks is the individual user on their iPhone, and the thing they lose is their own data** — hand-built ranges and months of practice history that exist in exactly one place, with no account, no backend, and no automatic backup. The only recovery net is a JSON backup the user must have chosen to export.
That shapes every severity call below: data durability on device outranks everything, and web-app defects are near-cosmetic because no user ever loads the web app.

### Entry points, trust boundaries, config surface

- Entry points: `mobile/app/_layout.tsx` (router root; installs the storage/crypto shims on lines 3-4 before any `@core` module loads), `src/main.tsx` (web root).
- Trust boundaries: **two** (corrected per R0-2). (1) Imported backup JSON, validated by `validateBackup` (`src/storage/backup.ts:136`) before it replaces the library, with every per-slice loader re-validating on read — but see R0-7 in NEXT ROUND for the unbounded read that feeds it. (2) Deep-link params over the two registered URL schemes, validated as described above.
- Config surface: one variable, `EXPO_PUBLIC_SENTRY_DSN` (`.env.example:7`), absence-tolerant by design. Build-time only: `SENTRY_AUTH_TOKEN`, plus the two undocumented ones in P1-1.

## Findings

Severity: **P0** = data loss, security exposure, silent failure, or cannot deploy. **P1** = fails under realistic load or edge input, or undiagnosable in prod. **P2** = everything else.

### Work list (P0/P1) — FROZEN after Review 0

Four findings. Review 0 returned PASS-WITH-FINDINGS; both original work-list findings survived verification, and Review 0's own two P1s joined the list per the termination rules. Everything found after this point goes to NEXT ROUND, not here.

| id | area | sev | evidence (file:line) | fix | blast radius | status |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | persistence | P0 | `mobile/platform/localStorageShim.ts:34` | pass `recoveryStrategy: 'recover-on-error'` to `createMMKV`, plus a call-site assertion per R0-8 | one call site, one option; changes native recovery behavior for the single MMKV instance holding all nine keys | RESOLVED |
| P1-1 | observability | P1 | `mobile/app.json:84`, `LAUNCH-CHECKLIST.md:54`, `LAUNCH-CHECKLIST.md:185` | document `SENTRY_ORG` and `SENTRY_PROJECT` next to `SENTRY_AUTH_TOKEN` | documentation only; zero runtime effect | RESOLVED |
| R0-1 | ledger integrity | P1 | `PROD-READINESS.md` ASSUMPTION 3; `mobile/.gitignore:40` | re-anchor P0-1's trace to the tracked exact pin `NitroMmkv.podspec:27` | ledger text only | RESOLVED |
| R0-5 | baseline provenance | P1 | `reviews/BASELINE.md:10`; `git log origin/main..main` | disclose that baseline `21f568b` was authored in this run and sits on `main` | ledger + baseline text only | RESOLVED |

**R0-5 — one sub-claim struck on evidence.** Review 0 argued that dropping `"expo-env.d.ts"` from `mobile/tsconfig.json`'s `include` "silently narrows what `tsc --noEmit` covers on any machine where prebuild has generated it". That is **false**, and the reviewer's claim was treated as a lead rather than a fact. The surviving `include` glob is `["**/*.ts", "**/*.tsx"]`, and `expo-env.d.ts` matches `**/*.ts`. Verified by generating the file and asking the compiler which files are in its program:

```
$ cd mobile && npx tsc --noEmit --listFiles | grep expo-env
/Users/<user>/dev/poker-range-trainer/mobile/expo-env.d.ts
```

The file is in the program; the removed entry was redundant with the glob. (A first attempt to test this by putting a deliberate error inside the `.d.ts` was inconclusive, because `expo/tsconfig.base` sets `skipLibCheck: true`; the `--listFiles` check is the one that settles it.) The generated file was deleted afterwards and the tree is clean. The rest of R0-5 — undisclosed provenance, and the commit sitting on `main` — stands and is fixed below.

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
3. **The MMKVCore under `mobile/ios/Pods/` is the code that will ship.** ~~It is the pod resolved by the committed `mobile/ios/Podfile.lock`.~~ **Struck and re-anchored per R0-1**: `mobile/ios/` is gitignored (`mobile/.gitignore:40`) and `git ls-files mobile/ios` returns zero, so nothing under it is committed and steps 3, 4 and 6 of P0-1's trace cannot be reproduced from a clean clone. The tracked, exact pin is `mobile/node_modules/react-native-mmkv/NitroMmkv.podspec:27` — `s.dependency 'MMKVCore', '2.4.0'` — reachable from the committed `mobile/package-lock.json`, which pins `react-native-mmkv@4.3.2`. That is a stronger anchor than the local lock: the podspec forbids EAS resolving a different MMKVCore version at all.
4. **Severity ties break downward.** Where a finding could be argued either way it is recorded at the lower severity with the reason stated inline (P1-1 and P2-6 both).

## DEFERRED

**D-1 — a one-tap restore silently destroys everything recorded since the backup was written.** Added per R0-6.
`mobile/components/BackupPanel.tsx:52-66`: one tap on "Restore from a file", one file picked, and `restoreBackup(backup)` replaces all eight library keys. `src/screens/AccountScreen.tsx:78` is the same. There is no confirmation step, no "this will replace N ranges" preview, and no undo. `validateBackup` guards against a *malformed* file; nothing guards against a *valid but stale* one.

By this ledger's own frame — data durability on device outranks everything, and the user's data exists in exactly one place — this is the largest remaining data-loss path after P0-1. It is deferred rather than fixed because every available fix (a confirmation dialog, a pre-restore auto-backup, an undo) is a new user-visible capability, which the scope constraint forbids. That is exactly what DEFERRED is for. It should be the first item considered in the next run, ahead of anything in NEXT ROUND.

## NOT DEFECTS

- **`workout.v1` excluded from the backup.** Deliberate and documented, with the exclusion and its reason asserted by the coverage guard at `src/storage/backup.test.ts:69-73`: "the day-scoped 'workout done today' flag — restoring it would mark another device done". Restoring it would be the defect.
- **Bare `catch {}` blocks** at `src/storage/storageHelpers.ts:52`, `:58`, `src/storage/backup.ts:120`, `src/app/routes.ts:29`, `mobile/app/practice.tsx:53`. Each is a documented parse/IO guard that degrades to a defined value, not a swallowed failure. `storageHelpers.ts:41-46` explains the `SecurityError` case they exist for; writes still surface `SAVE_FAILED`.
- **No secrets in source or git history.** `git log --all --diff-filter=A` over every added path matches only `.env.example` (a template). A pickaxe search for DSN-shaped strings returns nothing. `mobile/ios/sentry.properties` is untracked and contains no token.
- **No PII reaches Sentry.** Every interpolated `throw` in `src/domain/` carries poker notation or card tokens only (`src/domain/cards.ts:42`, `src/domain/rangeNotation.ts:149`, and eleven siblings); `git grep` for range `notes`/`name` in a thrown message returns nothing. `attachScreenshot`, `attachViewHierarchy` and both replay sample rates are pinned off at `mobile/platform/crashReporting.ts:56-59`.
- **The `image-size` and `uuid` advisories (P2-11).** Dependency paths corrected per R0-3; the original ones were reasoned about rather than resolved, and were wrong. Verified with `npm ls --omit=dev --all` in `mobile/`:
  - `image-size@1.2.1` ← `metro@0.84.4` ← `@expo/metro@56.0.0` ← `expo@56.0.19`. Metro sizes image assets at bundle time.
  - `uuid@7.0.3` ← `xcode@3.0.1` ← `@expo/config-plugins@56.0.14` ← `expo-sharing@56.0.24`. `xcode` mints project UUIDs.

  Both are build-time tooling operating on the developer's own files. Neither executes in the shipped Hermes bundle, and no attacker-controlled input reaches them. Reconciling the headline count per R0-4: `npm audit --omit=dev` in `mobile/` prints **55 vulnerabilities (7 moderate, 48 high)**, of which exactly two carry a direct advisory — the two above; the other 53 are "depends on a vulnerable version of…" propagation up the Expo/Metro/React Native tree. Separately, `npm audit --omit=dev` at the **web** root reports 0 vulnerabilities. Recorded rather than upgraded: this run may not upgrade dependencies except to patch a CVE on the work list.
- **Both error boundaries report rather than hide.** `mobile/components/ErrorBoundary.tsx:30-36` logs and calls `reportCaughtError`; `src/components/ErrorBoundary.tsx:34-37` logs.

## CANNOT ASSESS

- Whether `SENTRY_ORG` / `SENTRY_PROJECT` are already set as EAS secrets or profile env. The EAS environment is remote; connecting to it is prohibited.
- Real MMKV native recovery behavior against a genuinely corrupted store. Requires a device or simulator with a damaged MMKV file; Jest mocks the module entirely (`mobile/__mocks__/react-native-mmkv.ts`), so P0-1's fix is verifiable at the call site only.
- Whether an EAS-built binary resolves the same MMKVCore pod as the local `mobile/ios/Pods/` tree.
- Runtime behavior of the service worker in a real browser against a real redeploy. Only its unit tests were run.

## NEXT ROUND

Findings discovered after Review 0 — by the builder or any reviewer — are appended here and are **not** fixed in this run, regardless of severity. Recorded with full evidence so the next run starts from them.

**N-1 (P2) — unbounded read at the backup trust boundary.** From R0-7.
`mobile/components/BackupPanel.tsx:61` calls `parseBackup(await readAsStringAsync(uri))`, pulling a user-picked file wholly into a JS string and then `JSON.parse`-ing it, with no size check. `src/screens/AccountScreen.tsx:78` does the same via `file.text()`. `DocumentPicker.getDocumentAsync({ type: 'application/json' })` filters by declared type, not size, so a large file exhausts memory before `validateBackup` ever runs. Size is the one property `validateBackup` structurally cannot check, because the failure happens upstream of it. Low exploitability — the user picks the file themselves.
