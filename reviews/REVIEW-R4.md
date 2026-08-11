# REVIEW-R4 - adversarial review of round 4

Range reviewed: `227e3e1..f4addad`, which is round 4 in full - `2dd1075` (`reviews/REVIEW-R3.md`, committed alone), `16d1336` (the `restoreBackup` doc-comment rewrite plus the R3-2/R3-3/R3-4 ledger corrections), `6fb393e` (`restoreMocks: true` in both runners) and `f4addad` (the round 4 ledger section).
Target: the repo at `f4addad`, plus `PROD-READINESS.md` as it stands there.
All anchors below read against `f4addad` unless dated otherwise.

Round 4 exists because rounds 2 and 3 shipped unreviewed.
This review exists for the same reason one round on: a round that reviews its predecessor is not itself reviewed by anything.

Nothing below is taken from the round 4 ledger on trust.
Both of its falsifiability demonstrations were re-run from scratch, its census of at-risk spies was re-derived by opening every site rather than grepping, and the ordering claim its config comments make was traced through the installed runner sources instead of through a probe that no longer exists.

## Verdict: PASS-WITH-FINDINGS

`6fb393e` is correct and safe, and it is now better evidenced than round 4 left it.
The restore genuinely runs before each test's `beforeEach` in both runners, which I confirmed from the runners' own source rather than from behaviour, and both of round 4's falsifiability demonstrations reproduce to the exact counts recorded.
The `16d1336` doc comment states a contract the code actually keeps; I walked both loops against it and it holds.

Five findings, all P2, all against the record rather than the code.
The two that matter are R4-B and R4-A, and they are the same mistake in two places: round 4 enumerated sites without opening them.
One of the two spies it names as put at risk by `restoreMocks` is not a spy at all and could never have been restored by either runner, and five of the fourteen inline-restore sites it names as vulnerable are already inside a `finally`.
Neither changes the fix. Both change what the ledger can be read as having proved.

---

## Findings

### R4-A | P2 | The R4-1 evidence list counts five `finally`-protected sites as vulnerable, and misses two that are not protected

**Evidence.**
`PROD-READINESS.md:251`:

```
The shape was still present at `src/storage/backup.test.ts:385`,
`src/storage/rangeStorage.test.ts:150,170,212`,
`src/storage/storageHelpers.test.ts:83,112,135`, and seven sites in
`mobile/__tests__` (the eighth, `error-boundary.test.tsx:26`, was already an
`afterEach`).
```

"The shape" is defined two lines above it as a spy whose inline restore sits below an assertion, so a failing assertion skips the restore.
Opened one at a time, the list is wrong in both directions.

Listed but already protected - the restore is inside a `finally`, exactly the fix round 3 applied to its own test:

| site | what is actually there |
| --- | --- |
| `src/storage/storageHelpers.test.ts:83` | `try { expect(readJson(KEY)).toBeUndefined() } finally { spy.mockRestore() }` (`:80-84`) |
| `src/storage/storageHelpers.test.ts:112` | `finally` block at `:111-113` |
| `src/storage/storageHelpers.test.ts:135` | `finally` block at `:134-136` |
| `mobile/__tests__/library-screen.test.tsx:391` | `finally` block at `:390-392` |
| `mobile/__tests__/practice-screen.test.tsx:247` | `finally` block at `:246-248` |

Has the shape and is absent from the list: `src/app/useBackToClose.test.ts:90` and `:104`, both a bare `back.mockRestore()` on the line after an `expect`.

A third group is neither: `src/screens/RangeEditTab.test.tsx:171` and `:187` restore BEFORE any assertion runs, so a failing assertion cannot skip them.

The corrected census at `f4addad` is 6 web sites and 5 mobile, not 7 and 7:

- web: `src/storage/backup.test.ts:385`, `src/storage/rangeStorage.test.ts:150`, `:170`, `:212`, `src/app/useBackToClose.test.ts:90`, `:104`
- mobile: `editor-screen.test.tsx:54`, `live-save-error.test.tsx:45`, `:58`, `range-screen.test.tsx:125`, `today-screen.test.tsx:239`

