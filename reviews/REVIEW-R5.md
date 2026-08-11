# REVIEW-R5 - adversarial review of round 5

Range reviewed: `f4addad..2d09b26`, which is round 5 in full - `cdb061f` (`reviews/REVIEW-R4.md`, committed alone), `5b272e3` (the two runner comments plus four ledger corrections), `779061f` (the round 5 ledger section), `6186581` (R3-5, the restore-damage reporter) and `2d09b26` (the R3-5 ledger record and the checklist baseline refresh).
Target: the repo at `2d09b26`, plus `PROD-READINESS.md` as it stands there.
All anchors below read against `2d09b26` unless dated otherwise.

Round 5 exists because round 4 reviewed round 3 and was not itself reviewed.
This review exists for the same reason one round on, and it carries more weight than its predecessors: `6186581` is the only commit in this whole run that changes what the shipping binary DOES, and it was taken on the user's decision rather than because a reviewer proved it safe.

Nothing below is taken from the round 5 ledger on trust.
The five falsifiability mutants were re-run one at a time against BOTH full suites rather than against a single file; the spy census REVIEW-R4 corrected was re-derived a third time by opening every site; both runner comments were read against the runners' installed sources; the module-holder isolation the new seam depends on was measured with a probe that was itself proved able to detect a leak; and the iOS bundle was exported four times to settle what the new import edge costs and whether the new reporter reaches the shipped bytecode at all.

## Verdict: PASS-WITH-FINDINGS

`6186581` is correct.
Every mutant I ran fails exactly the one test round 5 names and nothing else, across both suites rather than within one file; the new code reaches the shipped Hermes bytecode when a DSN is configured and is absent from it when one is not, which is the design; the import edge costs the bundle 52 bytes and pulls in no module that was not already there; and the module-level holder cannot leak between test files, which I measured rather than assumed.

Six findings, all P2.
Five are against the record, one is against a code comment.
The one that matters is R5-1: `6186581` wrote into shipping code, as settled fact, a premise that `5b272e3` - the commit immediately before it, in the same round - had just finished recording as NOT settled.
The behaviour it describes is right and should not change; the sentence justifying it is stronger than the evidence, and the ledger paragraph that same round wrote says so.

---

## Findings

### R5-1 | P2 | The `replaced` counter is documented as counting what was replaced; on the shipping platform it is a lower bound, and the same round said so one commit earlier

**Evidence.**
`src/storage/backup.ts:327-331`, added by `6186581`:

```
  // How many slices the forward loop actually replaced, which is what decides
  // whether a refused rewind did any damage: a slice the forward write never
  // reached is handed back the value it still holds, so a refusal there leaves it
  // correct. Counted after the write, so a `setItem` that throws is not credited
  // with a replacement it did not make.
```

The last sentence asserts that a `setItem` which throws made no replacement.
`PROD-READINESS.md:211`, landed by `5b272e3` one commit earlier in the same round as R4-E's fix, says the opposite is not settled:

```
It holds on both surfaces, with one step outside the tracked tree: `mmkv.set`
throws only when MMKV core reported the write did not land
(`HybridMMKV.cpp:130-132`), and a web `QuotaExceededError` leaves the item
unstored, but on iOS `setItem` is two operations
(`mobile/platform/localStorageShim.ts:75-79`) and the second reaches
`mmkv.getAllKeys()` -> `instance->allKeys()`, which is MMKVCore under the
gitignored `mobile/ios/Pods/` (ASSUMPTION 3).
```

I re-walked the shim rather than taking that on trust, and it is exact.
`localStorageShim.ts:75-79` is `mmkv.set(key, value)` at `:77` and then `noteKeys(mmkv)` at `:78`.
`noteKeys` (`:64-66`) calls `mmkv.getAllKeys()`, which is `HybridMMKV::getAllKeys` (`mobile/node_modules/react-native-mmkv/cpp/HybridMMKV.cpp:191-192`) returning `instance->allKeys()` - MMKVCore, untracked.
The sidecar write below it is NOT the exposure: `writeKeyList` (`mobile/platform/storeIntegrity.ts:89-98`) swallows its own throw by design.
So `getAllKeys` is the one step in `setItem` that runs AFTER the value has landed and is not known to be non-throwing, which is precisely the step R4-E named.

