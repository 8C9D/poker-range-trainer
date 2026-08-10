# REVIEW-0 — adversarial review of the Stage 0 ledger

Range reviewed: `21f568b..2c3334f`.
Target: `PROD-READINESS.md`, measured against `reviews/BASELINE.md` and the repo at `2c3334f`.
Reviewer re-ran every command and re-read every cited line. Builder narration was not available and was not assumed.

## Verdict: PASS-WITH-FINDINGS

Both work-list findings survive verification. P0-1's six-step trace is independently reproducible and correct at every step; P1-1's evidence matches verbatim. The baseline reproduces exactly. No fabricated work-list finding, no feature smuggled in, no prohibited action completed in the stage diff (which is two added Markdown files and nothing else).

The findings below are against the ledger, not against the code: one ASSUMPTION cites a file that is not committed, one boundary-table row is false *and was used to justify skipping a pass*, one NOT-DEFECTS reachability claim does not reproduce, DEFERRED is empty when it should not be, and the declared baseline is an undisclosed same-run commit that sits on `main`.

## What was verified and stands

| Ledger item | Status | How confirmed |
| --- | --- | --- |
| P0-1 trace steps 1-6 | **CONFIRMED** | every line re-read; see below |
| P0-1 fix value validity | **CONFIRMED** | `mobile/node_modules/react-native-mmkv/lib/specs/MMKVFactory.nitro.d.ts:20` — `export type RecoveryStrategy = 'discard-on-error' \| 'recover-on-error'`. The proposed `'recover-on-error'` is a real accepted value. |
| P0-1 fix actually reaches the defect | **CONFIRMED** | `mobile/ios/Pods/MMKVCore/Core/MMKV.cpp:116` `m_recoverStrategic = config.recover;` and `MMKV_IO.cpp:346,361` `strategic = m_recoverStrategic.has_value() ? m_recoverStrategic.value() : strategic;` — the option overrides the discarding callback on both the CRC and file-length paths. Not a relocated bug. |
| ASSUMPTION 2 (one MMKV instance) | **CONFIRMED** | `grep -rn "createMMKV" mobile/app mobile/components mobile/platform mobile/theme` → one hit, `localStorageShim.ts:34`. |
| Nine storage keys | **CONFIRMED** | nine `poker-range-trainer.<slice>.v1` constants across `src/storage/`; `restoreBackup` writes eight, `workout.v1` excluded. |
| P1-1 evidence | **CONFIRMED** | `mobile/app.json:84` is the bare string `"@sentry/react-native"`; `mobile/ios/sentry.properties` contains the two fallback comments verbatim; `LAUNCH-CHECKLIST.md:54` and `:185` document only `SENTRY_AUTH_TOKEN`. |
| Config surface = one runtime var | **CONFIRMED** | one `process.env` read in app code (`mobile/platform/crashReporting.ts:21`), one `import.meta.env` (`src/main.tsx:19`). |
| All P2 evidence lines | **CONFIRMED** | P2-1/2/3 (`public/service-worker.js:51`, `:12`+`:33`, `:1`/`:8`/`:12`), P2-4 (`backup.ts:244-250`), P2-5 (`statsReset.ts:44-46`), P2-6 (`sessionHistoryStorage.ts:105-116`), P2-7 (`app-config.test.ts:38-39`, and `bundleIdentifier` is indeed asserted nowhere), P2-8 (four SQL files), P2-9/P2-10 (`src/main.tsx:21-23`, `:10`) all say what the ledger claims. |
| NOT DEFECTS: bare `catch {}` | **CONFIRMED** | all five cited lines are `} catch {`, each degrading to a defined value. `HybridMMKV.cpp:130-132` throws when the native set fails, so the ledger's "writes still surface `SAVE_FAILED`" holds on iOS too, not just on web. |
| NOT DEFECTS: no PII to Sentry | **CONFIRMED, by a different route than the ledger used** | The ledger only checked thrown messages. The larger risk is `Sentry.wrap`'s `TouchEventBoundary`. Verified at `mobile/node_modules/@sentry/react-native/dist/js/touchevents.js:208-216`: the breadcrumb label comes from a `sentry-label` prop or a configured `labelName` key only — **not** `accessibilityLabel`. `wrapRootComponent` (`mobile/platform/crashReporting.ts:73`) passes no options, so range names in `library.tsx:670-671` never reach Sentry. Conclusion correct; reasoning was narrower than the risk. |
| Baseline reproduces | **CONFIRMED** | re-ran all three: `LINT_EXIT=0`; `Test Files 79 passed (79)` / mobile `Test Suites: 34 passed` / `Tests: 214 passed`; `BUILD_EXIT=0`. Matches `BASELINE.md` exactly. |
| No push / no history rewrite / no tag deletion | **CONFIRMED** | `git rev-parse --abbrev-ref @{u}` → "no upstream configured"; `git branch -r` shows only `origin/main` and `origin/archive/full-featureset`; tag `pre-trim-full-featureset` intact. |

