# REVIEW-R8 - adversarial review of round 8

Range reviewed: `3b6beb4..464f556`, which is round 8 in full - `1e919b0` (`reviews/REVIEW-R7.md`, committed alone), `8fb764d` (the R7-1/R7-2 comment fix plus the R7-3/R7-4/R7-5/R7-7 ledger corrections), `7528f39` (R7-6, the status-baseline stamp), `48725ba` (a correction to R7-7's own paragraph) and `f6716b1` plus `464f556` (the round 8 ledger section and the commit that completes it).
Target: the repo at `464f556`, plus `PROD-READINESS.md` and `LAUNCH-CHECKLIST.md` as they stand there.
All anchors below read against `464f556` unless dated otherwise.

Round 8 exists because round 7's one change to shipped code was a comment in `@core`, on the data path, and no test can fail on a sentence.
This review exists for the same reason a round on, and for the fourth time in a row the round's only source change is a comment in that same function.

Nothing below is taken from the round 8 ledger on trust.
The bundle-fingerprint conclusion was re-run from scratch, with the hashing code read and the hash reproduced by hand; the `mmkv.remove` chain was opened at the link round 8 skipped; the rewritten comment was measured on the case it does not mention; the isolation probes were rebuilt and run twenty-two times across four configurations; the runner's sequential path was read forwards; every anchor in both documents was resolved under both conventions and a sample opened by hand; the commit timestamps were compared against a measured gate; and every hash in the ledger, the checklist and `reviews/` was resolved against `main` again.

## Verdict: PASS-WITH-FINDINGS

The code is unchanged and correct: `replaced` is still incremented after the write, the guard is still `<`, and the reported set is still a subset of the slices genuinely replaced.
Round 8's two central conclusions both survive contact with measurement - the comment fingerprint claim turns out to be true, and it is now proved rather than inferred; the `mmkv.remove` bound holds at the link that was skipped.

Nine findings, all P2.
One is against the comment in `@core`, eight against the record.
The one that matters is R8-3: four rounds have now rewritten the same paragraph, and it still prices only one of the two errors it chooses between - the other one is silence, measured below.

---

## Findings

### R8-1 | P2 | "A comment reaches the JS Metro fingerprints but not the bytecode" was an inference inside a correction whose point was replacing an inference with an observation - it is true, and the sentence still misdescribes the mechanism

**Evidence.**
`PROD-READINESS.md:484` concludes from four `.hbc` files that "A comment reaches the JS Metro fingerprints but not the bytecode."
What was observed is that the `entry-<hash>.hbc` NAME differs between two trees whose only source difference is a comment, while the byte size did not move.
Three other explanations were never eliminated - a source-map input to the hash, a module-order change, a cache key - and this is REVIEW-R6 R6-2's exact shape one round on.

**Read the code that makes the name.**
`@expo/metro-config/build/serializer/exportPath.js:15-24` builds the path as `_expo/static/js/${platform}/${name}.js`, where `name` is `fileNameFromContents({filepath, src})`; `serializer/getCssDeps.js:106-111` is `getFileName(decoded) + '-' + hashString(src)`; `utils/hash.js:8-10` is `crypto.createHash('md5').update(str).digest('hex')`.
So the name is `entry-` plus the md5 of one string, and the only question is which string.

**Measured, at `464f556`, seven exports.**

| export | conditions | bytes | name | md5 of the emitted file |
| --- | --- | --- | --- | --- |
| bytecode | DSN 33 chars, `--clear` | 5,494,545 | `entry-1a3dfb01517b41cac067079896bc6451.hbc` | `d2f4ccc5d6b040cd…` |
| bytecode, repeat | identical tree and condition | 5,494,545 | `entry-1a3dfb01517b41cac067079896bc6451.hbc` | `d0c6d1569e6a40fb…` |
| bytecode | marker comment appended to `src/storage/backup.ts` | 5,494,544 | `entry-a6ccc3eaa1388c15598427b4a4d3a569.hbc` | `305db5e090243bfa…` |
| bytecode | DSN 43 chars | 5,494,556 | `entry-4d2000cc94bf93321543fb098d335e6e.hbc` | - |
| `--no-bytecode` | DSN 33 chars | 3,846,795 | `entry-3cca1405f3a33680c3c4e9dd257da084.js` | `3cca1405f3a33680c3c4e9dd257da084` |
| `--no-bytecode` | + the marker comment | 3,846,795 | `entry-3cca1405f3a33680c3c4e9dd257da084.js` | identical |
| `--no-bytecode --no-minify` | DSN 33 chars | 9,332,719 | `entry-1a3dfb01517b41cac067079896bc6451.js` | `1a3dfb01517b41cac067079896bc6451` |
| `--no-bytecode --no-minify` | + the marker comment | 9,332,786 | `entry-a6ccc3eaa1388c15598427b4a4d3a569.js` | `a6ccc3eaa1388c15598427b4a4d3a569` |

Three exact matches settle it.
The md5 of the UNMINIFIED JS is, byte for byte, the name the bytecode export gives its `.hbc` - `1a3dfb01…` for the clean tree and `a6ccc3ea…` for the comment tree.
The marker string is present in that unminified JS (`grep` finds it, and the file is 67 bytes longer), absent from the minified JS, and absent from both `.hbc` files (`strings` finds zero hits in either).
So a `//` comment survives into the pre-Hermes emit that the name is hashed over, and reaches neither the minified JS nor the bytecode.

The three unexamined alternatives are ruled out rather than argued away.
No source map is written at all: `expo export --source-maps` defaults to `false` (`npx expo export --help`), and `find dist -name '*.map'` over a completed export returns zero - so the `.map` this review was told to open does not exist.
Module order and cache keys can only matter through that one md5 input, and the input was reproduced by hand.
And the name is stable per tree-and-condition while the bytecode is not: the repeat export gave the same name and a different `.hbc` md5, which is the same non-reproducibility `PROD-READINESS.md:467` records, now shown alongside a stable name in one pair of runs.

**What this costs.**
The conclusion is right, so nothing downstream moves.
What was missing is that it was an inference, and one of its two halves is stated wrongly even now: `:467` calls the name a hash "over the JS Metro emits", and the emit it is actually over is the unminified one that no build ships. The shipped minified JS is byte-identical with and without the comment.

**Fix.** Record the measurement, name the hashed string exactly, and say that no `.map` is emitted.

### R8-2 | P2 | The `mmkv.remove` chain was verified at both ends and skipped the middle; opened, the bound holds and the middle turns out to be a re-thrower

**Evidence.**
`src/storage/backup.ts:344-348` and `PROD-READINESS.md:371` both rest on "`mmkv.remove` raises nothing at the react-native-mmkv layer", evidenced by `HybridMMKV.cpp:182-189` and `MMKV.nitro.d.ts:74-78`.
Between the JS call and that C++ method sit the nitrogen-generated bridge and react-native-mmkv's own JS, neither of which was opened - the trap round 1 sprang on `sentry.properties`.

**Opened, both halves.**
The JS half adds nothing: `lib/index.js` exports `createMMKV`, the exists/delete helpers and the hooks; `lib/createMMKV/createMMKV.js:7-33` returns `factory.createMMKV(config)` - the C++ HybridObject itself - so no JS wrapper stands between `mmkv.remove(key)` and the native method.
The generated bridge adds nothing either: `nitrogen/generated/shared/c++/HybridMMKVSpec.cpp` is 42 lines of `registerHybridMethod` calls and contains no `throw`.

The link that does contain throws is the one neither document names: `react-native-nitro-modules@0.36.5`, `cpp/core/HybridFunction.hpp:90-134`, which is what `registerHybridMethod` builds.
Its throw sites are: an arity check at `:103-113`, which for `remove(key: string)` fires only when the call passes other than one argument; four `this`/`NativeState` checks at `:195-235`, every one of them inside `#ifdef NITRO_DEBUG`, which `cpp/utils/NitroDefines.hpp:15-20` leaves undefined whenever `NDEBUG` is set, i.e. in the build that ships; an argument conversion, `JSIConverter<std::string>::fromJSI` = `arg.asString(runtime).utf8(runtime)` (`cpp/jsi/JSIConverter.hpp:156-159`), which throws only for a non-string; and a catch-all at `:119-129` that re-throws anything from below as a `jsi::JSError`.
The shim's call is `mmkv.remove(key)` on the instance with one string (`mobile/platform/localStorageShim.ts:80-84`), so none of the call-shape throws can fire.

**What this costs.**
The bound survives, and the caveat gets sharper rather than weaker: the bridge does not absorb anything, so whatever MMKVCore raises under ASSUMPTION 3 arrives in JS as an error. "Raises nothing at the react-native-mmkv layer" is now checked at all three links instead of two.
One neighbouring claim also needs its bound stated. `PROD-READINESS.md:691` rules out the value-changed listener registry using `git grep` over `mobile/` and `src/`, which cannot see `node_modules`; `createMMKV` does register two listeners of its own there (`addMemoryWarningListener`, `addContentChangedListener`), and they are `AppState` listeners rather than MMKV value-changed ones, so the registry really is empty - but that was luck rather than coverage.

**Fix.** Name the bridge and what it can and cannot raise, in the comment and in the ledger, and state the grep's bound.

### R8-3 | P2 | The comment prices the optimistic counter and never prices under-reporting, whose own worst case is SILENCE on a mixed library - measured

**Evidence.**
`src/storage/backup.ts:356-363` ends: "Of the two one-slice errors under-reporting is the one to take, on the case that decides it: where no EARLIER rewind refused, the false name is the whole of the report … Where an earlier rewind did refuse, the guard admits it too, so the false name adds a key to a report that is already true rather than being one - the empty-otherwise case is what the choice turns on."
Every clause there is about what the OPTIMISTIC counter costs. The comment never says what the shipped counter costs in its own empty-otherwise case, and `reportRestoreDamage` returns early on an empty list (`src/storage/backup.ts:278`), so that cost is not "a report short by one key" - it is no report at all.

**Measured, two temporary tests, both deleted.**
The iOS shape the comment is about: the forward write of `trainingGoal` (index 7, the last slice) LANDS and then throws - `mmkv.set` succeeded and the `getAllKeys` bookkeeping after it refused - and its rewind then refuses without landing.

```
only the uncounted slice damaged:  restore throws QuotaExceededError
                                   saved-ranges  -> "original"  (rewound)
                                   trainingGoal  -> 50          (restored file's)
                                   reporter      -> NOT CALLED

control, saved-ranges also refuses: reporter -> ["poker-range-trainer.saved-ranges.v1"]
                                   saved-ranges -> "replacement", trainingGoal -> 50
                                   (both slices damaged, one named)
```

So the two one-slice errors are symmetric in shape, and each has an empty-otherwise case that is the whole of its cost: for the optimistic counter, a report that fires on an intact library; for the shipped one, silence on a library that really is mixed - the exact outcome this reporter exists to prevent.
The control also shows the milder half: where something earlier refused, the report fires and is true, and the damaged slice is simply missing from it.

**What this costs.**
The decision is still defensible and should not change - a report that cries wolf is worse than one that misses the last slice, and the missed case needs two different failure modes on one slice.
But the paragraph reads as an argument with one side's costs on the page, and it is the fourth rewrite of this same comment: R5-1 removed an unproven premise, R6-1 a wrong magnitude, R7-1 an unstated condition, and this is an omission rather than an error.

**Fix.** State both costs in one sentence each, or say the omission is deliberate and why. Same in `PROD-READINESS.md:378`.

### R8-4 | P2 | 1,040 bytes sits one clause from the reporters' claim and belongs to neither of them, and an 84-byte row hides a 51-byte residue nobody attributed

**Evidence.**
`PROD-READINESS.md:482` reads "both message literals are in the shipped bytecode and the bundle is 1,040 bytes larger than the unset one", which invites reading 1,040 as what the reporters cost.
It is the whole DSN-gated delta between the unset and empty-string conditions.
In the same table the real-DSN bundle is 84 bytes larger than the empty-string one while the placeholder DSN is 33 characters, and the 51-byte residue is unexplained.

**Measured.**
Three unminified exports at `464f556` (`--no-bytecode --no-minify`, which is the string the bundle name hashes - see R8-1):

| `EXPO_PUBLIC_SENTRY_DSN` | unminified JS bytes | `Backup restore left slices unrolled-back` | `Storage keys missing after open` |
| --- | --- | --- | --- |
| 33 characters | 9,332,719 | present | present |
| empty string | 9,332,686 | present | present |
| unset | 9,332,710 | present | present |

The JS difference between the 33-character DSN and the empty string is exactly 33 bytes - the string, and nothing else.
And both reporter message literals are in the JS in ALL THREE conditions, including unset: so the 1,040-byte bytecode delta is not the reporters being added to the bundle. What changes between unset and empty is what the minifier and Hermes fold away downstream, not what the source contains.
The string's own cost passes through at about a byte per character: a 43-character DSN gives 5,494,556 against 5,494,545 for the 33-character one, +11 for +10.
That accounts for 33 of the 84, and leaves a ~51-byte residue that is a bytecode-level effect nothing here attributes.

**Fix.** Say what each delta is a delta of, keep 1,040 away from the reporter sentence, and record the residue as unattributed rather than leaving it to be inferred.

### R8-5 | P2 | "An EAS env var set to an empty value is the ordinary way to produce the other case" - nothing was consulted, and `mobile/eas.json` sets no environment at all

**Evidence.**
`PROD-READINESS.md:483` states it as fact. `mobile/eas.json` was not opened; nor was the checklist; nor EAS.
It is 20 lines: a `cli` block, three build profiles (`development`, `preview`, `production`, the last carrying only `autoIncrement: true`) and one `submit` profile.
There is no `env` block anywhere in it, and `git grep EXPO_PUBLIC_SENTRY_DSN -- mobile/` returns only `mobile/platform/crashReporting.ts:25`, the two comment lines that describe the gate, and the test that sets it.
`LAUNCH-CHECKLIST.md:66` asks for `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` as EAS secrets and never mentions the DSN.

So nothing in the tracked tree routes any value - empty or otherwise - into an EAS build for this variable, and whether EAS's own environment-variable UI can hold an empty string is a claim about a remote system, in a ledger whose ASSUMPTION 3 exists because of exactly that habit.

**Fix.** Narrow it to what the local exports showed - that a variable present and empty produces the second case - and say what settling the EAS half would take.

### R8-6 | P2 | The pids prove more than the ledger claims and the sink assertion proves less, and the negative control is a coin flip - 22 runs

**Evidence.**
`PROD-READINESS.md:499-501` pairs "2 files / 2 tests pass, in pids 40061 and 40060" with the shipped-config claim, then reports that `--no-isolate` alone also gave two different pids.
Both rows are single runs.

**Re-measured.** Two probe files rebuilt to REVIEW-R7's design - probe a installs a reporter that writes to whatever `PRT_PROBE_SINK` names at call time and drives a damaging restore; probe b installs none, drives the same restore, and asserts its own sink does not exist - plus each file recording its pid and the real-time order.

| configuration | runs | result | pids | order |
| --- | --- | --- | --- | --- |
| shipped config, no flags | 5 | 2 passed, every time | two distinct, every time | b before a in 4 of 5 |
| `--no-isolate` alone | 5 | 2 passed, every time | two distinct, every time | a before b in 4 of 5 |
| `--no-file-parallelism` alone | 4 | 2 passed, every time | **two distinct, every time** | a before b in 3 of 4 |
| `--no-isolate --no-file-parallelism` | 8 | **1 failed in 2 of 8** | one pid, every time | a before b in exactly those 2 |

Three things follow, and none of them is what the ledger says.

The pids are not a weaker proxy for the sink observable; under the shipped config they are the load-bearing evidence. A module-level holder cannot cross a process boundary, so two distinct pids are the reason nothing leaked, and the sink assertion in probe b can only discriminate in runs where probe a has already installed its reporter - which was 1 of the 5 shipped runs.

The negative control fires exactly when probe a runs before probe b, and Vitest does not fix that order: 2 of 8 runs had it and both failed; the other 6 ran b first and passed in one process with a shared registry. Rounds 7 and 8 each ran it once and each drew the failing order.

And `--no-file-parallelism` alone puts each file in its OWN process even at `maxWorkers: 1`. So in the forks pool `isolate: true` is process-per-file rather than a fresh registry inside one process, which is a stronger guarantee than the ledger claims and is why no shipped-config run can leak.

**Fix.** Say what each row proves, mark the control as order-dependent with the counts, and record that isolation here is process separation.

### R8-7 | P2 | The sequential branch was concluded from its converse, and the "ungrepped" package is not installed in this tree

**Evidence.**
`PROD-READINESS.md:497` reasons about grouping from `cli-api.BfdDOPPI.js:3813`'s converse rather than from the `sequential` path itself.

**Read forwards.**
`node_modules/vitest/dist/chunks/cli-api.BfdDOPPI.js:3801` pushes `[spec]` - a one-element array - into `sequential.specs` when `isolate === true && groupOrder === 0 && maxWorkers === 1`; `:3831` appends that group; and `:3624-3675` turns each element of a group's `specs` into ONE task whose `context.files` is that array, run by one `pool.run(task, method)` at `:3684`.
So a spec in the sequential group is its own task carrying one file. `:3813` is the only branch where several specs share one array, and it needs `isolate === false && maxWorkers === 1`.
Round 8's conclusion is right, and it is now read rather than inferred - and R8-6's four `--no-file-parallelism` runs are the same result observed from outside.

**And `tinypool` does not exist here.**
`npm ls tinypool` returns empty, `vitest@4.1.8`'s dependency list contains no such package, and the only occurrence of the string in its `dist` is a GitHub URL in a comment at `cli-api.BfdDOPPI.js:3097`.
Vitest 4 carries its own fork pool in the chunk that was already being read, so the survey that "never grepped tinypool" was not missing a layer.

**Fix.** Record the forward reading and the fact that the pool is vitest's own.

### R8-8 | P2 | The anchor convention is load-bearing, differs between rounds, and is written down nowhere; and the sweep read a resolver's report

**Evidence.**
`PROD-READINESS.md:691` fixes an anchor by appealing to "this file's convention" for a bare `:NN`.
That phrase occurs twice in the repo - there and at `reviews/REVIEW-R7.md:167` - and neither defines it.
Round 7's resolver attributed a bare `:NN` to the last file named on the SAME LINE; round 8's carries attribution across lines. The counts move with the choice, which is why the reported totals keep changing (119 and 120 in rounds 6 and 7, 159 and 176 in REVIEW-R7's independent extraction).

**Re-run, both ways, at `464f556`.**
A third extraction, resolving each basename against the whole tree:

```
carry across lines (round 8's rule): PROD-READINESS.md 385 anchors with a line number, 0 unattributed
same line only (round 7's rule):     PROD-READINESS.md 313 anchors, 72 bare left unattributed
LAUNCH-CHECKLIST.md: 2 anchors, both ways
```

Under either rule, nothing points past the end of the file it names, so round 8's "all resolve" holds - and a fourth script produces a fourth pair of totals, which is the point: the number is a property of the extractor, not of the file.
Three anchors resolve ambiguously by basename alone (`README.md:11-13`, `README.md:16-17`, `package.json:11`); all three were opened by hand and are the repo-root files, saying what the ledger says they say.
`PROD-READINESS.md:649` says every anchor "was re-extracted and re-opened", which describes reading a resolver's report rather than opening 385 targets; a sample of ten was opened here by hand, including the two the P2 table dates to `21f568b`.

**Fix.** Write the convention into the file beside the sentence that depends on it, report counts with the rule that produced them, and say plainly which anchors were opened by hand.

### R8-9 | P2 | The status-baseline block explains its own one-commit gap with a sentence the round's next three commits falsified

**Evidence.**
`LAUNCH-CHECKLIST.md:21-25` stamps `8fb764d` and states the floor R7-6 asked for - and then illustrates it: "what separates the two trees is this block's own text."
That was true when `7528f39` wrote it. Three commits later it is not: `git diff --stat 8fb764d..HEAD` is 6 lines of `LAUNCH-CHECKLIST.md` and 66 of `PROD-READINESS.md`, from `48725ba`, `f6716b1` and `464f556`.
The stamp is now four commits behind, not one.

Nothing about the gate is false - `8fb764d` was gated, and everything after it is documentation - but the block's own account of the gap is a point-in-time claim written as a standing one, in the file that ships the floor. This is the trap the round names in its own list: a correction can be contradicted by the very next commit.

**Fix.** State the gap as a class a reader can check (`git diff --stat` from the stamp to HEAD is Markdown only) rather than as one specific diff, and re-stamp onto the tree this round gates.

---

## Re-derived, not taken on trust

**The gate-ordering disclosure is complete as far as the record can show it.**
`PROD-READINESS.md:657` discloses that `48725ba`'s gate ran after it landed. The commits are 322, 185, 7, 222 and 79 seconds apart (author and committer dates identical throughout, so nothing was amended or rebased).
The full gate was timed twice at `464f556` from the repo root: 107 seconds cold-ish (lint 14s, `test:run` 86s, build 7s) and 50 seconds warm.
Only the 7-second window is below the fastest measured gate, and it is exactly the one disclosed; the 79-second window between `f6716b1` and `464f556` sits inside the range and rules nothing out either way.
The bound: timestamps can rule a window out, they cannot show that a gate ran, and nothing in the tree records which tree any gate ran on. That half of `:657` is unfalsifiable from the repository and has to be taken as testimony.

**The gate is green at `464f556`.** Lint clean on both apps, web 79 files / 1187 tests, mobile 37 suites / 241 tests, `npm run build` clean including mobile `tsc --noEmit`. Run from the repo root; the `mobile/` variant of `test:run` is a different and much smaller run, which is worth saying because it silently succeeds.

**The hash audit reproduces exactly.** 54 distinct hash-shaped tokens across `PROD-READINESS.md`, `LAUNCH-CHECKLIST.md` and `reviews/`, each through `git cat-file -t` and `git merge-base --is-ancestor <hash> main`: all 54 are commits, 53 are ancestors of `main`, and the exception is `0c600ff`, which the ledger names as the dangling object `dac008e` documents.

**`8fb764d`'s source half really is comment-only.** `git show 8fb764d -- src/storage/backup.ts` filtered to lines that are not `//`, `*` or `/*` returns nothing.

**The round 8 commit record matches the tree.** `1e919b0` is `reviews/REVIEW-R7.md` alone; `8fb764d` is `PROD-READINESS.md` plus `src/storage/backup.ts`; `7528f39` is `LAUNCH-CHECKLIST.md` alone; `48725ba`, `f6716b1` and `464f556` are `PROD-READINESS.md` alone. No status cell in the round 8 table names a commit that landed after it.

**The status stamp names its parent.** `LAUNCH-CHECKLIST.md:21` names `8fb764d`, and `7528f39`, the commit that wrote it, is its child - the floor R7-6 states, met. What R8-9 is about is the sentence beside it, not the stamp.

## What I looked for and did not find

- **No status stamped for absent work.** Every RESOLVED in the round 8 table names a commit whose tree contains the work.
- **No silently weakened test.** Round 8 touches no test file and no executable line; the five R3-5 mutants are unaffected and the falsifiability tables still describe the code in the tree.
- **No storage key added, renamed or reshaped.** The only `src/storage/` change is comments. `mobile/platform/storeIntegrity.ts`'s second MMKV instance is untouched and still outside the nine, the backup and the three key guards.
- **No scope drift and no prohibited action.** Six commits, the review committed alone, no dependency changed, no EAS build started. Every export in the round and in this review is local, and `mobile/dist` was removed afterwards - `git status` is clean.
- **The under-report still cannot become an over-report.** The guard is `<` and `replaced` is still incremented after the write. R8-3's measurement confirms it from the other side: in the silence case the report is empty rather than wrong.
- **FR-1 is untouched and still cannot be settled here.** `LAUNCH-CHECKLIST.md:66-69` and `:197-210` still say the missing-org/project behaviour is inferred from `sentry-xcode.sh` and the vendored CLI, never observed, and the CANNOT ASSESS entry stands. No EAS build was run.
- **P2-8 is still correctly gated.** `LAUNCH-CHECKLIST.md:49` is unticked, `:138` is the RLS instruction naming the four `supabase/` files, and nothing in the tree records a route taken.
- **`review/targets.md:136` and `:144` are still stale and still correctly left alone**, for the reason round 4 gave and with the whole of both files measured in round 7.