Two other sentences repeat the same premise and need the same treatment:

- `src/storage/backup.ts:305-307`: "The slices left holding new data are handed to whatever {@link setRestoreDamageReporter} was given" - a claim about ALL of them.
- `PROD-READINESS.md:358`: "counts how many slices the forward loop actually replaced and reports only refusals below that count, which is exactly the residual set R3-3 derived".

`restoreBackup`'s own contract paragraph (`src/storage/backup.ts:296-303`) is fine and needs no change: it partitions by state - "Only a slice the forward write had already replaced can end up that way" - which is what R4-E already corrected it to.

**What the gap actually is, bounded.**
It is at most ONE slice: the forward loop breaks at the first throw, so only that slice's replacement can go uncounted.
And an uncounted slice is only under-REPORTED when two different failure modes land on it in the same restore:

1. its forward `setItem` threw in `getAllKeys` AFTER `mmkv.set` landed the new value - so `replaced` is one short, and
2. its rewind then refused with the old value NOT landing - i.e. in `mmkv.set` itself, not in `getAllKeys` again.

If the rewind refuses the same way the forward write did (post-landing), the old value is back and the slice is correct, so reporting nothing about it is right.
On web the premise is not in doubt at all: `QuotaExceededError` leaves the item unstored.

**Under-reporting is the right direction, and that is the thing worth writing down.**
The alternative is what mutant 2 produces: drop the `index < replaced` guard and every refused rewind is reported, including slices the forward write never touched.
On a full device - the case that reaches this code at all - that names up to eight keys when nothing is damaged, and a report that fires when the library is intact destroys the only thing this report exists to say.
Losing one key from an already-firing report is a far smaller loss than a report nobody can believe.

**Why this is a finding and not pedantry.**
The comment is in `@core`, on the data path, in the run's only behaviour change, and it is the sentence a future reader will use to decide whether `replaced` can be trusted as "what was replaced".
It also repeats, in new code, a claim the same round had just corrected in the ledger - the exact shape of "a correction is not landed until every place repeating the old claim is found", running forwards instead of backwards.

**Fix.** Narrow the three sentences to say that `replaced` is a lower bound on the shipping platform, name `getAllKeys` as the one post-write step that can be wrong about it, bound the gap to one slice and the double-failure it needs, and state that under-reporting is the deliberate direction with the reason. No code change: the behaviour is already the right one.

### R5-2 | P2 | Round 5's anchor sweep missed a live anchor that its own edit moved, and claims it moved every one

**Evidence.**
`PROD-READINESS.md:383`:

```
R3-5's fix then inserted 46 lines above `restoreBackup`, which moved every live
`src/storage/backup.ts` anchor in this file: the rollback loop from `:296-306`
to `:350-366`, the rethrow from `:307` to `:368`, the `removeItem` branch from
`:298` to `:352`, the contract paragraph from `:250-262` to `:291-303`, and
R4-E's citation from `:257-258` to `:298-299`. All five were re-grepped and
re-based
```

All five resolve at HEAD; I opened each one.
There is a sixth, in the NEXT ROUND entry the same round was closing.
`PROD-READINESS.md:486`:

```
`src/storage/backup.ts:300-305` catches and discards a rewind that refuses, and
not raising is correct
```

At `f4addad` that was exact - `git show f4addad:src/storage/backup.ts` puts the inner `catch` at `:300` and its close at `:305`.
At HEAD `:300-305` is doc-comment prose about the rewind contract, and the inner `catch` is at `:354-365`.