P0-1 severity is **defensible and not inflated**. The ledger states the likelihood argument honestly and rates on consequence. One nuance it omits without changing the rating: `MMKV_IO.cpp:342,357` calls `checkLastConfirmedInfo()` *before* consulting the strategy, so a last-confirmed-location recovery is attempted first. The discard is the last resort, not the first.

P1-1 severity is **correct, not deflated**. Unsymbolicated crash frames are the literal P1 criterion ("undiagnosable in prod") and lose no data. The doc-only fix is the right scope choice — adding `organization`/`project` to `app.json` would need the user's Sentry org slug, which is not knowable here.

---

## Findings

### R0-1 | P1 | ASSUMPTION 3 cites a file that is not committed, and the P0 trace is not reproducible from a clean clone

**Evidence.** `PROD-READINESS.md:124` states P0-1's MMKVCore is "the pod resolved by the committed `mobile/ios/Podfile.lock`".

```
$ git ls-files mobile/ios | wc -l
       0
$ git check-ignore -v mobile/ios/Podfile.lock
mobile/.gitignore:40:/ios	mobile/ios/Podfile.lock
```

`mobile/.gitignore:40` ignores `/ios` outright. The Podfile.lock is not committed; it is a local prebuild artifact, as is the entire `mobile/ios/Pods/MMKVCore/` tree that P0-1's trace steps 3, 4 and 6 depend on. A reviewer given only "the repo at the current commit" — which is what the review contract specifies — plus `npm ci` has none of those files and cannot reproduce the ledger's single P0.

A tracked-reproducible pin exists and was missed: `mobile/node_modules/react-native-mmkv/NitroMmkv.podspec:27` is `s.dependency 'MMKVCore', '2.4.0'` — an **exact** pin, resolvable from the committed `mobile/package-lock.json`, which also pins `react-native-mmkv@4.3.2`. That closes ASSUMPTION 3 far more tightly than the local lock did: EAS cannot resolve a different MMKVCore major, because the podspec forbids it.

**Why the builder missed it.** It read `mobile/ios/Podfile.lock` off disk, saw a real file with real contents, and never asked `git ls-files` whether the file it was quoting was in the artifact the reviewer receives. The whole `mobile/ios/` tree looks committed from the filesystem and is not.

**Effect on the work list.** P0-1 stands — I re-verified every trace step against the same local files and confirmed the podspec's exact pin. Its evidence must be re-anchored to `NitroMmkv.podspec:27` plus `mobile/package-lock.json`, and ASSUMPTION 3's "committed" must be struck.

### R0-2 | P2 | The boundary table's "no inbound surface" row is false, and it was used to skip a pass

**Evidence.** `PROD-READINESS.md:42` records `| Network in | no | no server, no endpoints, no inbound surface |`, and `PROD-READINESS.md:64` says "Trust boundary: exactly one — imported backup JSON."