**Why this is a finding and not arithmetic.**
The distinction the list gets wrong is the exact distinction round 4's own row is about.
`PROD-READINESS.md:250` says round 3 "fixed its own test with a `finally` and left the class, which is the pattern REVIEW-1B named - fix the instance, keep the class".
A census that cannot tell the fixed instance from the unfixed ones is not evidence for that sentence; it is a `git grep mockRestore` reported as a reading.
The count is also what a later round would use to decide whether the inline sites still need individual attention now that the config change covers them.

**Fix.** Correct the list to the census above, and say which sites were already `finally`-protected rather than dropping them silently.

### R4-B | P2 | One of the two spies named as put at risk is not a spy, and neither runner could ever have restored it

**Evidence.**
`PROD-READINESS.md:254-255`:

```
The stated risk is a spy installed in `beforeEach` and relied on in the body: if
the automatic restore ran after the hook, that spy would be silently uninstalled.
Two such spies exist (`mobile/__tests__/practice-screen.test.tsx:61`,
`mobile/__tests__/error-boundary.test.tsx:22`).
```

`practice-screen.test.tsx:61` is `jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)`.
`AccessibilityInfo.isReduceMotionEnabled` is ALREADY a `jest.fn()` before that line runs: the React Native jest preset replaces the whole module with `@react-native/jest-preset/jest/mocks/AccessibilityInfo.js`, where it is `jest.fn(() => Promise.resolve(false))`.
The preset is loaded through `jest-expo`'s `setupFiles`, so this holds for every mobile suite.

`jest.spyOn` on a property that is already a mock function does not install anything:

```
mobile/node_modules/jest-mock/build/index.js:737    if (!this.isMockFunction(original)) {
                                          :797    return object[methodKey];
```

The entire install block - including the `_makeComponent` call that registers the restore callback - sits inside that `if`.
When the property is already a mock, `spyOn` returns it untouched and registers nothing, so `restoreAllMocks` (`:958-961`, which iterates `_spyState` only) has nothing to restore.
`.mockResolvedValue(true)` then mutates the preset's shared mock directly.

`@vitest/spy` has the identical early return, so this is a property of both runners, not a Jest quirk:

```
node_modules/@vitest/spy/dist/index.js   if (isMockFunction(originalImplementation)) {
                                           return originalImplementation;
                                         }
```

**Demonstrated in the real files, which is what round 4's synthetic probe could not do.**
I added a temporary assertion to the body of each test whose `beforeEach` installs the spy, then added a second `beforeEach` after the file's own that calls `jest.restoreAllMocks()` - a mutant that simulates the restore running after the hook, which is the hazard the config change is claimed to be safe against.

| file, probe added to a real test body | at `f4addad` | with the ordering mutant |
| --- | --- | --- |
| `error-boundary.test.tsx`, `expect(jest.isMockFunction(console.error)).toBe(true)` and `expect(consoleError).toHaveBeenCalled()` | passes | FAILS at `isMockFunction`, and React's caught-render-error logging reappears in the output |
| `practice-screen.test.tsx`, `expect(jest.isMockFunction(...isReduceMotionEnabled)).toBe(true)` and `resolves.toBe(true)` | passes | still passes - `isMock=true value=true` |

The second row is the finding.
The mutant restores every registered spy and the AccessibilityInfo one survives it, because there was never a registration; had it truly been restored, the preset's own mock resolves `false` and the probe would have failed on the value.
So the number of sites `restoreMocks` could have broken is one, not two - and that one is now proved in the file it lives in.

**Why it matters beyond the count.**
`PROD-READINESS.md:256-258` rests the safety of the run's highest-blast-radius change on "a throwaway probe in each runner" that spied on something in a synthetic file.
A synthetic probe spies on a real function, so it models `error-boundary.test.tsx:22` and cannot model `practice-screen.test.tsx:61` at all - the two sites it was standing in for are not the same kind of object.
The conclusion survives; the evidence for half of it was measuring something else.

**Fix.** Record that `practice-screen.test.tsx:61` re-configures a preset mock rather than installing a spy, with the `jest-mock` and `@vitest/spy` anchors, and record the real-file demonstration for the one site that is genuinely a spy.