**Why it is not covered by "the original finding follows as written".**
That convention is real and this file uses it three times, but the other two say so about their anchors.
P2-4's equivalent at `:413` reads "Its `backup.ts` anchors are left as round 2 wrote them and read against `d13fd15^`, the last commit before the fix; at HEAD the rollback loop is `:350-366` and the rethrow `:368`".
R3-5's preserved paragraph carries no such sentence, so `:486` reads as a live anchor into HEAD and resolves to the wrong thing.

**Fix.** Date it the way `:413` dates round 2's, and correct `:383` - which is a claim about completeness, not a list.

### R5-3 | P2 | The five mutants were run at file scope for a change that is half `@core`, and the file is not the bound the claim needs

**Evidence.**
`PROD-READINESS.md:361`: "**Falsifiability, proved one mutant at a time. Each fails exactly one named test, with the rest of its file passing.**"
The cells then read "39 passing" (`src/storage/backup.test.ts`) and "12 passing" (`mobile/__tests__/crash-reporting.test.ts`).

The scope IS stated, so this is not a misreported number.
It is the wrong bound for three of the five: `src/storage/backup.ts` is `@core`, compiled into the web app AND bundled into the iOS binary, so "the rest of its file" says nothing about the other 78 web files or any of the 37 mobile suites.
The two mobile rows have the same shape one suite up: 12 of 241.

**Re-run at full-suite scope, both suites, one mutant at a time, each restored from a copy before the next.**
Baseline at `2d09b26`: web 79 files / 1187 tests, mobile 37 suites / 241 tests, all passing.

| behaviour removed | web (79 / 1187) | mobile (37 / 241) |
| --- | --- | --- |
| the `reportRestoreDamage(damaged)` call in the rollback handler | 1 failed / 1186 passed - `reports the slices a refused rollback left holding new data` | all 241 pass |
| the `index < replaced` guard, so every refusal is reported | 1 failed / 1186 passed - `reports nothing when the refused rollback is of a slice the failed write never reached` | all 241 pass |
| the `try`/`catch` around the reporter call | 1 failed / 1186 passed - `still raises the restore error when the damage reporter itself throws` | all 241 pass |
| `setRestoreDamageReporter(reportRestoreDamage)` in `initCrashReporting` | all 1187 pass | 1 failed / 240 passed - `with the DSN unset › wires the restore-damage reporter even with reporting disabled` |
| the `captureMessage` inside `reportRestoreDamage` | all 1187 pass | 1 failed / 240 passed - `with the DSN set › reports slices a restore could not roll back, carrying only the key names` |

The record's conclusion holds exactly, at the wider scope, for all five.
So this is a finding about what the evidence bounded, not about what it concluded.

**One thing the wider scope shows that the file scope could not.**
The three `backup.ts` mutants leave the mobile suite completely green.
Nothing on the mobile side exercises the `@core` behaviour at all - `mobile/__tests__/backup-screen.test.tsx:47` drives its whole suite off `restoreBackup as jest.Mock` - so the mobile guards cover the WIRING and nothing below it.
That is a reasonable division and it is worth stating, because "guarded on both surfaces" currently reads as more than it is.

**Fix.** Restate the table at the scope actually measured, and say that the mobile side guards the wiring only.

### R5-4 | P2 | "The web app is deliberately left unwired" rests on a branch no test can fail, and the thing that really holds it up is the build

**Evidence.**
`PROD-READINESS.md:354`: "The web app is deliberately left unwired: it has no crash seam at all, the reporter stays `null`, and `reportRestoreDamage` returns before touching it."
Nothing tests any part of that, and the middle clause cannot be tested.

`src/storage/backup.ts:277-284`:

```
function reportRestoreDamage(keys: string[]): void {
  if (keys.length === 0 || reportDamage === null) return
  try {
    reportDamage(keys)
  } catch {
```

The `reportDamage === null` check is redundant with the `try`/`catch` two lines below it: remove the check and a null holder throws a `TypeError` that the same `catch` swallows, so the observable behaviour is identical and no mutant of that branch can fail a test.
A guard for it is not writable, and any attempt to add one would be the "silently weakened test" this run has warned about since REVIEW-1B.

