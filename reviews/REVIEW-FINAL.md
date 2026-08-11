# REVIEW-FINAL - adversarial review of the complete sweep

Range reviewed: `21f568b..d6822c8` (the complete diff, all eight commits).
Target: the repo at `d6822c8`, `PROD-READINESS.md`, `reviews/BASELINE.md`, `reviews/REVIEW-0.md`, `reviews/REVIEW-1.md`, `reviews/REVIEW-1B.md`.
I am a different reviewer from the three that preceded me.
No prior verdict was borrowed as evidence: every claim below was re-derived from the tree or from a command I ran myself, and prior findings were treated as leads to re-test.
No builder narration was available and none was assumed.

## Verdict: PASS-WITH-FINDINGS

The shipped change is three files and sixty-one lines, and it holds up under every test I could apply.
`recoveryStrategy: 'recover-on-error'` is traced end to end through the exact code that will ship, the guard test is falsifiable (I mutated the shim myself and it failed, precisely once), the option is present in the exported Hermes bundle, and validation is green against `BASELINE.md` with the mobile count up by exactly the one new test.
All four frozen work-list rows have an artifact I located in the tree.
No feature was smuggled in, no prohibited action beyond the disclosed `rm -rf mobile/dist` appears anywhere in the history, nothing was pushed, and the work list never expanded: the only code touched is P0-1's call site plus the assertion Review 0 asked for, and everything found later went to NEXT ROUND or stayed DEFERRED.

Six findings, all P2, all against the ledger's evidence discipline rather than the code.
None of them causes a reader to ship broken software, so none is blocking.

The one that matters most is FR-1: the sweep's only P1 rests on a consequence claim ("the source-map upload is skipped") that the artifacts in this very tree contradict, and that claim was copied verbatim into the user-facing checklist as the fix.
Every pass verified the upstream half of that chain and none read the script that consumes it.

The pattern REVIEW-1B named - the builder fixes the named instance and reintroduces the class - continues into the final commit, which is where FR-3, FR-4 and FR-6 live.
It is a shrinking pattern, not a drifting one: the fixes get smaller and stay inside the ledger, and nothing turns into scope expansion.

---

## Findings

### FR-1 | P2 | P1-1's consequence claim is contradicted by artifacts in this tree, and the fix copied it into the user-facing checklist

**Evidence.**
`PROD-READINESS.md:128` - "A build that follows the documented checklist exactly therefore uploads no source maps, and every production crash arrives as minified Hermes frames."
`LAUNCH-CHECKLIST.md:194` (written by the fix) - "With either unset the source-map upload has no destination and is skipped, and every crash in App Store Connect and Sentry shows minified Hermes frames instead of your source."
`.env.example:20` (written by the fix) - "with either unset, production crashes stay unsymbolicated."

What the tree actually shows:

```
$ sed -n '224p' mobile/ios/PokerRangeTrainer.xcodeproj/project.pbxproj | tr '\\' '\n' | grep -n sentry
84:"require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode.sh'
```

The "Bundle React Native code and images" phase invokes `sentry-xcode.sh` (`:344` adds a second phase, "Upload Debug Symbols to Sentry").
`mobile/node_modules/@sentry/react-native/scripts/sentry-xcode.sh:52-63,76`:

```
if [ "$SENTRY_DISABLE_AUTO_UPLOAD" != true ]; then
  ...
  else
    echo "error: sentry-cli - To disable source maps auto upload, set SENTRY_DISABLE_AUTO_UPLOAD=true ... Or to allow failing upload, set SENTRY_ALLOW_FAILURE=true"
    exitCode=1
...
exit $exitCode
```