```
$ grep -n "scheme" mobile/app.json
5:    "scheme": "pokerrangetrainer",

$ grep -A6 CFBundleURLSchemes mobile/ios/*/Info.plist
    <key>CFBundleURLSchemes</key>
    <array>
        <string>pokerrangetrainer</string>
        <string>com.arthurzhang.pokerrangetrainer</string>
    </array>
```

The shipped binary registers two URL schemes. Any other app or web page on the device can drive expo-router to any route with attacker-chosen params. That is an inbound surface and a second untrusted-input path.

This matters beyond bookkeeping because `PROD-READINESS.md:49` uses the table to justify skipping work: "Passes whose boundary does not exist here are skipped: authn/authz, **injection, unsafe deserialization of untrusted input** …". A pass was skipped on the strength of a row that is wrong.

**What I found when I ran the skipped pass.** No exploitable defect. `mobile/app/practice.tsx:75-80,108` validates every param (`asMode`, `commaList`, `handList`, `parsePools` filtering through `isValidHand`), `findSavedRangeById` drops ids that do not exist, and `mobile/app/range/[id].tsx:69` resolves against the live library. Nothing from a link is written to storage. The code is safe — but the ledger arrived at "safe" by assuming the boundary away, not by inspecting it.

**Why the builder missed it.** It enumerated boundaries from the network-service mental model — server, endpoints, listeners — and a mobile app's URL scheme registers as an app-config key, not as an ingress. `app.json` was read for P1-1 (line 84) without line 5 registering as a boundary.

### R0-3 | P2 | The P2-11 reachability claim does not reproduce

**Evidence.** `PROD-READINESS.md:137` claims both advisories "reach the tree only through `@expo/prebuild-config`, `@expo/config-plugins` and `expo-splash-screen`'s plugin".

```
$ npm ls image-size --omit=dev --all      (in mobile/)
mobile@1.0.0
└─┬ expo@56.0.19
  └─┬ @expo/metro@56.0.0
    └─┬ metro@0.84.4
      └── image-size@1.2.1

$ npm ls uuid --omit=dev --all
mobile@1.0.0
└─┬ expo-sharing@56.0.24
  └─┬ @expo/config-plugins@56.0.14
    └─┬ xcode@3.0.1
      └── uuid@7.0.3
```

`image-size` arrives through **Metro**, not through any of the three named packages. `uuid` arrives through `expo-sharing` → `@expo/config-plugins` → `xcode`; only the middle link was named. `@expo/prebuild-config` and `expo-splash-screen` are on neither path. The stated rationale ("parses the developer's own icon assets") survives for both by coincidence — Metro sizes image assets at bundle time, `xcode` mints project UUIDs — so the conclusion (build-time only, absent from the Hermes bundle, no attacker-controlled input) holds and P2-11's rating stands. The evidence as written does not.

**Why the builder missed it.** It reasoned about which Expo subsystems *would plausibly* pull an image parser rather than running `npm ls` on the two package names, and the plausible answer was wrong.

### R0-4 | P2 | P2-11 omits the number a reader reproducing it will see

**Evidence.** `npm audit --omit=dev` in `mobile/` prints `55 vulnerabilities (7 moderate, 48 high)`. The ledger's P2-11 row lists two packages and no count, so anyone re-running the command lands 53 entries away from the ledger and has no way to tell whether the gap is under-reporting.

I re-derived it from the audit JSON: exactly two entries carry a direct advisory (`image-size` high, `uuid` moderate); the other 53 are `"depends on a vulnerable version of…"` propagation up through the Expo/Metro/React Native tree. **The ledger's two-package list is substantively correct.** It is the reconciliation that is missing, and the `npm audit --omit=dev` → "0 vulnerabilities" line quoted at `PROD-READINESS.md:137` is the *web* root's result, which makes the omission easier to read as sleight of hand than it is.

**Why the builder missed it.** It reported the conclusion of its triage without the raw number that triage started from — the one number a reviewer reproduces first.

### R0-5 | P1 | The declared baseline is an undisclosed same-run commit, and it sits on `main`

**Evidence.**