### R4-C | P2 | Both config comments say "a spy a hook installs still reaches the body", which is false for `beforeAll`

**Evidence.**
`vitest.config.ts:21-23` and `mobile/jest.config.js:25-27` both say: "Restoring runs BEFORE each test's `beforeEach`, so a spy a hook installs still reaches the body (probed, not assumed)."

The first clause is true and I confirmed it from source in both runners.
The second generalizes it from `beforeEach` to "a hook", and `beforeAll` is a hook for which it does not hold.
Both runners restore before EVERY test, including the first, and both then discard the registrations:

- Jest: `jest-circus/build/legacy-code-todo-rewrite/jestAdapter.js:44` registers the restore as a top-level `globals.beforeEach`, and `:61-63` is the `config.restoreMocks` branch inside it. It is registered before `setupFilesAfterEnv` is loaded (`:65`) and before the test file, so it runs ahead of every `beforeEach` the file declares - and after the file's `beforeAll`, which Jest runs once at suite entry. `jest-mock/build/index.js:958-961` clears `_spyState` after restoring.
- Vitest: `@vitest/runner/dist/chunk-artifact.js:2942` calls `runner.onBeforeTryTask`, then `:2947` calls the `beforeEach` hooks. `onBeforeTryTask` is `vitest/dist/chunks/test.DNmyFkvJ.js:4349-4350`, which calls `clearModuleMocks` at `:4421-4423` -> `vi.restoreAllMocks()`. `@vitest/spy/dist/index.js:467-471` clears `MOCK_RESTORE` after restoring.

So a spy installed in `beforeAll` is uninstalled before the first test and never comes back.

**This is wording, not a live defect.**
I re-derived the census of before-hook `spyOn` sites across both suites and there is no `beforeAll`-installed spy anywhere: only the two `beforeEach` sites round 4 names.
The comment is nevertheless the thing a future test author reads before writing one, and it currently reads as a general licence.

**Fix.** Say `beforeEach` where the claim holds, and say what happens to a `beforeAll` spy.

### R4-D | P2 | P2-5's "cannot throw" rests on a step outside the tracked tree, and the tracked step it cites is not the pass-through it is described as

**Evidence.**
`PROD-READINESS.md:316` closes P2-5 on: `HybridMMKV::remove` "returns `removeValueForKey`'s boolean and contains no `throw`", pinned to `mobile/node_modules/react-native-mmkv/cpp/HybridMMKV.cpp:182-189`, and closes with "Both files are reachable from the committed `mobile/package-lock.json`" (`:193`, the round 3 paragraph the P2-5 note draws on).

Two problems, in ascending order of importance.

First, the function is not a pass-through:

```
182: bool HybridMMKV::remove(const std::string& key) {
183:   bool wasRemoved = instance->removeValueForKey(key);
184:   if (wasRemoved) {
186:     MMKVValueChangedListenerRegistry::notifyOnValueChanged(instance->mmapID(), key);
187:   }
188:   return wasRemoved;
189: }
```

`notifyOnValueChanged` invokes every registered listener callback (`MMKVValueChangedListenerRegistry.cpp:44-56`), and a listener is arbitrary JS.
That step IS tracked and it does close: the registry returns at `:47-50` when the id has no listeners, and this app registers none - `git grep -n "addListener\|useMMKV\|onValueChanged"` over `mobile/` and `src/` (excluding `node_modules`) returns nothing, and `mobile/platform/localStorageShim.ts` uses only `set`, `remove`, `clearAll`, `getString`, `getAllKeys` and `length`.
The same call sits at `:135` on the `set` path, after a successful write, which is why it is worth closing rather than ignoring.

Second, and this is the one the ledger cannot close: `instance->removeValueForKey` is MMKVCore, which lives under `mobile/ios/Pods/` - gitignored, `git ls-files mobile/ios` empty, ASSUMPTION 3.
"`remove` cannot throw" is a claim about that function too, and it is exactly the untracked-anchor problem R0-1 forced P0-1 to re-anchor away from.
What the tracked tree actually supports is narrower: the react-native-mmkv layer raises nothing on the remove path, and its published contract documents `@throws` twice on `set` (`lib/specs/MMKV.nitro.d.ts:39-45`) and none on `remove` (`:74-78`), which returns a boolean.