**What does hold it up is the gate, not an assertion, and I ran it rather than reasoning about it.**
The load-bearing half of the sentence is that `@core` cannot import the mobile crash seam.
Adding `import { reportRestoreDamage } from '../../mobile/platform/crashReporting'` to `src/storage/backup.ts` and running the gate:

```
$ npm run build
mobile/platform/crashReporting.ts(19,42): error TS2307: Cannot find module
  '@core/storage/backup' or its corresponding type declarations.
mobile/platform/crashReporting.ts(25,15): error TS2591: Cannot find name 'process'.
npm run build exit=2
```

`tsc -b` pulls the imported mobile file into the web program, where neither the `@core/*` path mapping nor Node's globals exist, and the build stops before `vite build` runs.
The web root's `package.json` also declares no `react-native`, `expo`, `@sentry/*` or `mmkv` dependency of any kind, so the bundler would have failed too had the compiler not.
`src/storage/backup.ts` was restored from a copy afterwards; the tree is clean.

**Fix.** Say what enforces what: the build enforces the import direction, the null branch is unfalsifiable by construction and should not be presented as a tested path, and the absence of a web wiring is a one-line grep rather than a guard.

### R5-5 | P2 | The new import edge was argued from ordering and never measured; measured, it is smaller than the argument suggested and it settles something better

**Evidence.**
`6186581` puts `import { setRestoreDamageReporter } from '@core/storage/backup'` at `mobile/platform/crashReporting.ts:19`, and `mobile/app/_layout.tsx:24-28` imports that module and calls `initCrashReporting()` at module scope (`:33`), so `@core/storage/backup` and everything it imports is now on the startup path.
`npm run bundle-check --prefix mobile` was not re-run in round 5, and the ledger says nothing about the bundle.

**Bounded statically first.**
The set the edge newly reaches is `backup.ts` plus the nine storage modules it imports and the six `src/domain` modules under those.
None has a top-level statement other than declarations, and none touches `localStorage` at import time, so the shim-first ordering at `_layout.tsx:3-4` is not even load-bearing here.
The only eager work in the whole set is two 169-entry matrix builds, `src/domain/pokerHands.ts:26` and `src/domain/mixedStrategy.ts:26`.
`crashReporting.ts` already imported `@sentry/react-native` at module scope before this change, so the startup path already carried the SDK.

**Measured, four `expo export --platform ios` runs.**

| export | conditions | bundle |
| --- | --- | --- |
| `dist` | HEAD, no DSN, warm cache | 5,493,420 bytes |
| `dist-dsn2` | HEAD, DSN set, `--clear` | 5,494,552 bytes |
| `dist-noedge` | the import line and its wiring call removed, DSN set, `--clear` | 5,494,500 bytes |

**The edge costs 52 bytes**, comparing the last two - one variable, same conditions - and it pulls in no module that was not already there.
`mobile/components/BackupPanel.tsx:18` already imports `@core/storage/backup`, so that module and everything under it shipped in the bundle before `6186581` existed; the `dist-noedge` bundle still contains `poker-range-trainer.saved-ranges.v1` and the rest.
What the edge changes is WHEN those modules are evaluated - at `initCrashReporting` rather than when a screen first needs them - not whether they ship, and the static bound above is what that evaluation costs.

**The measurement settles something the ledger never claimed and should.**
`strings` on the DSN-set, cache-cleared bundle finds `Backup restore left slices unrolled-back: ` and `Storage keys missing after open: `; `strings` on the no-DSN bundle finds NEITHER, while both contain `attachScreenshot` from the same file.
So the new reporter reaches the shipped Hermes bytecode in the configuration a production build uses, and in a build with no DSN its body is not in the binary at all - the "inert unless the DSN is set" design verified at the bytecode level, which is the same class of evidence P0-1 used for `recover-on-error`.