```
$ git reflog
2c3334f HEAD@{0}: commit: docs: add the production-readiness ledger…
c046ce2 HEAD@{1}: commit: chore: record the pre-sweep baseline…
21f568b HEAD@{2}: checkout: moving from main to prod-readiness/2026-08-10
21f568b HEAD@{3}: commit: chore: set the iOS bundle identifier and point the native scripts at expo run

$ git log --format='%H %ci' -3
2c3334f… 2026-08-10 19:16:53
c046ce2… 2026-08-10 19:06:48
21f568b… 2026-08-10 19:01:27      <- declared baseline
f888078… 2026-08-06 21:06:39      <- last pre-run commit, = origin/main

$ git log --oneline origin/main..main
21f568b chore: set the iOS bundle identifier and point the native scripts at expo run
```

`21f568b` — the commit `PROD-READINESS.md:5` and `BASELINE.md:6` both name as the baseline — was created at 19:01:27, five minutes before the baseline capture and immediately before the work branch was cut. Its three files (`mobile/app.json`, `mobile/package.json`, `mobile/tsconfig.json`) are exactly the three that were dirty in the working tree when the run began. `BASELINE.md:10` records "Working tree: clean at capture time" and does not disclose that the tree was made clean by committing it.

What that commit contains is not neutral:

- `mobile/package.json`: `"ios": "expo start --ios"` → `"expo run:ios"` (and the same for android) — a build-invocation change.
- `mobile/tsconfig.json`: every array re-expanded across multiple lines — a pure reformat, which the scope constraint names explicitly ("Do not reformat, reorganize directories, or upgrade frameworks as a side effect").
- `mobile/tsconfig.json`: `"include"` loses `"expo-env.d.ts"`. Locally harmless — the file is gitignored (`mobile/.gitignore:10`) and absent, which is why `npm run build` stayed green — but it silently narrows what `tsc --noEmit` covers on any machine where prebuild has generated it, which is every EAS build.
- `mobile/app.json`: adds `ios.bundleIdentifier`, which is what P2-7 then proposes writing a test for.

Because these landed *in* the baseline rather than above it, they sit below the stage diff and outside every review this sweep will run. They are also on `main`, one commit ahead of `origin/main`, not on the work branch — against "All work stays local on the branch created below." Nothing was pushed, so no prohibited action completed.

**Why the builder missed it.** It treated "get to a clean tree so the baseline is meaningful" as setup rather than as a change, and a commit made before the branch exists does not feel like part of the run. But the baseline is the one artifact every later green claim is measured against, and a baseline the run authored needs saying so out loud.

### R0-6 | P2 | DEFERRED is empty; the app's second-largest data-loss path belongs in it

**Evidence.** `PROD-READINESS.md:129`: "Nothing deferred at Stage 0."

`mobile/components/BackupPanel.tsx:52-66` — one tap on "Restore from a file", one file picked, and `restoreBackup(backup)` replaces all eight library keys. No confirmation, no undo, no "this will replace N ranges" step. `src/screens/AccountScreen.tsx:78` is the same: `restoreBackup(parseBackup(await file.text()))`. Restoring a stale export silently destroys every session recorded since it was written.

By the ledger's own frame — `PROD-READINESS.md:58-59`, "data durability on device outranks everything", the user's data "exists in exactly one place" — this is the largest remaining data-loss path after P0-1. A confirmation step is a new user-visible capability, so it is correctly *not fixable* in this run. That is exactly what DEFERRED is for: `PROD-READINESS.md:129` says the section is for fixes whose blast radius exceeds their prediction, and the scope constraint says "When a fix would require a new feature, log it under DEFERRED with reasoning and move on." It appears nowhere — not as a finding, not as DEFERRED, not as NOT DEFECTS.

**Why the builder missed it.** It read the restore path for the trust-boundary question ("is the input validated?" — yes, thoroughly) and stopped there, never asking the durability question about the same call site. `validateBackup` guards against a *malformed* file; nothing guards against a *valid, stale* one.