A failing `sentry-cli` is an `error:` and a non-zero exit, not a skip.
The only skip is `SENTRY_DISABLE_AUTO_UPLOAD=true`, and the only tolerated failure is `SENTRY_ALLOW_FAILURE`; `grep -rn "SENTRY_ALLOW_FAILURE\|SENTRY_DISABLE_AUTO_UPLOAD"` finds neither anywhere outside the two vendored scripts - not in `mobile/eas.json`, not in `mobile/app.json`, not in the checklist.
And missing org/project is a hard configuration error in the CLI, not a skip.
From `strings` on `mobile/node_modules/@sentry/cli-darwin/bin/sentry-cli` (v2.58.4, the binary those scripts resolve):

```
An organization ID or slug is required (provide with --org)
A project ID or slug is required (provide with --project)
Command failed, however, "SENTRY_ALLOW_FAILURE" variable or "allow-failure" flag was set. Exiting with 0 exit code.
```

Every "skipping upload" string in that binary belongs to the debug-file (`dif_upload`) path, and the one lenient message - "warning: no project specified. While this upload will succeed..." - belongs to the proguard path, which is Android.

So the documented state (auth token set, org and project unset) points at the iOS bundle phase **failing the build**, not at a silent unsymbolicated build.
I cannot close this: finishing the proof means running `sentry-cli` against sentry.io or reading an EAS build log, both non-local and both prohibited.
That is precisely why the correct disposition is CANNOT ASSESS, and `PROD-READINESS.md:196` records only the adjacent question ("whether `SENTRY_ORG` / `SENTRY_PROJECT` are already set as EAS secrets"), never this one.

The severity consequence is real but unresolvable here: under this ledger's own rubric (`:71`, "P0 = ... or cannot deploy"), a build that fails is not a P1.
P1-1's rating rests on a consequence that the tree argues against.
Rated P2 by me because the corrective action is identical either way, the fix that landed is correct and complete for its purpose, and a failed build announces itself.

**Why the builder missed it.**
Every pass verified the upstream half of the chain and stopped there: `mobile/app.json:84` is a bare plugin string (true), and `mobile/ios/sentry.properties:2-3` says it falls back to the two environment variables (true, I re-read it).
`sentry.properties` states that a fallback exists; it says nothing about what happens when the fallback resolves to nothing.
REVIEW-0 and REVIEW-1B both cite those same two lines as confirmation, so three passes confirmed the premise and none followed it to the consumer.

### FR-2 | P2 | P1-1's fix updated two of the three tracked places that instruct the user on Sentry build vars

**Evidence.**

```
$ git grep -n SENTRY_AUTH_TOKEN -- docs
docs/ios-store-listing.md:92:- Setting `EXPO_PUBLIC_SENTRY_DSN` (and `SENTRY_AUTH_TOKEN` for source maps) in the EAS production profile, per LAUNCH-CHECKLIST.md steps 2 and 7.
```

That line sits under `docs/ios-store-listing.md:86`, "## Still your job (not in this draft)" - an actionable instruction to the user, in the same register as the checklist item the fix rewrote.
`PROD-READINESS.md:82` names the fix's artifacts as `LAUNCH-CHECKLIST.md:54-56`, `:184-195` and `.env.example:12-21` only.
Mitigating, and the reason this is P2 rather than P1: the line defers to "LAUNCH-CHECKLIST.md steps 2 and 7", which are now correct, so a reader who follows the pointer lands on the full list.

**Why the builder missed it.**
The completeness check used throughout the trail is `git grep "SENTRY_ORG\|SENTRY_PROJECT"` - REVIEW-1 F1's evidence block, and G1's re-run of the same command.
That grep can only find places already fixed; it structurally cannot find a place that mentions only the token.
The grep that finds it is on `SENTRY_AUTH_TOKEN`, which is the string the finding defines itself against ("document `SENTRY_ORG` and `SENTRY_PROJECT` **next to** `SENTRY_AUTH_TOKEN`"), and nobody in four passes ran it.

### FR-3 | P2 | The G1 remediation replaced a false present-tense claim with a past-tense one that is false at both ends it names

**Evidence.**
`PROD-READINESS.md:128` now reads "**As of the baseline, and up to commit `32d579f`,** `git grep` for `SENTRY_ORG` and `SENTRY_PROJECT` across the tracked tree returned **nothing**".