**A trap for whoever measures this next.** The first DSN-set export I ran without `--clear` produced a bundle of identical size and identical content hash to the no-DSN one, with the DSN absent: Metro reused its transform cache across the env change, so `EXPO_PUBLIC_SENTRY_DSN` was never re-inlined. An `EXPO_PUBLIC_*` experiment without `--clear` measures the previous run.

**Fix.** Record the measurement and the bytecode check in the round 5 section, and record the cache trap next to it.

### R5-6 | P2 | A second live `backup.ts` anchor in the ledger resolves to the wrong line, and has since round 2

**Evidence.**
`PROD-READINESS.md:66`: "Imported backup JSON, validated by `validateBackup` (`src/storage/backup.ts:136`)".
`validateBackup` is at `:169` at HEAD.
It was at `:136` at the baseline `21f568b` and still at `:136` at `daf054d^`; round 2's `daf054d` (N-1's fix) inserted `MAX_BACKUP_BYTES` and `assertBackupFileSize` above it and moved it, and nothing re-based it.

**Why it belongs in a review of round 5.**
It is not round 5's defect and I am not filing it as one.
It is round 5's SWEEP that claims to have covered it: `:383` says the fix "moved every live `src/storage/backup.ts` anchor in this file", and a re-grep of anchors into the file you just edited is exactly what would have surfaced this one.
Two rounds of reviews checked the anchors each round wrote and none re-checked the context section above them.

**Fix.** Re-base to `:169`. It is a live context line with no dated history, so it should be corrected rather than dated.

---

## Re-derived, not taken on trust

**The spy census is right, opened a third time, and it moved.**
REVIEW-R4 R4-A corrected round 4's `git grep` census to 6 web sites and 5 mobile at `f4addad`, having opened every `mockRestore()` hit.
I opened all 41 `mockRestore`/`restoreAllMocks` hits in `src` and `mobile` again at HEAD, without reading R4-A's list first, and classified each by whether a failing assertion can skip the restore.

The shape - inline restore below at least one assertion, no `finally`:

- web: `src/storage/backup.test.ts:392`, `src/storage/rangeStorage.test.ts:150`, `:170`, `:212`, `src/app/useBackToClose.test.ts:90`, `:104`
- mobile: `editor-screen.test.tsx:54`, `live-save-error.test.tsx:45`, `:58`, `range-screen.test.tsx:125`, `today-screen.test.tsx:239`

Six and five, the same sites R4-A names, with one re-based: `6186581` inserted three tests above `backup.test.ts:385`, which is now `:392`.
`PROD-READINESS.md:259` still cites `:385` and explicitly reads at `f4addad`, so it is dated rather than wrong.

Not the shape, checked one at a time rather than assumed: restore inside a `finally` at `src/storage/storageHelpers.test.ts:83`, `:112`, `:135`, `src/practice/PracticeHost.test.tsx:174`, `:229`, `src/screens/LibraryScreen.test.tsx:476`, `src/screens/RangeScreen.test.tsx:90`, `:112`, `src/screens/TodayScreen.test.tsx:213`, `mobile/__tests__/library-screen.test.tsx:391`, `mobile/__tests__/practice-screen.test.tsx:247`; restore before any assertion at `src/screens/RangeEditTab.test.tsx:171`, `:187`; an `afterEach` at `mobile/__tests__/error-boundary.test.tsx:26`; and `jest.restoreAllMocks()`/`vi.restoreAllMocks()` hooks in six more files.
R4-A's own "listed but already protected" table names five of these because it was answering round 4's fourteen-hit list, not enumerating every `finally` in the repo - which is what it says it is doing, so it is not wrong.
`6186581` added three restores and put all three inside a `finally`, so the round did not widen the class it inherited.

**Both runner comments are true against the runners' sources, which I read rather than the review that prompted them.**

