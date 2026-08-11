# REVIEW-R3 - adversarial review of round 3

Range reviewed: `07fec73..227e3e1`, which is round 3 in full - `d13fd15` (P2-4's code and test) and `227e3e1` (the checklist baseline, the Pass 3 Sentry correction, and the round 3 ledger section).
Target: the repo at `227e3e1`, plus `PROD-READINESS.md` and `LAUNCH-CHECKLIST.md` as they stand there.

Rounds 2 and 3 shipped without a review; round 1 had four.
This review exists because that gap is what the round 1 reviews were good at closing: between them they caught four statuses stamped for work that did not exist, an inherited claim that was false, and the wrong Sentry failure mode.

Nothing below is taken from the round 3 ledger on trust.
Every number was re-derived by running the command myself, every anchor was opened, and the falsifiability claim was re-tested from scratch rather than read.

## Verdict: PASS-WITH-FINDINGS

The code in `d13fd15` is correct and I could not break it.
The loop reaches every slice, the original error is the only one that escapes, and the guard test discriminates both halves of that independently - which I proved with a second mutant the ledger did not run.
The ledger's headline numbers, its arithmetic for the archived test files, and every anchor round 3 wrote all check out.

Five findings, all P2, and four of them against the ledger rather than the code.
The one that matters is R3-1: the doc comment above `restoreBackup` still promises the guarantee the fix's own test disproves, and a false premise in that exact comment is the reason P2-4 existed in the first place.

---

## Findings

### R3-1 | P2 | The doc comment still promises atomicity, and the fix's own test asserts the opposite

**Evidence.**
`src/storage/backup.ts:250-253`, as it stands after `d13fd15`:

```
 * The write is atomic: every slice is serialized up front, the current values
 * are snapshotted, and if any `setItem` throws mid-way (e.g. a
 * `QuotaExceededError`) the snapshot is restored so the library is never left
 * half-replaced. The error the caller sees is always the one that stopped the
 * restore, never one raised while putting the old values back.
```

`src/storage/backup.test.ts:445-446`, written by the same commit:

```
    // The honest residual: the one slice a failing write left holding new data.
    expect(loadSavedRanges()[0].id).toBe('replacement')
```

The test asserts a library that is left half-replaced.
`PROD-READINESS.md:199-201` says so in prose too: "A slice whose rewind throws still holds the new value, and this fix does not change that".
So the comment's "the library is never left half-replaced" is false, and it is false in the one place a maintainer looks before touching this function.

**Why this is not a wording nit.**
P2-4 exists because a false premise lived in this same paragraph.
The commit removed "Restoring the snapshot always fits, since those values were already present" and named it as "the false premise the loop was written on" (`PROD-READINESS.md:184`).
It then left the sentence that premise was supporting.
Round 3 struck the reason and kept the conclusion.

**Fix.** State what the code guarantees: the rewind is attempted for every slice, a slice whose rewind is refused keeps the new value, and the error raised is always the restore's.

### R3-2 | P2 | Three anchors into `backup.ts` went stale when `d13fd15` landed, and the docs commit that re-based P1-1's left these

**Evidence.**
`PROD-READINESS.md:229`, the live P2-4 row: evidence `src/storage/backup.ts:244-250`.
At `21f568b` that was exact - the `catch` block ran 244-250 there, verified with `git show 21f568b:src/storage/backup.ts`.
At `227e3e1` those lines are the doc comment, and the loop the row is about is at `:288-298`.

`PROD-READINESS.md:242`, round 2's preserved argument: "`src/storage/backup.ts:278-282`'s rollback loop can itself throw" and "rethrows the ROLLBACK's error in place of the original at `:282`".
At `d13fd15^` that was exact.
At `227e3e1` lines 278-282 are comment prose inside the block the fix added, so a reader following the anchor lands on text describing the defect rather than the defect.

**Why this is a finding and not housekeeping.**
This ledger has an established convention for exactly this, applied twice: P1-1's row carries "read against `4551454` - the fix rewrote both", and P0-1's trace was re-anchored per REVIEW-1 F4 when its fix inserted lines above the call site.
`227e3e1` applied that convention to P1-1 a second time, re-basing its checklist anchors by ten and eleven lines in the same commit that left P2-4's untouched.
The named trap is "editing a doc invalidates every file:line anchor below the edit"; this is its mirror image, a code edit invalidating the anchors that describe the pre-fix code, and the same `git grep` habit catches both.

**Fix.** Annotate both, the way P1-1's row is annotated. Round 2's paragraph is deliberately preserved as written, so its anchors should be dated rather than rewritten.

### R3-3 | P2 | The residual is stated more broadly than the loop supports

**Evidence.**
`PROD-READINESS.md:199` - "A slice whose rewind throws still holds the new value".

Traced against `src/storage/backup.ts:272-299`.
Let the forward loop fail on slice *k*.
When the `catch` is entered, slices 1..*k*-1 hold new values and slices *k*..8 still hold their old ones, because their write never ran.
The rewind then walks all eight in the same order, writing each slice's snapshot back.
A rewind that throws leaves the slice holding whatever it already held - which is the new value only for a slice below *k*.
For a slice at or above *k*, the rewind was writing back a value the slice already had, so a throw there changes nothing and leaves it correct.

The residual is therefore `{ slices written before the forward failure whose rewind also threw }`, not "every slice whose rewind threw".

The error is in the pessimistic direction, so nothing is falsely reassured, and the fix's behaviour is unaffected.
It still matters, because the ledger is what the next round reasons from, and this sentence is the one a reader would quote when sizing the damage.

**Fix.** State the rule with the qualifier.

### R3-4 | P2 | The rollback loop performs two operations and the ledger traced one

**Evidence.**
`PROD-READINESS.md:184-185` establishes that a rewind can fail because `localStorage.setItem` is MMKV's `set` on iOS, then concludes: "That is the only way a rewind fails, and it was checked rather than assumed".
The check that follows is of `setItem`'s second half, the `storeIntegrity` inventory write.

The loop it is describing has a second branch.
`src/storage/backup.ts:290` calls `localStorage.removeItem(key)` for any slice whose snapshot is `null` - a slice that did not exist before the restore, which is every slice on a first-ever import.
That branch is never traced anywhere in the round 3 record.

**I traced it, and it confirms the conclusion rather than contradicting it.**

- `mobile/platform/localStorageShim.ts:80-84` - `removeItem` is `mmkv.remove(key)` followed by `noteKeys`.
- `mobile/node_modules/react-native-mmkv/cpp/HybridMMKV.cpp:182-189` - `HybridMMKV::remove` returns `instance->removeValueForKey(key)` straight through. There is no `throw` in the function.
- Contrast `HybridMMKV::set` at `:106-136`, which is where the `setItem` throw comes from: `if (!successful) [[unlikely]] { throw std::runtime_error("Failed to set value for key ...") }` at `:130-132`. This is the first place in the run that the "MMKV `set` throws on a full device" claim is pinned to a specific throw statement rather than asserted.
- `mobile/node_modules/react-native-mmkv/lib/specs/MMKV.nitro.d.ts:39-45` documents `@throws` twice on `set`; `:74-78` documents none on `remove`, whose contract is a returned boolean.

So `setItem` really is the only way a rewind fails, and now both branches have been read.

**Why record a check that came out the ledger's way.**
This project's named trap is verifying the producing half of a chain and not the consuming half - it is how round 1 got the Sentry failure mode wrong, and round 3 cites it in its own falsifiability note.
"That is the only way X fails" is a claim about all paths, and it was made after reading one.
It is also load-bearing beyond this loop: P2-5 turns on precisely the question of whether MMKV's `remove` can throw, and this trace is the answer.

**Fix.** Record the removeItem branch and its trace, so the "only way" claim rests on both.

### R3-5 | P2 | A rollback failure is now invisible to everything above the loop that swallows it (report only)

**Evidence.**
`src/storage/backup.ts:292-297` - the inner `catch` is empty by design, with a documented reason.
Not raising is correct: raising is the defect the fix removed.

But nothing else records it either.
The user is shown the restore error, which is true and actionable, and says nothing about the library now holding one slice from a different point in time.
Sentry hears nothing.
The app has two seams that would carry this - `reportCaughtError` (`mobile/platform/crashReporting.ts`) and the injected storage-loss reporter that round 2 built for exactly this class of silent damage (`mobile/platform/storeIntegrity.ts:45`).

**Deliberately not fixed here.**
`src/storage/backup.ts` is `@core` and has no reporting seam of its own; giving it one is a new behaviour on shared code, which is the user's call and not a reviewer's.
Recorded so that P2-4's RESOLVED is not read as "a mixed library now announces itself", the same way N-2 was recorded so P0-1's RESOLVED would not be read as "corruption is handled end to end".

---

## Re-derived, not taken on trust

Everything round 3 claimed that I could re-run, I re-ran.

**The falsifiability claim holds, and I checked the failure count myself rather than reading it.**
Backing the per-write `try`/`catch` out of `src/storage/backup.ts:288-298` and running `npx vitest run src/storage/backup.test.ts`:

```
 ❯ src/storage/backup.test.ts (37 tests | 1 failed)
     × finishes the rollback and reports the restore error when a rollback write fails
AssertionError: expected [Function] to throw error matching /QuotaExceededError/ but got 'RollbackWriteFailed'
 Tests  1 failed | 36 passed (37)
```

One test, named as recorded, and no cascade - the `finally` at `src/storage/backup.test.ts:437-439` does what round 3 says it does.

**A second mutant the ledger did not run, because the first one only proves half of the guard.**
The back-out above fails at the error-identity assertion on line 436, which is the first assertion in the test, so the three residual assertions below it are never reached.
On that evidence alone the guard is only shown to cover "the original error is raised" - the half about finishing the loop is untested by it.
So I ran the mutant that separates them: keep a single `try` around the whole rewind loop, catching and discarding, which preserves the original error but abandons the rewind at the first refusal.

```
 FAIL  src/storage/backup.test.ts > restoreBackup > finishes the rollback ...
AssertionError: expected { …(1) } to deeply equal { …(1) }
-     "attempts": 4,      (expected)
+     "attempts": 99,     (received)
 ❯ src/storage/backup.test.ts:443:32
 Tests  1 failed | 36 passed (37)
```

It fails on the spot-accuracy residual assertion instead, one test, no cascade.
The guard discriminates both halves independently.
`src/storage/backup.ts` was restored with `git checkout` after each run and the tree is clean.

**The baseline numbers hold at `227e3e1`.**
`npm run test:run` from the repo root: mobile 37 suites / 238 tests passing; `npx vitest run`: web 79 files / 1184 tests passing.
That is what `LAUNCH-CHECKLIST.md:26` and `PROD-READINESS.md:208` claim for `d13fd15`, and `227e3e1` is docs-only on top of it.

**The archived-test arithmetic is right, counted independently.**
Eight web test files under `archived/cloud-sync/`, at 13 + 12 + 7 + 7 + 3 + 4 + 5 + 5 = 56 declarations.
1229 − 56 + 6 = 1179, which is what `reviews/BASELINE.md:62-63` records.

**The five fix commits exist and their subjects match the five confirmed findings** in `review/findings.md`: `3c709bf`, `7ccefad`, `5fe714b`, `3078e7b`, `cc0a5d7`.

**Round 3's own correction grep re-runs clean.**
`git grep -niE "unsymbolicat|minified|upload is skipped|source-map upload"` over the tracked tree excluding the ledger and `reviews/` returns `.env.example` and `LAUNCH-CHECKLIST.md` and no third place, and the checklist no longer contradicts itself across Pass 3 and step 7.

**Every anchor round 3 wrote resolves**, opened one at a time: `LAUNCH-CHECKLIST.md:64-67` and `:195-208`, `src/storage/backup.ts:288-298` and `:299`, `src/storage/backup.test.ts:432-439`, `mobile/platform/localStorageShim.ts:75-79`, `mobile/platform/storeIntegrity.ts:89-98`, `reviews/BASELINE.md:62-63`, `vitest.config.ts:14`, `archived/RESTORE.md:415-444`.
The three that do not resolve are R3-2, and all three predate this commit's edits to them.

## What I looked for and did not find

- **No status stamped for absent work.** P2-4's RESOLVED names `d13fd15`, and the code and test are in that commit's tree. The round 3 section landed in `227e3e1`, after the work, not with it.
- **No scope drift.** `d13fd15` touches two files and nothing outside the rollback loop and its test. `227e3e1` is documentation only, and the Pass 3 correction it carries is inside the scope the round was given.
- **No storage key added, renamed, or reshaped.** The nine keys and the integrity sidecar are untouched; `git diff 07fec73..227e3e1 -- src/storage/` touches only `backup.ts` and `backup.test.ts` and changes no key constant.
- **The guard does not leak state.** The new test's spy is restored in a `finally`, and its later assertions run against real storage.
- **No prohibited action.** Both commits are ordinary edits; nothing was deleted, no dependency moved, no CI or infra file touched.