```
$ git grep -c "SENTRY_ORG\|SENTRY_PROJECT" 32d579f
.env.example:2   LAUNCH-CHECKLIST.md:5   PROD-READINESS.md:6   reviews/REVIEW-1.md:3

$ git grep -n "SENTRY_ORG\|SENTRY_PROJECT" 598728c        # last commit before the fix
PROD-READINESS.md:80, :110, :111, :114, :164              (5 hits, all the ledger's own text)
```

At `32d579f` the command returns sixteen hits across four files; at `598728c` it returns five.
The sentence is true only of `21f568b` and `c046ce2`, before the ledger existed.
The sub-clauses that follow ("neither is set in `mobile/eas.json`, mentioned in `.env.example`, or listed in `LAUNCH-CHECKLIST.md`") carry the real claim and were correct then, so no reader is misled about substance - but the command a reviewer re-runs still disagrees with the sentence above it, which was the entirety of G1's complaint.

**Why the builder missed it.**
The correction was written to answer the reviewer's quoted sentence rather than re-derived by running the command at the commit it names.
This is the third generation of one defect class: stale anchors (F4, F6), then an imprecise range and a dead anchor (G1, G3), now an imprecise commit boundary.
Each generation is smaller than the last and each is introduced by the commit that fixes the previous one.

### FR-4 | P2 | D-1 received the severity label G6 asked for, and the label contradicts the ledger's own rubric

**Evidence.**
`PROD-READINESS.md:158` (changed in `d6822c8`) - "**D-1 (P1)** - the iOS restore path dropped the confirmation the web path has, so one tap silently destroys everything recorded since the backup was written."
`PROD-READINESS.md:71` - "**P0** = data loss, security exposure, silent failure, or cannot deploy."
`PROD-READINESS.md:165` - "it is the largest remaining data-loss path after P0-1."
`PROD-READINESS.md:154` (ASSUMPTION 4) - "Where a finding could be argued either way it is recorded at the lower severity **with the reason stated inline** (P1-1 and P2-6 both)."

D-1 is silent, total-since-backup, unrecoverable data loss on the shipping surface, described by the ledger as second only to the item it rated P0, and it is labelled one notch below the criterion that names it with no inline reason - the one procedural requirement ASSUMPTION 4 attaches to a downward call.
I verified both of its anchors again and they are right: `src/screens/AccountScreen.tsx:72-76` is the `window.confirm` gate; `mobile/components/BackupPanel.tsx:61-62` is `parseBackup(await readAsStringAsync(uri))` followed immediately by `restoreBackup(backup)`.
Mitigating: the prose already orders it first for the next run, ahead of NEXT ROUND, so the label does not change what happens next.

**Why the builder missed it.**
G6 asked for "a rating" and the answer was supplied as a one-token edit in the final commit, without testing the token against the rubric printed five lines above the work-list table or against the requirement in ASSUMPTION 4.
Fixing the reviewer's sentence, not the reviewer's point.

### FR-5 | P2 | The secret-scan claim in NOT DEFECTS does not reproduce as written; the conclusion survives

**Evidence.**
`PROD-READINESS.md:173` - "A pickaxe search for DSN-shaped strings returns nothing."

```
$ git log --all -S"ingest.sentry.io" --oneline
6c9cd22 feat: add DSN-gated Sentry crash reporting to the mobile app
1a325c3 docs: add the launch checklist
```

Both hits are placeholders: `mobile/__tests__/crash-reporting.test.ts:93` `const DSN = 'https://key@o0.ingest.sentry.io/0'`, and `LAUNCH-CHECKLIST.md:133` `https://<hash>@o<org>.ingest.sentry.io/<project>`.
No real credential is in history, so the conclusion stands, and I confirmed the other half of the claim independently: `git log --all --diff-filter=A --name-only` filtered for env/secret/key/pem/p12 paths matches `.env.example` and nothing else.
The defect is that the pattern used was never recorded, so the first pickaxe a reviewer actually types falsifies the sentence and the reviewer has no way to tell a narrower search from a missed one.
It is the same shape as R0-4, which the ledger fixed for `npm audit` by writing down the headline number, and did not generalise here.