`vitest.config.ts:15-28` claims restoring runs before each test's `beforeEach` because `@vitest/runner` calls `onBeforeTryTask` and then the `beforeEach` hooks.
`node_modules/@vitest/runner/dist/chunk-artifact.js:2942` is `await runner.onBeforeTryTask?.(test, {...})` and `:2947` is the `beforeEach` dispatch, five lines below it in the same `try`.
`onBeforeTryTask` is `node_modules/vitest/dist/chunks/test.DNmyFkvJ.js:4349-4350`, whose first statement is `clearModuleMocks(this.config)`, which is `:4421-4423` -> `if (restoreMocks) vi.restoreAllMocks()`.

It claims a `beforeAll` spy does not survive, "the restore runs before every test including the first, and clears its registrations as it goes".
`@vitest/spy/dist/index.js:467-471` is `for (const restore of MOCK_RESTORE) restore(); MOCK_RESTORE.clear()`, and `onBeforeTryTask` is per test, so the first test's restore runs after the suite's `beforeAll`.

It claims only `vi.spyOn` registers a restore.
`MOCK_RESTORE.add` has exactly one call site, `createMockInstance` at `:10-14`, gated on a `restore` option that only `spyOn` passes (`:247-251`); `fn()` at `:179-189` passes none.

`mobile/jest.config.js:21-33` claims jest-circus registers the restore as a top-level `beforeEach` ahead of the test file.
`mobile/node_modules/jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:44` opens `globals.beforeEach(() => {`, `:61-63` is the `config.restoreMocks` branch inside it, and the `setupFilesAfterEnv` loop is at `:65`, after it.

It claims `spyOn` registers nothing when the property is ALREADY a mock, naming `AccessibilityInfo`.
`mobile/node_modules/jest-mock/build/index.js:737` is `if (!this.isMockFunction(original)) {` wrapping the whole install block and `:797` returns `object[methodKey]`; `restoreAllMocks` at `:958-961` iterates `_spyState` only.
`@react-native/jest-preset/jest/mocks/AccessibilityInfo.js` does replace the module with `jest.fn()`s, so `mobile/__tests__/practice-screen.test.tsx:61` is re-configuring a preset mock, exactly as R4-B says.
`@vitest/spy/dist/index.js:223-225` has the identical early return, so the caveat holds in Vitest too - the vitest comment omits it, which is an omission and not an error, and there is no web site it would apply to.

**The module-level holder cannot leak between test files, measured with a probe that was proved able to detect a leak.**
`setRestoreDamageReporter` has no unset path and `reportDamage` is module state in `@core`, which `src/storage/backup.test.ts:63-69` works around with a fresh spy per test.
No OTHER web test file calls it: `src/storage/backup.test.ts` is the only file that imports it, and the only other web caller of `restoreBackup` at all is `src/screens/AccountScreen.test.tsx` through the component, which never installs a reporter.
That leaves the question of whether Vitest's per-file isolation actually makes the missing unset path moot.

Two temporary probe files under `src/test/`, using `rangeRemoval`'s `pendingUndo` (`src/storage/rangeRemoval.ts:127`) - the same shape as `reportDamage`, module state in `@core` with no reset - each asserting the holder is empty BEFORE filling it, so whichever runs second fails if the registry is shared:

```
default config (isolate on, as shipped):        Test Files 2 passed (2), Tests 2 passed (2)
--no-isolate --no-file-parallelism:             Test Files 1 failed | 1 passed, failing at
                                                expect(peekDeletedRanges()).toBeNull()
```

So each test file gets its own module registry under the shipped config, the probe would have caught it if it did not, and the missing unset path is not a defect in either app: `initCrashReporting` sets it once at startup and nothing ever needs to withdraw it, which is also true of `setStorageLossReporter` (`mobile/platform/storeIntegrity.ts:45`), the precedent it is modelled on.
Both probe files were deleted; neither is in the tree.

**The R3-5 test that asserts only a throw is not vacuous.**
`still raises the restore error when the damage reporter itself throws` ends on `expect(() => restoreBackup(replacement)).toThrow(/QuotaExceededError/)` and never asserts the reporter ran, so it would pass just as well if the reporter were never called.
Mutant 3 settles it: removing the `try`/`catch` fails that test and only that test, which is only possible if the throwing reporter is reached.

