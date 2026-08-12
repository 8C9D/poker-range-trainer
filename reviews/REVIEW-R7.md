# REVIEW-R7 - adversarial review of round 7

Range reviewed: `b3ed6d9..3b6beb4`, which is round 7 in full - `c92352c` (`reviews/REVIEW-R6.md`, committed alone), `98d698a` (R6-1's comment fix plus the R6-2/R6-3/R6-4/R6-5 ledger corrections), `c5d78cc` (R6-6, the status-baseline refresh) and `f11d9f6` plus `3b6beb4` (the round 7 ledger section and the commit that completes it).
Target: the repo at `3b6beb4`, plus `PROD-READINESS.md` and `LAUNCH-CHECKLIST.md` as they stand there.
All anchors below read against `3b6beb4` unless dated otherwise.

Round 7 exists because round 6's one change to shipped code was a comment in `@core`, on the data path, and no test can fail on a sentence.
This review exists for the same reason one round on, and the reason has sharpened rather than faded: round 7's own only change to shipped code is ALSO a comment in the same function, and the sentence it rewrote to fix an unproven absolute leans on a different unproven absolute.

Nothing below is taken from the round 7 ledger on trust.
The rewritten comment's two claims were walked against the loop and then MEASURED with the alternative counter actually in the tree; the `removeItem` half was traced back down to where the tracked tree ends; the isolation probe was re-run under the config the suite actually ships rather than under the flag that made round 7's observable work, and the runner's own source was read to find out what that flag does; the bytecode `strings` check round 7 inherited was re-run and does not hold unconditionally; every anchor in the ledger was re-extracted and re-resolved by a second script and the one anomaly round 7 dismissed is a real defect; the P2 evidence column REVIEW-R6 declared consistent from one row was checked row by row; and every hash in the ledger, the checklist and `reviews/` was resolved against `main` again.

## Verdict: PASS-WITH-FINDINGS

`98d698a` is right about the code, and the code is unchanged and correct: `replaced` is still incremented after the write, and the report is still always a subset of the slices that were genuinely replaced.
R6-1's central correction - that the comment was pricing the wrong alternative - is itself correct, and the replacement names the right one.

Seven findings, all P2.
Two are against the comment in `@core`, five against the record.
The one that matters is R7-1: fixing an unproven absolute, round 7 wrote a second one into the same sentence, and it is false in exactly the case the first one was false in - a claim about what the report would contain, stated without a condition it needs. It is now measured, both ways, against the counter it is a claim about.

---

## Findings

### R7-1 | P2 | "A false name would be the only entry in the report" is an absolute that holds only when no earlier rewind refused, and it is the half of the sentence that carries the decision

**Evidence.**
`src/storage/backup.ts:346-356`, written by `98d698a`, ends:

```
  // - a different alternative, and a far worse one.) Of the two one-slice errors
  // under-reporting is the one to take: a false name would be the only entry in
  // the report, and a report that fires when the library is intact is worth less
  // than no report at all, because announcing a mixed library is the only thing
  // this reporter does.
```

`PROD-READINESS.md:373` carries the same clause: "the falsely named slice would be the only entry in the report".

**Walk it.**
With `replaced += 1` moved above `localStorage.setItem` (`src/storage/backup.ts:360-361`), a throw on slice *k* leaves `replaced === k + 1`, so the rollback guard `index < replaced` (`src/storage/backup.ts:389`) admits `0..k`.
Indices `0..k-1` are slices whose `setItem` RETURNED, so they were genuinely replaced; if one of their rewinds also refuses it is genuinely damaged and belongs in the report.
Only index *k* can be named falsely.
So the report under optimistic counting is `{i ≤ k : rewind refused}`, and the false name is the only entry exactly when no earlier rewind refused - which is a condition, not a property.

**Measured, because a walk is not a run.**
`src/storage/backup.ts` was copied aside, the two statements in the forward loop swapped, and a temporary test drove one scenario: the forward write of slice 3 (`action-accuracy`) refused, and the rewinds of slice 0 (`saved-ranges`, which had landed) and slice 3 (which had not) both refused.

```
shipped (increment after the write):  [["poker-range-trainer.saved-ranges.v1"]]
mutant  (increment before the write): [["poker-range-trainer.saved-ranges.v1",
                                        "poker-range-trainer.action-accuracy.v1"]]
```

Two entries, one of them false.
The source was restored from the copy, not with `git checkout`, and the probe file was deleted; `git status` is clean.

**What this costs, and what survives.**
The conclusion is right and should not change.
The case that decides it is the one the sentence describes - no earlier rewind refused, so the false name IS the whole report and the report fires on an intact library - and that case is reachable and is the worst one.
When an earlier rewind did refuse, the library really is mixed, the report is right to fire, and the false name costs one key rather than the report.
But the sentence states the deciding case as if it were the only case, which is the same shape of error R6-1 was raised to fix: a magnitude asserted about an alternative rather than derived from it.
A reader who checks it will find a counter-example on the first scenario with two refusals and be left, again, not knowing which half of the paragraph to keep.

**Fix.** State the condition and say why the conditioned case is still the one that decides it. Same in `PROD-READINESS.md:373`.

### R7-2 | P2 | The `removeItem` half of the bound asserts "one throw candidate" without the caveat the sentence above it carries, and the caveat is ASSUMPTION 3

**Evidence.**
`src/storage/backup.ts:340-344`, added by the same commit:

```
  // counted, and a refused rewind there would go unreported. Only if that rewind
  // refused WITHOUT landing, though, and only for a slice that held something
  // before: where it held nothing the rewind is the `removeItem` branch below,
  // whose one throw candidate is the same post-write bookkeeping, which by then
  // has already taken the value away.
```

"Whose one throw candidate is the same post-write bookkeeping" is an absolute about `mmkv.remove`, and it is the step that makes the reassurance earned rather than asserted.
Traced: `localStorage.removeItem` is `mmkv.remove` followed by `noteKeys` (`mobile/platform/localStorageShim.ts:80-84`); `HybridMMKV::remove` (`mobile/node_modules/react-native-mmkv/cpp/HybridMMKV.cpp:182-189`) contains no `throw`, returns `instance->removeValueForKey(key)` and notifies the listener registry only when the removal happened; `MMKV.nitro.d.ts:74-78` documents `@returns` and no `@throws`, against `:39-45`'s two `@throws` on `set`.
That is as far as the tracked tree goes: `instance->removeValueForKey` is MMKVCore, under the gitignored `mobile/ios/Pods/`, which is ASSUMPTION 3 and which no clean clone contains.

`PROD-READINESS.md:603` states that caveat for exactly this call, in the P2-5 paragraph R4-D forced it into.
REVIEW-R6 R6-1 states it too, at `reviews/REVIEW-R6.md:64`.
And `98d698a` itself states it: `PROD-READINESS.md:370`, added by the same commit, reads "whose only throw candidate ON THE TRACKED TREE is the same post-write `getAllKeys`".
So one commit wrote the hedged sentence into the ledger and the unhedged one into the shipping file, where the hedge is the half that cannot be checked by anything but a reader.
The comment also hedges the symmetric claim two sentences earlier ("only the first is known to leave the store untouched when it throws"), so within one comment the same class of claim is hedged on the `set` path and absolute on the `remove` path.

**What this costs.**
This is the untracked-anchor problem R0-1 forced P0-1 to re-anchor away from, running forwards into a new comment in shipped code, where no test can catch it.
The conclusion is unaffected - the bound needs "no evidence this can happen", not "proof it cannot" - so the fix is to carry the caveat, not to widen the bound.

**Fix.** Say "on the tracked tree", name the layer the evidence comes from, and point at ASSUMPTION 3 the way `src/storage/backup.ts:337-339` already hedges `getAllKeys`.

### R7-3 | P2 | The holder-isolation probe PASSED under a runner flag the shipped config does not set, so the positive half was measured under a configuration the suite never runs

**Evidence.**
`PROD-READINESS.md:481`: "Under `--no-file-parallelism` both pass (2 files / 2 tests); under `--no-file-parallelism --no-isolate` the second fails at its first assertion".
`vitest.config.ts` sets neither `isolate` nor `fileParallelism`, and `test:run` (`package.json:11`) is a plain `vitest run`.
The observable was a shared file in `os.tmpdir()`, which is precisely what two test files running at once would race on - so the flag was there to make the observable work, and it then sat under the claim as well as under the control.

**What the runner's own source says.**
`node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js:47` defaults `isolate: true`, and `coverage.DM_a_rWm.js:180` defaults `pool` to `"forks"`; this config overrides neither.
`coverage.DM_a_rWm.js:223-225` is the ONLY non-browser read of `fileParallelism`, and it does exactly one thing: `resolved.maxWorkers = 1`.
Whether two files can share a module registry is gated on isolation alone - `cli-api.BfdDOPPI.js:3503` consults `sharedRunners` only `if (task.isolate === false)`, `:3460` pushes a runner onto `sharedRunners` only when `!task.isolate`, and `:3565` throws `Isolated tasks should not share runners` if it is ever asked with an isolated task.
Worker count only changes grouping: `:3801` gives every spec its own group when `isolate === true` whatever `maxWorkers` is, and `:3813` batches specs into one runner only when `isolate === false && maxWorkers === 1`.
So isolation is orthogonal to file parallelism, and `:3813` is also why round 7's NEGATIVE control needed the flag.

**Re-run with an observable that survives the shipped config.**
Two probe files under `src/test/`, each importing `setRestoreDamageReporter` from `src/storage/backup.ts` and forcing a damaging restore in the `src/storage/backup.test.ts:462` shape - first with no reporter installed in its own registry, then with one, to prove the mechanism fires.
The observable is `process.env.PRT_PROBE_SINK`: each file points it at its own path on load, and every reporter writes to whatever it names AT CALL TIME.
Two files in one process share the variable, so a reporter that survived from the other file lands in THIS file's sink; two files in separate processes each hold their own copy and cannot write into each other's. No shared path, so nothing to race on.
Each file also recorded `process.pid`.

```
shipped config, no flags:            Test Files 2 passed (2), Tests 2 passed (2)   pids 40061 / 40060
--no-isolate --no-file-parallelism:  probe b FAILS at expect(existsSync(SINK)).toBe(false)   pids 40444 / 40444
--no-isolate alone:                  Test Files 2 passed (2)                        pids 40633 / 40632
```

The middle row is the leak: one process, and probe a's reporter firing inside probe b's restore.
The third row is the point - with isolation off but parallelism as shipped, the two files landed in different workers and nothing leaked, so `--no-isolate` alone is not a control at all.
Both probe files were deleted and neither is in the tree.

**What this costs.**
Round 7's conclusion is right and is now measured on the configuration it is a claim about.
What was wrong is that the run which established the claim and the run which falsified the control shared a flag, and only one of them needed it.

**Fix.** Record the shipped-config run and the source reading that says why the flag is orthogonal, and keep the flag where it belongs - on the control.

### R7-4 | P2 | "Bounded at 51 to 55 bytes" is an observed min-max, and the two bytecode claims either side of the table were inherited un-re-run - one of them is conditional

**Evidence.**
`PROD-READINESS.md:460`: "Run-to-run spread is 3 bytes with the edge and 1 without, so the delta is bounded at 51 to 55 bytes".
The arithmetic is right (5,494,545 − 5,494,494 = 51; 5,494,548 − 5,494,493 = 55) but it is the min-max of four samples against three, on one machine in one session, of output the same paragraph records as not reproducible.
"Bounded" reads as a proved limit; it is an observed range.

The sharper half is what round 7 did NOT re-run while it re-measured the table between them.
`PROD-READINESS.md:465` ("the edge-removed bundle still contains every storage key") and `:471-472` (the `strings` check, and "in a build with no DSN its body is not in the binary at all") are round 6's, and they are the only evidence anywhere that the reporter reaches the shipped Hermes bytecode at all.

**Re-run at `3b6beb4`, four exports, all `expo export --platform ios --output-dir dist --clear`.**

| condition | bytes | Metro content hash | both message literals | nine storage keys |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` set | 5,494,545 | `entry-25d3c8b617dafd746aa9df9931586254.hbc` | present | present |
| set to the EMPTY STRING | 5,494,461 | `entry-eb0a7c7fe8dde58fd9d1cc8a066752fc.hbc` | **present** | present |
| edge removed (`crashReporting.ts:19` and `:63` deleted), DSN set | 5,494,493 | `entry-64ee6db602ebed41a98f9db1037d1f8e.hbc` | present | present |
| variable UNSET entirely | 5,493,421 | `entry-5f0e8b0223c403bbf100bdd7056356f2.hbc` | absent | present |

The storage-key claim reproduces: every one of the nine keys is in the edge-removed bundle, so removing the edge really does not remove a module, exactly as `PROD-READINESS.md:465` says.
The `strings` claim reproduces only for an ABSENT variable.
Set to the empty string - which `getSentryDsn` (`mobile/platform/crashReporting.ts:24-29`) treats as disabled, so the app is still inert at runtime - both `Backup restore left slices unrolled-back: ` and `Storage keys missing after open: ` are in the shipped bytecode, and the bundle is 1,040 bytes larger than the unset one.
"Its body is not in the binary at all" is therefore a claim about the variable being absent, not about crash reporting being off, and nothing in the ledger says so. An EAS env var set to an empty value is the ordinary way to produce the second row.

One more thing the repeat settles that round 7's table could not: the Metro content hash is a fingerprint of the TREE, not of the condition.
None of the four names above matches the `entry-9846eee2…` / `entry-68e02c7f…` round 7 recorded at `b3ed6d9`, whose only source difference from `3b6beb4` is R6-1's comment - while the byte sizes did not move (5,494,545 sits inside round 7's edge-present range and 5,494,493 equals its lowest edge-removed sample).
So a comment reaches the JS Metro fingerprints and does not reach the bytecode, and a hash carried across rounds will differ for reasons that have nothing to do with the edge.

**Fix.** Say the range is observed rather than bounded, record the re-run and the condition the `strings` claim needs, and note that the content hash is dated to its tree.

### R7-5 | P2 | The anchor sweep's one dismissed anomaly is a real defect in the ledger, and the sweep's scope is smaller than "closed" suggests until the rest of the repo is checked

**Evidence.**
`PROD-READINESS.md:603`, in the P2-5 trace: "The same call sits on the `set` path at `:135`, after a successful write."
Under this file's own convention a bare `:NN` continues from the file last named, and the file last named is `MMKVValueChangedListenerRegistry.cpp` (at `:44-50`, one sentence earlier), which is 58 lines long.
The intended target is `HybridMMKV.cpp:135`, which is indeed `notifyOnValueChanged` on the `set` path.
Round 7 hand-checked `HybridMMKV.cpp:135`, found the intent right and recorded the hit as a script mis-attribution.
The intent is right; the sentence is still wrong, and it is the one anchor in either document that does not resolve.

**The rest of the repo, since "a tool that reports zero is not a reading".**
Every other Markdown file was opened for anchors rather than assumed clean: `README.md`, `AGENTS.md`, `FEATURE-AUDIT.md`, `TRIM-REPORT.md` and all nine files in `docs/` carry no `file:line` anchor at all - the only `:NNNN` hits in any of them are `localhost:5173` in two run-command lines.
`review/findings.md` and `review/targets.md` carry 112 between them, of which 13 already point PAST the end of the file they name and 5 name a basename that exists in two directories.
That settles round 4's call about `review/targets.md:136` and `:144` for the whole of both files rather than for the two lines it was made about: they are an earlier pass's point-in-time record, and an eighth of their anchors could not be re-based at all without inventing a target.
`docs/archive/` holds 6 more, in files the directory name dates.

**The counts are the script's, not the file's.**
An independent extraction of `PROD-READINESS.md` returns 159 fully-qualified anchor occurrences (130 distinct) and 176 bare `:NN` continuations (115 distinct), against the 119 and 120 the ledger records - the difference is tokenisation, not coverage.
Resolving every basename against the whole tracked tree plus both `node_modules` trees, rather than a fixed prefix list, produced no ambiguity: each resolves to exactly one file.
Every one of the 337 anchors across both documents resolves to a line that exists, except the bare `:135` at `PROD-READINESS.md:603` above.

**Folded in rather than filed separately.**
`PROD-READINESS.md:637` says `crashReporting.ts:56-59` "had been moved twice since, most recently by round 5's `6186581`" and never names the first mover.
`git log` on that file returns `6c9cd22`, `beedb9a`, `6186581` and nothing else, and `attachScreenshot` sits at `:56` at `21f568b`, `:67` after `beedb9a` and `:74` after `6186581`.
The first mover is round 2's `beedb9a`, the same commit that broke the three `localStorageShim.ts` anchors R6-5 re-based.

**Fix.** Name the file on that `HybridMMKV.cpp` anchor, record what the rest of the repo holds so the next round inherits a closed scope rather than an untested assumption, and name `beedb9a`.

### R7-6 | P2 | The refreshed status baseline is one commit behind the tree it lives in, which is the floor rather than a lapse - and the block still reads as though it were not

**Evidence.**
`LAUNCH-CHECKLIST.md:21` reads "Status baseline (verified 2026-08-11 at `98d698a`)", and `:23` still reads "Every line below was re-run at that commit, not carried forward".
The commit that WROTE that stamp is `c5d78cc`, one later.
R6-6 reduced the gap from five commits to one; it cannot remove it, for the same reason a status cell may only name a commit that already exists - a stamp cannot name the tree it lives in.

Nothing in the block is false: the gate did run at `98d698a`, and `c5d78cc`'s entire diff is the three lines of this block, so nothing executable separates the stamped tree from the stamping one.
The defect is that a reader cannot tell that from the block.
Its own next line now explains that it read `6186581` "until round 7, five commits behind", which frames being behind as the failure - and leaves the reader to work out whether one behind is intended or the next instance of the same rot.

**Fix.** State the floor in the block: the stamp names the commit the gate ran at, which is always the parent of the commit that writes it, and say what the one-commit gap contains.

### R7-7 | P2 | The P2 table's evidence column was declared consistent from one row of ten; nine hold and the tenth is an undated anchor onto a doc comment

**Evidence.**
`reviews/REVIEW-R6.md:243-244` concludes "The P2 table's evidence column reads at the baseline, and that is consistent rather than stale", spot-checked on P2-7 alone.
That is the enumeration-vs-claim trap: one checked row is not a checked table, and round 7 carried the conclusion forward without checking the rest.

**Checked, all ten, against `21f568b`.**
`git diff 21f568b HEAD` is EMPTY for `public/service-worker.js`, `src/storage/statsReset.ts`, `src/storage/sessionHistoryStorage.ts` and `src/main.tsx`, so the eight anchors in P2-1, P2-2, P2-3, P2-5, P2-6, P2-9 and P2-10 read identically at the baseline and at HEAD and cannot be stale either way.
Each was opened and each is what its row says: `public/service-worker.js:51` is the floating `cache.put`, `public/service-worker.js:12` and `:33` are the cache name and the cleanup filter that spares it, `public/service-worker.js:1` and `:8` are the "v3.1" header and the Supabase line, `src/storage/statsReset.ts:44-46` is the `removeJson` loop, `src/storage/sessionHistoryStorage.ts:105-116` is the append-and-re-serialize, `src/main.tsx:21-23` is the swallowed registration failure and `src/main.tsx:10` is the non-null assertion.
P2-8 and P2-11 carry no line anchors.
P2-4 carries its own date inline.

That leaves P2-7, and it is the row REVIEW-R6 checked.
`mobile/__tests__/app-config.test.ts:38-39` is the `buildNumber` assertion at `21f568b`, exactly as recorded - and at HEAD it is a blank line and `/**`.
The cell is undated, so the conclusion is true and unreadable from the document: nine rows are indistinguishable from live anchors because they happen to be both, and the tenth is a live-looking anchor onto a doc comment.

**Fix.** Date the column once at the table. Do not re-base P2-7 - the evidence column is the record of what was found at the baseline, and re-basing it would destroy that.

---

## Re-derived, not taken on trust

**`98d698a`'s source half really is comment-only, and so is the whole round.**
`git diff b3ed6d9..3b6beb4 -- src/storage/ mobile/platform/` touches `src/storage/backup.ts` alone, and filtering that diff to lines that are not `//`, `*` or `/*` returns nothing.
The round is four files: `LAUNCH-CHECKLIST.md`, `PROD-READINESS.md`, `reviews/REVIEW-R6.md` and the comment-only `backup.ts`.

**Every commit hash in the ledger, the checklist and `reviews/` resolves and is on `main`, with the one deliberate exception.**
47 distinct hash-shaped tokens, each run through `git cat-file -t` and `git merge-base --is-ancestor <hash> main`: all 47 are commits, 46 are ancestors of `main`, and the exception is `0c600ff`, which `PROD-READINESS.md:517` names as the dangling object `dac008e` was written to document.
`review/` still carries no backticked hashes at all.

**The round 7 commit record matches the tree.**
`c92352c` is `reviews/REVIEW-R6.md` and nothing else, as the contract requires.
`c5d78cc` is `LAUNCH-CHECKLIST.md` and nothing else.
`f11d9f6` and `3b6beb4` touch `PROD-READINESS.md` only.
No status cell in the round 7 table names a commit that landed after it, and the section says so at `:578`.

**R6-5's four re-based anchors all resolve at HEAD**, and so do the pre-fix values they replaced, which is why they were invisible: `localStorageShim.ts:53` is the `createMMKV` call and `:50-57` is `store`/`getStore()`; `crashReporting.ts:115` is `reportStorageLoss` and `:74-77` the four pinned Sentry options.

**The holder census holds.**
`git grep -l setRestoreDamageReporter` returns `src/storage/backup.ts`, `src/storage/backup.test.ts` and `mobile/__tests__/crash-reporting.test.ts` plus documents; the only other web caller of `restoreBackup` is `src/screens/AccountScreen.tsx`, exercised by `src/screens/AccountScreen.test.tsx` through the component's import flow, which installs no reporter.

**P1-1's two pre-fix checklist anchors are dated twice over and both dates agree.**
`LAUNCH-CHECKLIST.md:54` and `:185` are the `SENTRY_AUTH_TOKEN` checkbox and its `eas secret:create` line at `21f568b` AND at `4551454`, so the row's `4551454` date and the paragraph's `21f568b` date do not conflict.

**The R6-6 refresh's own anchor shift reproduces.** `c5d78cc` added two lines at `LAUNCH-CHECKLIST.md:24`, and every anchor into that file in the ledger now resolves at its shifted value: `:36`, `:49`, `:68-69`, `:66-69`, `:138`, `:197-210`, `:207-209`.

## What I looked for and did not find

- **No status stamped for absent work.** Every RESOLVED in the round 7 table names a commit whose tree contains the work, and no cell names its own commit - R6-3's re-measurement is recorded as a correction to the round 6 table it disproves, which lands in `98d698a`, earlier than the section that describes it.
- **No silently weakened test.** Round 7 touches no test file and no executable line; the five R3-5 mutants are unaffected and the falsifiability tables still describe the code in the tree.
- **No storage key added, renamed or reshaped.** The only `src/storage/` change is comments. `mobile/platform/storeIntegrity.ts`'s second MMKV instance is untouched and still outside the nine, the backup and the three key guards.
- **No scope drift and no prohibited action.** Five commits, the review committed alone, no dependency changed, no EAS build started. The exports above are local.
- **The under-report still cannot become an over-report.** The guard is `<` and `replaced` is still incremented after the write, so the reported set stays a subset of the slices actually replaced - which R7-1's measurement confirms from the other side: the shipped counter reported one key where the optimistic one reported two.
- **FR-1 is untouched and still cannot be settled here.** `LAUNCH-CHECKLIST.md:66-69` and `:197-210` still say the missing-org/project behaviour is inferred and never observed, and `PROD-READINESS.md:660`'s CANNOT ASSESS entry stands. No EAS build was run in this round either.
- **P2-8 is still correctly gated.** `LAUNCH-CHECKLIST.md:49` is unticked, `:138` is the RLS instruction naming the four `supabase/` files, and nothing in the tree records a route taken.
- **`review/targets.md:136` and `:144` are still stale and still correctly left alone**, now with the whole of both files measured rather than the two lines: see R7-5.