**Why the builder missed it.**
The conclusion of a search was recorded without the query that produced it - the one thing that makes a negative result checkable.

### FR-6 | P2 | The final commit adds a present-tense claim about an artifact that does not exist

**Evidence.**
`PROD-READINESS.md:190`, added in `d6822c8`: "`REVIEW-0.md`, `REVIEW-1B.md` **and the final review** are each committed alone, as required."

```
$ git ls-files reviews/
reviews/BASELINE.md  reviews/REVIEW-0.md  reviews/REVIEW-1.md  reviews/REVIEW-1B.md
```

At `d6822c8` the final review is unwritten and uncommitted; whether it lands alone is not knowable from the tree, and the reviewer contract has the reviewer write it, not the builder.
`PROD-READINESS.md:77` states the rule this breaks in the builder's own words: "**A status cell here is a record, never a forecast.**"
The two claims about `REVIEW-0.md` and `REVIEW-1B.md` are true - I confirmed each is a single-file commit (`d59694f`, `7aa13b8`).

**Why the builder missed it.**
The "record, never a forecast" rule was scoped in practice to the status column, which is where the REJECT hit, rather than to the document.
A self-report written from the plan instead of from `git ls-files` is exactly the failure that produced REVIEW-1 F1, one generation on and one severity lower.

---

## What I verified and could not break

