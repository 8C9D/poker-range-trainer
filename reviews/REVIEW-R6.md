# REVIEW-R6 - adversarial review of round 6

Range reviewed: `2d09b26..b3ed6d9`, which is round 6 in full - `d56ced7` (`reviews/REVIEW-R5.md`, committed alone), `8160e41` (R5-1's comment fix plus the R5-2/R5-3/R5-4/R5-6 ledger corrections), `e419866` (the round 6 ledger section), `dac008e` (the `0c600ff` status-cell correction), `ceee8cb` (the third `daf054d`-era anchor and the sweep bound) and `a958b83` plus `b3ed6d9` (the two commits that finish the commit record).
Target: the repo at `b3ed6d9`, plus `PROD-READINESS.md` and `LAUNCH-CHECKLIST.md` as they stand there.
All anchors below read against `b3ed6d9` unless dated otherwise.

Round 6 exists because round 5 put the run's only behaviour change on the shipping binary and was not itself reviewed.
This review exists for a sharper reason: round 6's one change to shipped code is a COMMENT, in `@core`, on the data path.
No test can fail on a sentence, so the only check on it is someone reading it against the code - and nobody had.

Nothing below is taken from the round 6 ledger on trust.
The three claims in the rewritten comment were walked against the loop, the shim and the MMKV layer rather than reasoned about; the bundler half of the R5-4 fix was run rather than inferred; the bundle delta was re-measured seven times rather than twice; the holder-isolation probe was redone on `backup.ts`'s own holder instead of a stand-in; the anchor sweep round 6 explicitly left bounded was closed by opening every anchor in the ledger; and every commit hash in the ledger, the checklist and `reviews/` was resolved against `main`.

## Verdict: PASS-WITH-FINDINGS

`8160e41`'s comment is right where it matters.
Two of its three load-bearing claims survive being walked, and the second is in fact TIGHTER than the comment says - the reassurance is earned, and earned by more than the comment claims.
The third is wrong, and it is the sentence that justifies the whole design choice.

Six findings, all P2.
One is against the comment in `@core`; five are against the record.
Two of the five are the same shape as R5-3 and R5-4 one round on - the conclusion holds, the evidence was not measuring what the sentence claims - and one of those, R6-5, turns up four live anchors resolving to the wrong lines, which is the bound round 6 declared on its own sweep coming due.

---

## Findings

### R6-1 | P2 | The comment justifies under-reporting with the cost of a DIFFERENT alternative, and overstates it by seven slices

**Evidence.**
`src/storage/backup.ts:342-346`, written by `8160e41`:

```
  // That is the right direction to be wrong in. Counting optimistically would
  // instead report slices the forward write never reached - on a full device,
  // most of them - and a report that fires when the library is intact is worth
  // less than no report at all, because announcing a mixed library is the only
  // thing this reporter does.
```

"Counting optimistically" is defined by the sentence three lines above it: "Incrementing after the write never credits a `setItem` that threw".
The optimistic alternative is therefore incrementing BEFORE the write.

Walk it.
With `replaced += 1` moved above `localStorage.setItem`, a throw on slice *k* leaves `replaced === k + 1`, so the rollback guard `index < replaced` (`:379`) admits indices `0..k` and NOTHING past *k*.
The slices the forward write never reached are `k+1..7`, and every one of them is still excluded.
So the optimistic count can name exactly ONE slice the forward write may not have replaced - the same slice the current count may fail to name - and never more.

"On a full device, most of them" is the cost of a different alternative: dropping the `index < replaced` guard entirely, which is mutant 2 in the round 5 falsifiability table and the case REVIEW-R5 argues at its `:77-79`.
That argument is correct where it was made, about the guard.
`8160e41` moved it onto the counter, where it is off by a factor of eight.

**What this costs.**
The real trade is 1-vs-1, not 1-vs-most: under-report one damaged slice, or over-report one intact slice.
The direction round 6 chose is still the right one, and for the reason the sentence gives - a report that fires when the library is intact is worth less than no report at all, and here it would be the ONLY key in the report, so the whole report would be false rather than merely long.
But that is a different and narrower argument than the one written down, and the comment is the sentence a future reader will use to decide whether the counter can be moved.
A reader who checks the "most of them" claim will find it false and has no way to tell which half of the paragraph to keep.

`PROD-READINESS.md:366` carries the same sentence and needs the same fix.

**The other two claims in the same comment hold, and were walked rather than accepted.**

- **"At most one slice" is exact.** The `try` at `:348` wraps the whole `for`, not the body, so the first `setItem` that throws exits the loop - the catch cannot resume it. Every earlier iteration ran `replaced += 1`, and that statement cannot itself throw. So exactly one slice can be replaced-without-being-counted, never two. The converse over-count is not reachable either: on iOS `mmkv.set` throws when core reports the write did not land (`HybridMMKV.cpp:130-132`), so a `setItem` that returns normally did land, and on web `setItem` either stores or throws.
- **The double-failure bound holds, and is tighter than stated.** Both halves check out, and the second - the one that decides whether the reassurance is earned - is stronger than the comment claims. Half one, "threw AFTER landing", is reachable through exactly one step: `mmkv.set` then `noteKeys` (`localStorageShim.ts:75-79`), where `noteKeys` is `noteStoredKeys(mmkv.getAllKeys())` and `noteStoredKeys` (`storeIntegrity.ts:107-112`) does a `JSON.stringify` of a string array and a `writeKeyList` that swallows its own throw (`:89-98`). So `getAllKeys` is the only post-landing throw candidate, exactly as the comment names it. Half two, "refused WITHOUT landing", is reachable only through `mmkv.set` on the rewind - and the rewind is not always a `set`: `:367` uses `removeItem` when the snapshot value is `null`, whose only throw candidate on the tracked tree is that same `getAllKeys`, which by construction throws only after the removal landed. **So a slice that held nothing before the restore cannot cost a report at all**, and the double failure needs a slice that had a previous value as well as two different failure modes. Both halves rest on the react-native-mmkv layer and its published contract, not on MMKVCore: `instance->allKeys()` and `removeValueForKey` are both under the gitignored Pods tree (ASSUMPTION 3), which is why "`getAllKeys` can throw" stays an open possibility rather than an observed behaviour - and why treating `replaced` as a lower bound is right.

**Fix.** Replace the misattributed clause with the alternative it actually describes, and keep the conclusion. Add the `removeItem` half of the bound, since it is the part that makes the reassurance earned rather than asserted.

### R6-2 | P2 | "The bundler would have failed had the compiler not" is an inference inside a correction whose point was replacing an inference with an observation, and observing it shows the stated mechanism is wrong

**Evidence.**
`PROD-READINESS.md:355`:

```
The web root's `package.json` also declares no `react-native`, `expo`, `@sentry/*`
or `mmkv` dependency, so the bundler would have failed had the compiler not.
```

`npm run build` is `tsc -b && vite build && npm --prefix mobile run typecheck` (`package.json:8`), and `tsc -b` exits 2 first, so `vite build` has never run with the mutant import in the tree.
The sentence is a claim about a bundler nobody reached, sitting in the paragraph R5-4 rewrote specifically to replace an unfalsifiable assertion with an observed gate.

**Run it.**
`import { reportRestoreDamage as mobileReport } from '../../mobile/platform/crashReporting'` added at the top of `src/storage/backup.ts`, then `npx vite build` directly, bypassing the compiler:

```
Build failed with 7 errors:
[PARSE_ERROR] Flow is not supported
   ╭─[ mobile/node_modules/react-native/index.js:1:1 ]
   ╭─[ mobile/node_modules/react-native/Libraries/NativeComponent/NativeComponentRegistry.js:1:1 ]
   ╭─[ mobile/node_modules/react-native/Libraries/Utilities/PolyfillFunctions.js:1:1 ]
   ╭─[ mobile/node_modules/react-native/Libraries/Core/Devtools/parseErrorStack.js:1:1 ]
   ╭─[ mobile/node_modules/react-native/Libraries/Core/Devtools/getDevServer.js:1:1 ]
$ echo $?
1
```

Seven parse errors, and **not one resolution error**.
The bundler does fail - so the conclusion is right - but not for the reason given.
Rolldown resolves imports relative to the importing file, so `@sentry/react-native` and `react-native` resolve out of `mobile/node_modules/` regardless of what the web root's `package.json` declares; it got far enough to PARSE React Native's own Flow-typed sources and died there.
A dependency list is not what a bundler consults.

Two things the run also settles that the sentence could not:

- The unused import is not elided. TypeScript semantics would drop `import { x }` with `x` unused, which would have made the whole experiment vacuous; it is kept and followed, which is why there are errors at all.
- The observation is conditional on `mobile/node_modules` being installed, which is the state of this working tree and of any clone that has run the mobile install. In a web-only clone the same mutant would fail at resolution instead. Either way it fails, and that is worth saying explicitly rather than leaving the reader to assume one mechanism.

The compiler half reproduces exactly as recorded: `npx tsc -b` gives `TS2307` on `@core/storage/backup` and `TS2591` on `process`, both from `mobile/platform/crashReporting.ts`, at `(19,42)` and `(25,15)`.
`src/storage/backup.ts` was restored from a copy and `dist/` removed; the tree is clean.

**Fix.** Replace the inference with the observation, name the real mechanism, and state the condition it depends on.

### R6-3 | P2 | The 52-byte bundle delta is n=1 per condition against output that is not byte-reproducible

**Evidence.**
`PROD-READINESS.md:439-445` gives one export per condition and concludes "The edge costs 52 bytes".
Round 6 also recorded, at `:455`, that two exports in the same session came back identical - which is a reproducibility observation made about the CACHE trap, not about Hermes.
One pair cannot separate a 52-byte edge from 52 bytes of compiler noise.

**Re-measured: seven exports, four with the edge and three without, all `expo export --platform ios --output-dir dist --clear` with `EXPO_PUBLIC_SENTRY_DSN='https://key@o0.ingest.sentry.io/0'` set.**
The DSN is recorded because its length is in the bundle: absolute sizes here run 7 bytes under round 6's, which is a different placeholder, not a different tree.

| condition | bytes | Metro content hash |
| --- | --- | --- |
| edge present (`b3ed6d9`) | 5,494,545 / 5,494,546 / 5,494,548 / 5,494,545 | `entry-9846eee29371ffe57ab7501778ad95f6.hbc`, all four |
| edge removed (`crashReporting.ts:19` and `:63` deleted) | 5,494,493 / 5,494,494 / 5,494,494 | `entry-68e02c7fccab9678fa4e93edbef41448.hbc`, all three |

**The claim survives, and it needed the bound.**
Run-to-run spread is 3 bytes with the edge and 1 byte without, so the delta is bounded at 51 to 55 bytes and round 6's 52 sits inside it.
The edge costs tens of bytes, not hundreds, which is the only thing the number was ever load-bearing for.

**What the repeat shows that the pair could not.**
Hermes output here is NOT byte-reproducible: two exports of the identical tree under identical conditions gave 5,494,545 and 5,494,546 bytes with different SHA-256s (`419c2233…`, `cb2a4c21…`) while Metro's own content hash - the `entry-<hash>.hbc` filename, computed over the JS Metro emits - was identical across all seven runs within a condition.
So the JS is deterministic and the bytecode is not, and any future single-pair bundle comparison smaller than ~5 bytes is noise.

**Fix.** Replace the single pair with the bound, and record the non-reproducibility next to the `--clear` trap, where the next person to measure will look.

### R6-4 | P2 | The isolation probe substituted a holder that has the property under test, which the real holder does not

**Evidence.**
`PROD-READINESS.md:457-459` states the question and then answers it about a different module:

```
`setRestoreDamageReporter` has no unset path, so whether Vitest's per-file
isolation makes that moot needed checking rather than assuming.
Two temporary probe files using `rangeRemoval`'s `pendingUndo`
(`src/storage/rangeRemoval.ts:127`, the same shape as `reportDamage`) ...
```

REVIEW-R5 `:279` puts it more strongly - "the same shape as `reportDamage`, module state in `@core` with no reset".
`pendingUndo` has a reset: `clearDeletedRanges()` (`src/storage/rangeRemoval.ts:143-145`) sets it to `null` and is exported, and `peekDeletedRanges()` (`:138-140`) reads it.
So the stand-in differs from the real holder on the exact property that made the question worth asking, and it is observable in a way `reportDamage` is not - which is why the probe could be written against it at all.
`reportDamage` has a setter and nothing else: no getter, no unset, and the only way to observe it is to make a restore fail in a way that produces damage.

**Redone on the real holder.**
Two probe files under `src/test/`, importing `setRestoreDamageReporter` from `src/storage/backup.ts` and forcing a damaging restore in the `backup.test.ts:462` shape - last forward write refused, first rewind refused.
Each file first runs that restore with NO reporter installed in its own module registry and asserts nothing was reported, then installs one and re-runs to prove the mechanism fires.
The observable is a file in `os.tmpdir()`, not module state, because a shared observable is exactly what module isolation would otherwise hide.

```
--no-file-parallelism (isolation as shipped):   Test Files 2 passed (2), Tests 2 passed (2)
--no-file-parallelism --no-isolate:             Test Files 1 failed | 1 passed
  probe b: no restore-damage reporter reaches this file from another
  AssertionError: expected 'aa' to be 'a'    at probe-holder-b.test.ts:69
```

The `'aa'` is probe a's reporter firing inside probe b's restore - the leak, on the real holder, detected.
Under the shipped config it does not happen.
So round 6's conclusion is right and its missing unset path is not a defect; what was about a different module was the evidence.
Both probe files were deleted and neither is in the tree.

**Fix.** Record the probe that was actually run on the holder in question, and drop the "no reset" claim about `pendingUndo`, which is false.

### R6-5 | P2 | Closing the sweep bound: four live anchors in the ledger resolve to the wrong lines, two of them moved by round 5's own commit

**Evidence.**
`PROD-READINESS.md:485-486` bounds round 6's sweep to `src/storage/backup.ts` plus four siblings and says "anchors into files no round since the baseline has edited were not re-opened".
That is a declared gap, and it is where the defects are.

Every `file:line` anchor in `PROD-READINESS.md` was extracted and OPENED - 119 fully-qualified and 120 bare `:NN` continuations, resolved to the file named earlier in their sentence - plus the two in `LAUNCH-CHECKLIST.md`.
Four resolve to the wrong thing at `b3ed6d9`, none of them dated, all in the two `mobile/platform/` files:

| where | anchor | points at | should be | moved by |
| --- | --- | --- | --- | --- |
| `:81`, P0-1's evidence cell | `localStorageShim.ts:45` | a comment line | `:53`, the `createMMKV(...)` call | `beedb9a` (round 2) |
| `:108`, the P0-1 paragraph | `localStorageShim.ts:45` | a comment line | `:53` | `beedb9a` |
| `:527`, ASSUMPTION 2 | `localStorageShim.ts:42-48` | comment prose | `:50-57`, `store`/`getStore()` | `beedb9a` |
| `:141`, N-2's row | `crashReporting.ts:108` | a doc-comment line | `:115`, `reportStorageLoss` | `6186581` (round 5) |
| `:554`, NOT DEFECTS | `crashReporting.ts:56-59` | the restore-damage doc note | `:74-77`, the four pinned Sentry options | before `f4addad`, and again by `6186581` |

All five are live claims about HEAD.
`:108` even carries "(anchors re-based per REVIEW-1 F4 ...)", so it was deliberately made a live post-fix anchor by round 1 and then broken by round 2.
`git show 598728c:mobile/platform/localStorageShim.ts` puts `let store` at `:42` and `createMMKV` at `:45`, and `beedb9a` inserted five comment lines and the `checkForLostKeys` call above them.

**The `crashReporting.ts` pair is the sharper half.**
`6186581` edited that file - it is round 5's own behaviour change - and moved `reportStorageLoss` from `:108` to `:115` and the pinned options from `:67` to `:74`.
Round 5 wrote three NEW anchors into the same file in the same commit (`:56-59`, `:63`, `:135`) and all three are correct, so the file was in hand; what was not done is the re-grep of anchors ALREADY pointing into it.
Round 6 then reviewed round 5, sweeping `backup.ts` and declaring the rest out of scope.
This is the standing rule - "after any edit, list every anchor into the file you touched and open each one" - applied to one of the two files a commit touched.

**Fix.** Re-base all five, note the dates, and record what closing the sweep covered so the next round inherits a closed bound rather than an open one.

### R6-6 | P2 | The checklist baseline names a tree five commits behind, in a block whose own first line promises it was re-run

**Evidence.**
`LAUNCH-CHECKLIST.md:21` reads "Status baseline (verified 2026-08-11 at `6186581`)" and `:23` reads "Every line below was re-run at that commit, not carried forward".
HEAD is `b3ed6d9`.
Nothing in the block is false: `6186581` exists, the gate did run there, and the counts have not moved since (web 79 / 1187, mobile 37 / 241 at both).

The defect is smaller than a false statement and larger than nothing.
The block's whole design - round 3 rewrote it precisely because a baseline nobody refreshes rots - is that a reader can tell at a glance which tree was verified.
Naming `6186581` says nothing about the five commits after it, one of which (`8160e41`) changes a file in `@core`.
That the change is comment-only is exactly the sort of thing a reader consults a baseline to stop having to take on faith.

The churn objection round 3 was avoiding does not apply here, because this round runs the full gate before every commit regardless, so re-running the block costs one `npm audit` on top of work already being done.

**Fix.** Re-run every line of the block at `b3ed6d9` - not carry it forward - and stamp `b3ed6d9`.

---

## Re-derived, not taken on trust

**`8160e41`'s source half really is comment-only.**
`git show 8160e41 -- src/storage/backup.ts` filtered to lines that are not `//`, `*` or `/*` returns nothing, so the ledger's claim at `:489` is exact and the change cannot alter behaviour.
That is also precisely why it needed this reading: no mutant can be run against it, and the falsifiability discipline every other guard in the ledger was accepted under does not reach it.

**Every commit hash in the ledger, the checklist and `reviews/` resolves and is on `main`, with one deliberate exception.**
43 distinct hash-shaped tokens across `PROD-READINESS.md`, `LAUNCH-CHECKLIST.md` and `reviews/`, each run through `git cat-file -t` and `git merge-base --is-ancestor <hash> main`.
All 43 are commits; 42 are ancestors of `main`.
The exception is `0c600ff` at `PROD-READINESS.md:492`, which is the dangling object `dac008e` was written to document - it is named there as an object no longer on the branch, which is what it is.
`review/` carries no backticked hashes at all.
So the failure mode `dac008e` found has not recurred anywhere else.

**The round 6 commit record matches the tree.**
`d56ced7` is `reviews/REVIEW-R5.md` and nothing else, as the contract requires.
`e419866`, `dac008e`, `ceee8cb`, `a958b83` and `b3ed6d9` touch `PROD-READINESS.md` only.
`8160e41` is `PROD-READINESS.md` plus the comment-only `src/storage/backup.ts`.
No status cell names a commit that landed after it, and the one cell whose work and record land together (R5-5, naming `e419866`) says so in the paragraph at `:491`.

**The `backup.ts` anchors round 6 re-based all resolve.**
`:245-284`, `:267`, `:278`, `:278-282`, `:291-303`, `:298-299`, `:308-310`, `:329-346`, `:364-381`, `:364-382`, `:365-381`, `:367`, `:382`, `:383` and `:369-380` were each opened at `b3ed6d9`, and each is what the sentence citing it says it is.
`:120`, `:136`, `:250-262`, `:288-298`, `:296-306`, `:299`, `:300-305`, `:307`, `:349-366`, `:349-367`, `:350-366`, `:352` and `:368` are the dated pre-fix values, each carrying the commit it reads against in its own sentence.
`ceee8cb`'s four NOT DEFECTS siblings (`storageHelpers.ts:52`, `:58`, `routes.ts:29`, `practice.tsx:53`) resolve, and so does the re-based `:153`.

**The P2 table's evidence column reads at the baseline, and that is consistent rather than stale.**
Spot-checked on P2-7, whose `mobile/__tests__/app-config.test.ts:38-39` is doc-comment lines at HEAD: `git show 21f568b:mobile/__tests__/app-config.test.ts` puts the `buildNumber` assertion the row describes at exactly `:38-39`.
The two preserved round 1 blocks - D-1 at `:535` and N-1 at `:605` - each carry their "left as written" sentence, so their `BackupPanel.tsx:61` and `AccountScreen.tsx:72`/`:78` anchors are declared records rather than live claims.

**The `LAUNCH-CHECKLIST.md` counts still reproduce and the checkbox gate is real.**
`:47` is the unticked step-1 checkbox `PROD-READINESS.md:477` says it is, so P2-8 is still correctly gated.
`:136` is the RLS instruction naming the four `supabase/` files.

**FR-1 is untouched and still cannot be settled here.**
`LAUNCH-CHECKLIST.md:64-67` and `:195-208` both still say the missing-org/project behaviour is inferred and never observed, and `:67` names `PROD-READINESS.md`'s CANNOT ASSESS entry, which stands.
No EAS build was run in this round either.

## What I looked for and did not find

- **No status stamped for absent work.** Every RESOLVED in the round 6 table names a commit whose tree contains the work, and `dac008e` exists precisely because the one cell that got this wrong was caught and corrected rather than left.
- **No silently weakened test.** `8160e41` touches no test file and no executable line; the other five commits touch no source at all.
- **No storage key added, renamed or reshaped.** `git diff 2d09b26..b3ed6d9 -- src/storage/ mobile/platform/` is `src/storage/backup.ts` comments only. `mobile/platform/storeIntegrity.ts`'s second MMKV instance is untouched and still outside the nine, the backup and the three key guards.
- **No scope drift and no prohibited action.** Seven commits, the review committed alone, nothing pushed that was not asked for, no dependency changed, no EAS build started.
- **The under-report cannot become an over-report.** The `index < replaced` guard is `<`, not `<=`, and `replaced` is incremented after the write, so the reported set is always a subset of the slices actually replaced - which is the property the whole design rests on and the one direction the comment's error does not threaten.
- **`review/targets.md:136` and `:144` are still stale and still correctly left alone**, for the reason round 4 gave: they are an earlier review pass's point-in-time record, not this ledger's.