The decision to leave P2-5 is the user's and is unaffected either way - the argument only needs "no evidence this can happen", not "proof it cannot".

**Fix.** Narrow the claim in the ledger to the hybrid layer plus the published contract, name the MMKVCore step as untracked under ASSUMPTION 3, and record the listener step as read and closed.

### R4-E | P2 | The residual derivation is index-phrased, which asserts something about the failing slice that the trace does not cover

**Evidence.**
`PROD-READINESS.md:209`, from R3-3's fix: "if the forward write fails on slice *k*, slices 1..*k*-1 hold new values and *k*..8 were never written".

`k..8` includes `k`, the slice whose write threw.
That slice was attempted, so "never written" is a claim about what a refused write leaves behind, and the round 3/4 trace covers only where the throw comes from, not that nothing landed before it.
On iOS `localStorage.setItem` is two operations (`mobile/platform/localStorageShim.ts:75-79`): `mmkv.set`, whose throw is pinned at `HybridMMKV.cpp:130-132` and fires only when MMKV core reported the write did NOT land, and then `noteKeys`, which reaches `mmkv.getAllKeys()` -> `instance->allKeys()`.
That last call is MMKVCore again - the same untracked boundary as R4-D - and it is outside `writeKeyList`'s swallow (`storeIntegrity.ts:89-98`), which covers the sidecar write and nothing else.
On web, `QuotaExceededError` leaves the item unstored, so the premise is not in doubt there.

**The doc comment `16d1336` wrote does not have this problem, which is why this is a ledger finding and not a code one.**
`src/storage/backup.ts:257-260` partitions by state rather than by index - "Only a slice the forward write had already replaced can end up that way" - and that phrasing is exact under either reading of the failing slice.
Its supporting clause ("the slices past the failure were never written") describes `k+1..8`, all of which were genuinely untouched.

**Fix.** State the premise in the ledger sentence instead of folding it into an index range: the slices after the failure were never written, and the failing slice holds the old value because the write that threw did not land.

---

## Re-derived, not taken on trust

**Both falsifiability demonstrations reproduce, to the exact counts.**
`PROD-READINESS.md:262-266` records a table; I re-ran both rows rather than reading them.

Web, `src/storage/backup.test.ts` `rolls back every slice when a write fails partway through`, with the assertion above its inline `spy.mockRestore()` (`:385`) made false:

```
with restoreMocks:  Tests  1 failed | 36 passed (37)
without it:         × rolls back every slice when a write fails partway through
                    × finishes the rollback and reports the restore error when a rollback write fails
                    Tests  2 failed | 35 passed (37)
```

Mobile, `mobile/__tests__/range-screen.test.tsx` `reports a menu action the device store refused`, same treatment at `:124`:

```
with restoreMocks:  ✕ reports a menu action the device store refused
                    Tests: 1 failed, 8 passed, 9 total
without it:         ✕ reports a menu action the device store refused
                    ✕ shows recent sessions in the overview
                    Tests: 2 failed, 7 passed, 9 total
```

The innocent neighbour in each case is the one round 4 names.
`vitest.config.ts`, `mobile/jest.config.js`, `src/storage/backup.test.ts` and `mobile/__tests__/range-screen.test.tsx` were restored with `git checkout` after each run, as were the two probe files from R4-B; the tree is clean.

**The ordering claim is true in both runners, and now traced rather than probed.**
The anchors are in R4-C.
Jest implements `restoreMocks` as a top-level `beforeEach` registered by the adapter before the test file is loaded, so hook-registration order does the work; Vitest calls it from `onBeforeTryTask`, three lines above the `beforeEach` dispatch in the same function.
This is stronger evidence than round 4's probe and it is reproducible from the committed lockfiles, which the probe was not: it was deleted.