| Claim | Status | How confirmed |
| --- | --- | --- |
| Baseline reproduces, no regression | **CONFIRMED** | I re-ran all three from the repo root. `LINT_EXIT=0`; web `Test Files 79 passed (79)` / `Tests 1179 passed (1179)`, mobile `Test Suites: 34 passed` / `Tests: 215 passed`, `TEST_EXIT=0`; vite clean + `mobile typecheck` clean, `BUILD_EXIT=0`. `BASELINE.md:30-32` recorded 214 mobile tests; the +1 is exactly the new guard. No pre-existing failure is being masked. |
| The guard is falsifiable - **my own mutation, not REVIEW-1's** | **CONFIRMED** | I copied the shim to a scratch path outside the repo with `recoveryStrategy` stripped and re-ran the file with `--moduleNameMapper` pointing at it: `Tests: 1 failed, 5 passed, 6 total`, failing with `- "recoveryStrategy": "recover-on-error",` at `__tests__/storage-shim.test.ts:94`. That reproduces `PROD-READINESS.md:86` ("fails exactly one test and leaves the other five passing") exactly. The `jest.requireMock` wiring is proven by the same run: an auto-mocked copy would return `undefined`. |
| P0-1's six-step trace | **CONFIRMED, every step re-read** | (1) `MMKVFactory.nitro.d.ts:105` `recoveryStrategy?: RecoveryStrategy` / `@default undefined`, `:20` the two-value union. (2) `HybridMMKV.cpp:261-263` returns `std::nullopt` when unset, passed as `.recover` at `:33`. (3) `MMKVCore/Core/MMKV.h:89` `std::optional<MMKVRecoverStrategic> recover = std::nullopt; // if not set, use the old style callback`. (4) `MMKV.cpp:1725-1730` returns `OnErrorDiscard` with no handler. (5) `grep -rn "registerHandler\|MMKVHandler\|g_handler"` over the package's `cpp/` and `ios/` returns nothing (exit 1). (6) `MMKVPredef.h:156-159` `OnErrorDiscard = 0`. |
| The fix removes the defect rather than relocating it | **CONFIRMED** | `MMKV.cpp:116` `m_recoverStrategic = config.recover;`; `MMKV_IO.cpp:346` and `:361` both `strategic = m_recoverStrategic.has_value() ? m_recoverStrategic.value() : strategic;`, overriding the discarding callback on the CRC path and the file-length path alike. Consumed at both decision sites; nothing moved elsewhere. |
| The traced pod is the pod that ships (ASSUMPTION 3, re-anchored per R0-1) | **CONFIRMED, and tighter than the ledger claims** | `git ls-files mobile/ios | wc -l` -> `0`, `mobile/.gitignore:40` is `/ios`, so the strike was right. `NitroMmkv.podspec:27` `s.dependency 'MMKVCore', '2.4.0'` is exact; `mobile/package-lock.json` pins `react-native-mmkv` at `4.3.2`; and the local `ios/Podfile.lock:104` resolves `MMKVCore (2.4.0)` - so the version I read the trace from is the version the pin forces. |
| One MMKV instance, all nine keys | **CONFIRMED** | `grep -rn createMMKV` over `app components platform theme __tests__ __mocks__` -> one call site, `platform/localStorageShim.ts:45`. Nine `poker-range-trainer.<slice>.v1` constants in `src/storage/`; `restoreBackup` (`backup.ts:226-237`) writes eight, `workout.v1` excluded with the reason asserted at `backup.test.ts:69-73`. |
| The option reaches what ships | **CONFIRMED** | `strings mobile/dist/_expo/static/js/ios/entry-*.hbc | grep -c recover-on-error` -> `1`, on a 5,482,101-byte bundle (the ledger's "5.5MB"). The bundle's mtime (19:36) is the minute `598728c` was authored, and the literal cannot appear before the fix, so it was exported from post-fix source. |
| Typo protection on the new option | **CONFIRMED** | The mock types `recoveryStrategy?: string` loosely, but `localStorageShim.ts:1` imports `createMMKV` from the real package and `mobile/tsconfig.json` includes `**/*.ts`, so `tsc --noEmit` checks the literal against the real union. `BUILD_EXIT=0` covers it. |
| All P1-1 anchors | **CONFIRMED, all exact** | `LAUNCH-CHECKLIST.md:54-56` is the rewritten Pass 3 item; `:184-195` spans the instruction line through the org-slug sentence (G3's correction is right); `.env.example:12-21` is the added block and the file is 21 lines; `mobile/app.json:84` is the bare `"@sentry/react-native"`; `mobile/ios/sentry.properties:2-3` carries both fallback comments verbatim; `--value poker-range-trainer` matches `LAUNCH-CHECKLIST.md:132`. Pre-fix anchors re-read at `4551454` and honest. |
| P2-11 dependency claims | **CONFIRMED character for character** | `npm ls image-size --omit=dev --all` -> `expo@56.0.19 > @expo/metro@56.0.0 > metro@0.84.4 > image-size@1.2.1`; `npm ls uuid` -> `expo-sharing@56.0.24 > @expo/config-plugins@56.0.14 > xcode@3.0.1 > uuid@7.0.3`. `npm audit --omit=dev` in `mobile/` -> `55 vulnerabilities (7 moderate, 48 high)`; at the web root -> `found 0 vulnerabilities`. From the audit JSON, exactly two entries carry a direct advisory, with the ledger's exact GHSA ids: `image-size` GHSA-w3rx-r6r6-pgpr + GHSA-5p2g-fcmc-qvqq (high), `uuid` GHSA-w5hq-g745-h8pq (moderate). |
| Every other evidence anchor in the ledger | **CONFIRMED** | I re-read each one rather than trusting the earlier passes: `README.md:11-13` and `:16-17`; `mobile/app.json:5` (and the generated Info.plist does register two schemes); `mobile/app/_layout.tsx:3-4`; `backup.ts:120`, `:136`, `:244-250`; `statsReset.ts:44-46`; `sessionHistoryStorage.ts:105-116`; `app-config.test.ts:38-39` (and `bundleIdentifier` is asserted nowhere - `grep` over `__tests__` exits 1); `service-worker.js:1`, `:8`, `:12`, `:33`, `:51`; `main.tsx:10`, `:19`, `:21-23`; `storageHelpers.ts:41-46`, `:52`, `:58`; `routes.ts:29`; `practice.tsx:53`, `:75-80`, `:108`; `range/[id].tsx:71`; `cards.ts:42`; `rangeNotation.ts:149`; `crashReporting.ts:21`, `:56-59`, `:73`; both `ErrorBoundary` `componentDidCatch` bodies; the four orphaned `supabase/migrations/*.sql`; `MMKV_IO.cpp:347-350` and `:361-366` for N-2; `BackupPanel.tsx:61` and `AccountScreen.tsx:78` for N-1. |
| Baseline provenance disclosure (R0-5) | **CONFIRMED** | `21f568b` is `2026-08-10 19:01:27`, five minutes before the capture, three files (`mobile/app.json`, `mobile/package.json`, `mobile/tsconfig.json`), and `git log origin/main..main` returns it. `BASELINE.md`'s added paragraph is +12 lines with no deletions, so "the raw output below is unchanged" holds. The `include` diff is as described: `"expo-env.d.ts"` dropped, `**/*.ts` surviving. |
| The R0-5 strike on `expo-env.d.ts` | **CONFIRMED as substantively right** | `mobile/expo-env.d.ts` is absent, as the ledger's own caveat at `:97-105` says, so the quoted command still does not reproduce - which the ledger now states outright. The general claim (a `**/*.ts` glob pulls `.d.ts` into the program) is standard TypeScript behavior and does not need this repo to check. |

## The final-review specifics

**Defects introduced across pass boundaries.**
Three, all P2 and all in the final commit: FR-3, FR-4, FR-6.
Each is the residue of a Stage 1B finding that was fixed as an instance rather than as a class, which is the pattern REVIEW-1B named at its head.
No cross-boundary defect exists in the code: the shim, mock and test have not changed since `598728c`, and I re-verified them from scratch rather than inheriting REVIEW-1's result.

**Stage 0 assumptions contradicted by later evidence.**
ASSUMPTION 3 was contradicted (by R0-1) and is now struck in place with a stronger, tracked anchor - I confirmed both the strike and the replacement.
ASSUMPTION 1 (the web app is not deployed), which the ledger itself calls the most load-bearing, survives re-testing: `README.md:11-13` says it, there is no `vercel.json` / `netlify.toml` / `firebase.json` / `CNAME` at either root, and `.github/workflows/ci.yml` has install/lint/test/build steps and no deploy job.
ASSUMPTION 2 survives (one call site).
ASSUMPTION 4 is the one that was not honoured, once - see FR-4.

**Work that expanded past the frozen work list.**
None.
The complete diff is 10 files: three code-adjacent files (`localStorageShim.ts`, its mock, its test) closing P0-1 plus the call-site assertion R0-8 asked for and `PROD-READINESS.md:81` authorises in P0-1's own fix cell; two documentation files closing P1-1; five ledger/review files.
`R0-8` is a Review 0 finding, so folding it into P0-1's fix predates the freeze rather than breaching it, and `CLAUDE.md` requires a test when behavior changes.
Everything found after Review 0 went where the rules say: R0-7 to NEXT ROUND as N-1, REVIEW-1 F7 to NEXT ROUND as N-2, R0-6/D-1 held in DEFERRED even after its justification was withdrawn - the one place the run had a live excuse to expand and did not take it.

**Prohibited actions anywhere in the history.**
One, `rm -rf mobile/dist`, disclosed by the builder at `PROD-READINESS.md:182-186` and re-rated P2 by REVIEW-1B on nil impact.
I confirmed the checkable perimeter across the whole range, not just one stage: `git diff --diff-filter=D --name-only 21f568b..d6822c8` is empty (no tracked file deleted anywhere in the sweep); `origin/main` is still `f888078` and the work branch has no upstream, so nothing was pushed; the tag `pre-trim-full-featureset` is intact; the reflog is linear - eight plain commits and one checkout, no rebase, amend or reset; no CI, deploy, infra, dependency or lockfile appears in any commit's stat.
I also checked something the trail did not, and it corroborates the builder's account: `mobile/ios/` and `mobile/ios/Pods/` have mtimes of `2026-08-07`, three days before the run's first commit at `19:01`, so the pod tree P0-1's trace reads was not fetched during this run and no non-local resource was contacted to produce it.
The `mobile/expo-env.d.ts` the ledger says it generated and deleted is indeed absent, and it was a file the builder created.
The caveat REVIEW-1B stated and the ledger repeats at `:186` remains the right one and I repeat it again: untracked filesystem operations leave no trail, so this perimeter is complete only for tracked state.

**Drift toward scope expansion over time.**
None; if anything the opposite.
Commit sizes fall monotonically after the fix (`598728c` 61 lines of code, `32d579f` 261 lines all documentation, `7aa13b8` a review file alone, `d6822c8` 11 lines), the last three commits touch no code at all, and the final commit touches one file.
The one pressure point - D-1, where the ledger explicitly withdraws its own "this would be a new feature" justification - is resolved by holding the item deferred and naming it as the next run's first task, which is the disciplined answer.
The contract deviations the builder self-reports at `:188-192` (REVIEW-1 bundled into its own remediation commit, the review gap at `4551454`, the baseline sitting on `main`) all match what I found independently.
`4551454`, the commit no per-stage review covered, is inside my range: I read its surviving content as part of verifying the current ledger and found no defect in it beyond the ones REVIEW-1 already caught and the builder already fixed.

## Checks that produced nothing

- **Fabricated or unreproducible findings** - none. Every work-list, P2, DEFERRED and NEXT ROUND item resolves to code or output saying what is claimed. The two evidence blocks that do not reproduce (the `expo-env.d.ts` command, the DSN pickaxe) are labelled as such by the ledger in the first case and are FR-5 in the second; both conclusions survive.
- **Severity inflation** - none. P0-1 is rated on consequence with the likelihood argument stated openly at `:118`, and N-2 caps the claim so RESOLVED cannot be read as "corruption handled end to end". I looked specifically for the argument that `recover-on-error` could be worse than discard (a partial library the user does not notice, then backed up over a good export); N-2 states the silence honestly and recovery is still strictly more data than discard.
- **Severity deflation** - two candidates, FR-1 and FR-4, both rated and reasoned above. Neither can be resolved from local evidence, and I have rated the ledger's handling rather than re-rating the underlying items.
- **Features smuggled in** - none. `recoveryStrategy` is an option on an existing call to an existing dependency; `__lastConfiguration` is a test-only export on an existing manual mock, which is what R0-8 asked for; `SENTRY_ORG` / `SENTRY_PROJECT` are pre-existing requirements of the Sentry upload (`sentry.properties:2-3` already falls back to them) now documented, and no app code reads either. No new screen, route, endpoint, flag, table, or runtime config key anywhere in the diff.
- **Fixes that relocated a bug** - none. The override is consumed at `MMKV_IO.cpp:346` and `:361`, the two sites that decide.
- **Error handling that hides errors** - none introduced. The only code change adds one option to one call: no `catch` added, no control flow altered, nothing swallowed. The five bare `catch {}` blocks classified as NOT DEFECTS were re-read and each degrades to a defined value with the reason documented at `storageHelpers.ts:41-46`.
- **Verification that does not exercise the changed path** - the opposite. The guard asserts the exact argument object the changed line passes, my mutation proves it fails when that argument changes, and the bundle check confirms the literal reaches the shipped Hermes file. Real native recovery remains CANNOT ASSESS, which the ledger says at `:197`.
- **Anything marked resolved without an artifact** - none. `598728c` for P0-1 (verified by `git show --stat`), `32d579f` for P1-1 (verified: the file contents exist at the cited lines), `4551454` for R0-1 and R0-5 (verified: the strike and the provenance paragraph are both in that commit).
- **Commit hygiene** - all eight messages are single sentences, no AI attribution trailer, no ticket ids.