**The `LAUNCH-CHECKLIST.md` status baseline reproduces.**
`:21-29` claims web 79 files / 1187 tests and mobile 37 suites / 241 at `6186581`.
Re-run at `2d09b26`, which is docs-only on top of it: `npx vitest run` gives 79 / 1187, `npm run test:run --prefix mobile -- --runInBand` gives 37 / 241.

**No new data class reaches Sentry.**
`mobile/platform/crashReporting.ts:135-141` is `reportStorageLoss` (`:115-121`) with a different message, key names in `extra` and the same `isCrashReportingEnabled()` gate.
`docs/privacy-policy.md:33-42` describes crash and performance diagnostics with "Your ranges, notes and practice data are **never** included", and `mobile/app.json:15-22` declares `NSPrivacyCollectedDataTypeCrashData` only.
The keys are the storage-key constants, so the policy, the privacy manifest and the App Privacy answers all stay true and none needs updating - which the module doc at `crashReporting.ts:12-14` says is the test to apply.

**No storage key was added, renamed or reshaped.**
`git diff f4addad..2d09b26 -- src/storage/ mobile/platform/` touches `backup.ts` and `crashReporting.ts` only, and neither adds a key or changes a stored shape; the reporter takes key names as an argument and persists nothing.
`mobile/platform/storeIntegrity.ts`'s second MMKV instance is untouched and still outside the nine, the backup and the three key guards.

**`review/targets.md:136` and `:144` are still stale and still correctly left alone.**
They cite `src/storage/backup.ts:223-250` as the eight-slice restore code; at `227e3e1`, before round 4 touched the file, those lines were already `validateBackup`'s tail, so the staleness predates this run and belongs to an earlier review pass's point-in-time record.
`6186581` moved the real code another 46 lines further away, which changes nothing about who owns the anchor.

## What I looked for and did not find

- **No status stamped for absent work.** Every RESOLVED in the round 5 table names a commit whose tree contains the work: R4-A..R4-E in `5b272e3`, R3-5 in `6186581`. The section itself landed in `779061f` and `2d09b26`, after the commits it names, never with them.
- **No silently weakened test.** The three new web tests each assert a distinct behaviour and each dies to a distinct mutant; the two new mobile tests do the same. `6186581` weakens no existing assertion - `git show 6186581 -- src/storage/backup.test.ts mobile/__tests__/crash-reporting.test.ts` is additions plus one import line.
- **No scope drift.** `6186581` is two source files and their two test files. `5b272e3` changes no executable line. `cdb061f`, `779061f` and `2d09b26` are documentation.
- **No prohibited action.** Five ordinary commits, the review committed alone as the contract requires. No EAS build was started; the four `expo export` runs above are local and are the command the ledger already lists as available.
- **The reporter cannot become the error the caller sees.** `src/storage/backup.ts:279-283` catches everything the injected reporter throws, mutant 3 proves it, and `:367-368` calls it before `throw error` so the raised error is still the restore's.
- **No user content can reach Sentry through it.** `damaged` is built at `:364` from `key`, which comes from the `entries` array of storage-key constants at `:312-325`; nothing else is pushed.
- **The claim that a restore always happens long after `initCrashReporting` holds.** `restoreBackup`'s only callers are `mobile/components/BackupPanel.tsx` and `src/screens/AccountScreen.tsx`, both user-initiated from a mounted screen, and `initCrashReporting()` runs at module scope in `mobile/app/_layout.tsx:33`. So the reporter genuinely does not need `storeIntegrity`'s holding buffer, as `src/storage/backup.ts:262-265` claims.
- **The new import edge does not reach the shim.** `mobile/platform/localStorageShim.ts` imports `storeIntegrity` only, and `storeIntegrity` imports `react-native-mmkv` only, so nothing new was added ahead of the shim's first line. The rule at `storeIntegrity.ts:38-43` is intact.