**`restoreMocks` reaches spies and nothing else, in both runners.**
`@vitest/spy/dist/index.js:467-471` iterates `MOCK_RESTORE`, which is added to only when `createMockInstance` is passed a `restore` option (`:10-14`), which only `spyOn` does.
`jest-mock/build/index.js:958-961` iterates `_spyState` the same way.
So `vi.fn()`, `jest.fn()` and `jest.mock` factory mocks are untouched, which is what `mobile/jest.config.js:27` claims and it is correct.
That matters here because `mobile/__tests__/practice-screen.test.tsx:27` and `mobile/__tests__/backup-screen.test.tsx:40-47` drive whole suites off factory mocks.

**The before-hook spy census is right, and I checked the four sites that look like counter-examples.**
`mobile/__tests__/backup-screen.test.tsx:60`, `:67` and `mobile/__tests__/reset-stats-panel.test.tsx:39` all sit in named helper functions (`confirmAlert`, `cancelAlert`) declared in the describe body and CALLED from test bodies, not in the hooks above them.
`mobile/__tests__/session-summary.test.tsx:12`, `:15`, `:40`, `:41` are in test bodies.
`Alert.alert` is a real function - the RN jest preset's mock directory has no `Alert` entry - so those are true spies, restored normally, and R4-B does not extend to them.

**The doc comment `16d1336` wrote is correct against both loops.**
Forward loop `src/storage/backup.ts:282-284`, rewind `:296-306`, both over the same eight entries in the same order.
Fail the forward write on slice *k*: slices before *k* hold new values, slices after *k* were never written.
The rewind then writes each slice's snapshot back; for a slice at or after *k* it is writing back a value that slice already holds, so a refusal there leaves it correct, and only a slice the forward write had already replaced can be left holding new data.
The `removeItem` branch at `:298` behaves the same way - for a slice whose snapshot is `null` and which was never written, a refused delete leaves nothing, which is correct.
`throw error` at `:307` is the only exit from the `catch`, and the inner `catch` at `:300-305` is empty, so the error the caller sees is the restore's.
The comment says all of this and claims nothing more.

**`16d1336` changes no executable line.**
`git show 16d1336 -- src/storage/backup.ts` is entirely inside the `/** ... */` block above `restoreBackup`; the other file in the commit is `PROD-READINESS.md`.
`6fb393e` touches two config files and no test file.

**Round 4's re-basing of its own anchors holds.**
The comment rewrite moved the rollback loop to `:296-306` and the rethrow to `:307`, which is where they are, and both P2-4 rows and round 2's preserved paragraph say so.
`vitest.config.ts:15-24` and `mobile/jest.config.js:21-28` resolve.
`src/storage/backup.ts:250-262` is the rewritten contract.

**REVIEW-R3's anchors resolve at `227e3e1`, the commit its header names.**
Checked because `f4addad` asserts it: `git show 227e3e1:src/storage/backup.ts` puts `removeItem` at `:290`, the inner `catch` at `:292-297` and `throw error` at `:299`, which is what R3-4 and R3-5 cite.
Round 4 was right to date them rather than rewrite them.

## What I looked for and did not find

- **No status stamped for absent work.** Every RESOLVED in the round 4 table names a commit whose tree contains the work: R3-1..R3-4 in `16d1336`, R4-1 in `6fb393e`. R3-5 is marked NEXT ROUND with no fix claimed. The section itself landed in `f4addad`, after all three.
- **No silently weakened test.** The specific hazard of `restoreMocks` is a test that still passes with its spy uninstalled. The only spy the change could have uninstalled is `error-boundary.test.tsx:22`, and it is still installed in the body and still doing its job (R4-B). Nothing else in either suite installs a spy outside a test body.
- **No scope drift.** `6fb393e` is two config lines. `16d1336` is a comment and the ledger. Neither touches a storage key, a shipped module, or a test.
- **No storage key added, renamed or reshaped.** `git diff 227e3e1..f4addad -- src/storage/ mobile/platform/` returns only the `backup.ts` comment.
- **No prohibited action.** Four ordinary commits, the review committed alone as the contract requires - which is the deviation round 1 recorded and round 4 did not repeat.