### R0-7 | P2 | Unbounded read at the one trust boundary the ledger did name

**Evidence.** `mobile/components/BackupPanel.tsx:61` — `parseBackup(await readAsStringAsync(uri))` pulls a user-picked file wholly into a JS string, then `JSON.parse`s it, with no size check. `src/screens/AccountScreen.tsx:78` does the same via `file.text()`. `DocumentPicker.getDocumentAsync({ type: 'application/json' })` filters by declared type, not size. A large file OOMs the app before `validateBackup` ever runs.

Low exploitability — the user picks the file. But the ledger states this is the *single* trust boundary in the product and that it "is validated by `validateBackup` … before it replaces the library" (`PROD-READINESS.md:64`). Size is the one property `validateBackup` structurally cannot check, because the crash happens upstream of it.

**Why the builder missed it.** It equated "validated" with "safe" and audited the validator, not the read that feeds it.

### R0-8 | P2 | The P0 fix as specified is unfalsifiable, and part of it is assertable

**Evidence.** `mobile/__mocks__/react-native-mmkv.ts:7` is `export function createMMKV() {` — **no parameters at all**. No existing test can observe the config object the shim passes. P0-1's fix column proposes no test, so after the fix nothing in the suite would notice the option being dropped again.

The ledger is right that native recovery behavior is CANNOT ASSESS (`PROD-READINESS.md:143`) — Jest mocks the module and no simulator is reachable. But it draws the unverifiable line one step too far out. Whether `createMMKV` is *called with* `{ id, recoveryStrategy: 'recover-on-error' }` is assertable today with a spy on the mock, and that is the assertion that keeps the fix from silently regressing. `CLAUDE.md` requires tests when behavior changes; the sweep's only P0 currently plans none.

**Why the builder missed it.** "The native behavior can't be tested" collapsed into "this can't be tested", and the mock's zero-arg signature made the gap invisible from the call site.

---

## Checks run that produced nothing

- **Fabricated findings** — none. Every work-list and P2 evidence line resolves to code saying what is claimed.
- **Features smuggled in** — none. `recoveryStrategy` is an option on an existing call, not a new config key; P1-1's fix is prose in an existing file.
- **Prohibited actions** — none completed. No push (no upstream), no rewrite, no tag deletion, no dependency change, no CI/deploy edit, no non-local connection, no deletion. See R0-5 for the branch-containment deviation.
- **Fixes that relocate rather than remove** — N/A, no code changed. P0-1's proposed fix was traced to the consuming line (`MMKV_IO.cpp:346,361`) and does remove the defect.
- **Error handling that hides errors** — the five bare `catch {}` blocks and both error boundaries were re-read; the NOT DEFECTS classification is correct. `HybridMMKV::set` throwing on failure (`HybridMMKV.cpp:130-132`) confirms the iOS write path surfaces `SAVE_FAILED` rather than swallowing it.
- **Anything resolved without an artifact** — nothing is marked resolved at Stage 0.
- **Storage-shim install ordering** — checked, non-issue: no `src/storage` module touches `localStorage` at import time, so the `_layout.tsx:3-4` ordering claim cannot be violated by route-module load order.

## Disposition for the frozen work list

| id | disposition |
| --- | --- |
| P0-1 | **STANDS.** Re-anchor evidence to `mobile/node_modules/react-native-mmkv/NitroMmkv.podspec:27` + `mobile/package-lock.json` (R0-1). Add a call-site assertion (R0-8). |
| P1-1 | **STANDS** as written. |
| P2-11 | **STANDS**; correct the reachability paths (R0-3) and record the audit's headline count (R0-4). |
| all other P2 | **STAND** as written. |

Ledger text requiring correction before the work list freezes: `:42` (Network in), `:49` (skipped passes), `:64` (one trust boundary), `:124` ("committed" Podfile.lock), `:129` (DEFERRED), `:137` (advisory paths); `BASELINE.md:10` (working-tree provenance). New DEFERRED entry: R0-6. New NEXT ROUND candidates: R0-7.
