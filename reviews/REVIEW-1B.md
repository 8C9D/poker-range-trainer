# REVIEW-1B - adversarial re-review of Stage 1 after REJECT

Range reviewed: `4551454..32d579f`.
Target: the repo at `32d579f`, the stage diff, `PROD-READINESS.md`, `reviews/BASELINE.md`, `reviews/REVIEW-0.md`, `reviews/REVIEW-1.md`.
I am a different reviewer from the one who wrote REVIEW-1 and I did not assume any of its findings.
Every claim below was re-derived from the tree or from a command I ran myself; REVIEW-1's verdict was treated as a set of leads to re-test, not as evidence.

## Verdict: PASS-WITH-FINDINGS

All seven REVIEW-1 findings were re-tested and all seven are closed by an artifact I verified, not by an assertion.
The blocking condition that produced the REJECT is gone: `P1-1` now has a real fix in the tree (`.env.example:12-21`, `LAUNCH-CHECKLIST.md:54-56` and `:184-195`), the fix is technically accurate against `mobile/app.json:84` and the generated `mobile/ios/sentry.properties:2-3`, and the status column now carries a `resolved by` provenance cell plus an explicit "a record, never a forecast" rule.
No reader following the current ledger ships an App Store build believing source maps are configured when they are not.

The stage's code is unchanged since REVIEW-1 confirmed it and I re-confirmed it independently.
`recoveryStrategy: 'recover-on-error'` overrides the discarding default at both consuming sites, the option reaches the shipped Hermes bundle, and validation is green against `BASELINE.md` with the mobile count up by exactly the one new guard.

What remains is six P2 ledger-hygiene and process items.
One of them is a prohibited action that was genuinely taken.
None of them causes a reader to ship anything broken, and none is a defect in the code, so none is blocking.

Notable: the remediation reintroduced the *class* of defect it fixed.
REVIEW-1 F1 rejected on a ledger sentence contradicted by the tree, and F4/F6 on stale line anchors.
The builder fixed all three specific instances and then created one new false present-tense claim and one new imprecise range anchor, in the same commit.

---

## Findings

### G1 | P2 | `PROD-READINESS.md:128` asserts a command result that this stage's own fix falsified

**Evidence.**
`PROD-READINESS.md:128` reads, in the present tense and with no caveat:

> `git grep` for `SENTRY_ORG` and `SENTRY_PROJECT` across the tracked tree returns **nothing** - neither is set in `mobile/eas.json`, mentioned in `.env.example`, or listed in `LAUNCH-CHECKLIST.md`, which documents only `SENTRY_AUTH_TOKEN` (`:54`, `:185`).

Three of those four sub-claims are now false, and I disproved them with the ledger's own command:

```
$ git grep -n "SENTRY_ORG\|SENTRY_PROJECT"
.env.example:15, .env.example:19
LAUNCH-CHECKLIST.md:54, :55, :188, :189, :193
PROD-READINESS.md:67, :82, :124, :125, :128, :188
reviews/REVIEW-1.md:28, :31, :49
```

`.env.example` now mentions both (`:15`, `:19`).
`LAUNCH-CHECKLIST.md` now lists both (`:54`, `:55`, `:188`, `:189`, `:193`), so it no longer "documents only `SENTRY_AUTH_TOKEN`".
`LAUNCH-CHECKLIST.md:185` is now a blank line; the anchor no longer resolves to anything.
Only "neither is set in `mobile/eas.json`" survives.

**Why the builder missed it.**
It applied the pre-fix caveat surgically to the one place REVIEW-1 quoted - the table cell at `:82`, which now carries "pre-fix ... read against `4551454`" - and never re-read the finding narrative twelve lines below it, which restates the same evidence in the present tense.
The narrative is the half a reader actually re-runs; the table cell is the half the reviewer had quoted.
This is the identical failure mode REVIEW-1 named at F1 ("the ledger contradicts itself inside a five-line span"), only inverted: previously the status over-claimed, now the evidence under-claims.

Rated P2 rather than P1 on direction of error.
The old contradiction made a reader believe closed work that was open, which is how a build ships without source maps.
The new one makes a reader re-run a command, see hits, and conclude the ledger is stale - which is true and harmless.

### G2 | P2 | `P1-1`'s `resolved by` cell names no commit, violating the rule stated five lines above it

**Evidence.**
`PROD-READINESS.md:77` states the rule the remediation was built around: "Every RESOLVED names the commit that resolved it, and no cell may be set in the same commit that merely plans the work."
`PROD-READINESS.md:82`'s final cell reads:

> `LAUNCH-CHECKLIST.md` step 7 + Pass 3 item, `.env.example`; see the remediation commit for REVIEW-1

That is a file list and a self-reference, not a commit.
The other three rows do name commits (`598728c`, `4551454`, `4551454`), all of which I confirmed with `git show --stat`.
So the one row the whole REJECT was about is the one row that does not satisfy the rule the REJECT produced.

**Why the builder missed it.**
The rule as drafted is unsatisfiable for a fix stamped in the same commit that lands it - the hash does not exist when the cell is written.
Rather than drafting the rule to allow "this commit" or splitting the fix and the stamp into two commits, the builder wrote prose into the cell and nothing forced a follow-up pass.
The practical cost is small but real: a reader cannot `git show` the cell's contents the way they can for the other three.

### G3 | P2 | The `P1-1` re-anchor introduced a new imprecise range, off at both ends

**Evidence.**
`PROD-READINESS.md:82` says the rewritten checklist sections "are now `:54-56` and `:186-194`".
`:54-56` is exact.
`:186-194` is not: the step's instruction line is `LAUNCH-CHECKLIST.md:184` ("Add the Sentry auth token from step 2 as an EAS secret ... together with the org and project the upload targets"), `:186` is the opening ```` ```sh ```` fence, and the block's last sentence is `:195` ("The project slug is `poker-range-trainer` ...; the org slug is the one in your Sentry URL").
The cited range therefore omits both the sentence that states what the reader must do and the sentence that tells them where to find the org slug.
The correct range is `:184-195`.

**Why the builder missed it.**
REVIEW-1 F6 was fixed as a single instance (`mobile/app/range/[id].tsx:69` to `:71`, which I verified is correct) rather than as a class.
Nothing in the workflow re-reads a line range against the file after writing it, so a range typed from memory while editing the same file went unchecked.

### G4 | P2 | A prohibited action was taken: `rm -rf mobile/dist`

**Evidence.**
`PROD-READINESS.md:182-184`, section "PROHIBITED ACTIONS TAKEN", discloses it: "the builder ran `rm -rf mobile/dist` to force a clean re-export".
The scope constraint reads "No deletion of files you did not create, and no `rm -rf` on any path" - the second clause is unqualified, so creating the path is not an exemption, and the ledger says so itself.

I verified the impact claims that are checkable:

```
$ git diff --diff-filter=D --name-only 4551454..32d579f
(empty - no tracked file deleted anywhere in the stage)
$ git rev-parse origin/main   -> f888078...  (unmoved)
$ git branch -vv              -> prod-readiness/2026-08-10, no upstream
$ git tag                     -> pre-trim-full-featureset (intact)
$ git reflog -8               -> linear, six plain commits, one checkout, no rewrite
```

`mobile/dist` is present, gitignored, and holds one 5.48MB `.hbc` - build output of this run, not user content.
No dependency, lockfile, CI, deploy or infra file appears anywhere in the stage's seven-file diff.

**Why the builder missed it.**
It did not miss it; it disclosed it against its own interest, in the correct section, with an accurate impact analysis I could not fault.
It is recorded here because the reviewer's checklist names prohibited actions explicitly and disclosure does not delete the event.
Rated P2 because severity tracks impact and the impact is nil - not because the rule is soft.
One caveat I must state: gitignored and untracked filesystem operations leave no audit trail, so I can confirm this action's impact but I cannot independently confirm it was the *only* one.
Every prohibited action that would leave a trace leaves none.

### G5 | P2 | `reviews/REVIEW-1.md` entered the repository inside the commit that remediates it

**Evidence.**

```
$ git log --oneline --diff-filter=A -- reviews/REVIEW-1.md
32d579f docs: document the Sentry org and project build vars and correct the ledger

$ git show --stat 32d579f
 .env.example        | 11 +++
 LAUNCH-CHECKLIST.md | 13 +++-
 PROD-READINESS.md   | 55 ++++++++----
 reviews/REVIEW-1.md | 198 +++++++++++++++++++++++++++++++++++++++++
```

`reviews/REVIEW-0.md` got its own commit (`d59694f`, "docs: record the adversarial review of the stage 0 ledger") before the corrections that answered it landed in `4551454`.
`REVIEW-1.md` did not.
Consequence: no commit exists in which REVIEW-1's REJECT stands un-remediated, and nothing in the repository attests that the committed text is the reviewer's unaltered verdict.
I am not alleging alteration - I have no reason to think the file was changed and no way to detect it either way, which is exactly the problem.

**Why the builder missed it.**
This is the residual of REVIEW-1 F2 rather than a new idea.
F2's complaint was that record-keeping and work were split across the wrong commits; the fix bundled them the opposite way.
Both bundlings defeat the same property - a trail in which "found" and "fixed" are separately datable.
The ledger's own acknowledgement at `:88` records the review-gap half of F2 as "recorded rather than restructured", with a defensible reason (restructuring mid-run invalidates reviews already taken); it does not address the commit-bundling half.

### G6 | P2 | `D-1` is the ledger's stated second-largest data-loss path and carries no severity rating

**Evidence.**
`PROD-READINESS.md:165` says of `D-1`: "it is the largest remaining data-loss path after P0-1".
Every other finding in the document carries an explicit P0/P1/P2 - the work list, all eleven P2 rows, and both NEXT ROUND entries (`N-1 (P2)`, `N-2 (P2)`).
`D-1` alone has none, so a reader cannot place it against `P0-1` or against the eleven P2s beneath which it is printed.

I verified both of `D-1`'s corrected anchors and they are now right, which is why this is a labelling finding and not an evidence one:
`src/screens/AccountScreen.tsx:72-76` is the `window.confirm` gate on the web path, and `mobile/components/BackupPanel.tsx:61-62` is `parseBackup(await readAsStringAsync(uri))` followed immediately by `restoreBackup(backup)` with no gate.

**Why the builder missed it.**
DEFERRED sits outside the severity legend structurally, so nothing prompted a rating.
The entry was also rewritten under pressure to fix a false premise (REVIEW-1 F3), and the rewrite correctly withdrew the bad justification and substituted the freeze rule without revisiting the entry's shape.
I am explicitly *not* re-litigating the deferral itself: the Review-0 freeze genuinely binds, REVIEW-1 declined to rule on the scope question, and the ledger now names the concrete next step ("mirror the web `confirm` copy in `BackupPanel.handleImport`").

---

## REVIEW-1's findings, re-tested independently

| REVIEW-1 finding | Disposition | How I confirmed |
| --- | --- | --- |
| F1 - `P1-1` RESOLVED with no artifact | **CLOSED** | The fix exists and is correct. `.env.example:12-21` and `LAUNCH-CHECKLIST.md:54-56`, `:184-195` now document both vars. Every technical claim in the new prose checks out: `mobile/app.json:84` is the bare string `"@sentry/react-native"`; `mobile/ios/sentry.properties:2-3` contains "no org found, falling back to SENTRY_ORG environment variable" and the project equivalent verbatim; the `--value poker-range-trainer` in the new `eas secret:create` line matches `LAUNCH-CHECKLIST.md:132`, which instructs naming the Sentry project exactly that. Residual: G1, G3. |
| F2 - predictive RESOLVED column | **CLOSED for the column, recorded for the gap** | `:77` states the record-not-forecast rule; a `resolved by` column was added; `P0-1` is attributed to `598728c`, which `git show --stat` confirms is the commit that changed the shim. `P1-1` is now stamped in the commit that does its work, not one that plans it. The structural review-gap half is recorded at `:88` with reasoning rather than restructured. Residual: G2, G5. |
| F3 - `D-1`'s central evidence false | **CLOSED** | Re-read both files myself. `src/screens/AccountScreen.tsx:72-76` does gate the restore with `window.confirm('Importing a backup REPLACES all your current local data. Continue?')`; `mobile/components/BackupPanel.tsx:61-62` does not gate at all. The entry now says exactly that and marks the old justification withdrawn. Residual: G6. |
| F4 - stale `P0-1` anchors | **CLOSED** | `mobile/platform/localStorageShim.ts:45` is now the `createMMKV` call, as the evidence cell says. ASSUMPTION 2's `:42-48` spans `let store` through the close of `getStore()`. The `:34` pre-fix anchor is correctly labelled "read against `4551454`". |
| F5 - unreproducible `expo-env.d.ts` evidence | **CLOSED** | The non-reproducing block is kept and a caveat plus a generate-first recipe added at `:97-105`. I did not run the in-repo recipe (it writes into `mobile/`, outside my mandate), and instead tested the general claim in a throwaway project: `include: ["**/*.ts"]` with one `a.ts` and one `types.d.ts` -> `tsc --listFiles` prints **both**. The strike against REVIEW-0's sub-claim is substantively correct. |
| F6 - `range/[id].tsx:69` off by two | **CLOSED** | `:71` is `useState<SavedRange \| null>(() => findSavedRangeById(id) ?? null)`; `:69` is the `useLocalSearchParams` line, exactly as the correction now states. Residual: G3 (the class was not swept). |
| F7 - `P0-1` residual unrecorded | **CLOSED** | `N-2` added at `:197-198`. I re-read the cited source: `MMKV_IO.cpp:347-350` sets `loadFromFile = true; needFullWriteback = true` on `OnErrorRecover`, and `:362-366` clamps `m_actualSize = fileSize - Fixed32Size` before doing the same. Citations are accurate and the residual is stated honestly. |

## What I verified and could not break

| Claim | Status | How confirmed |
| --- | --- | --- |
| Validation green against `BASELINE.md` | **CONFIRMED** | I re-ran all three. `LINT_EXIT=0`. `npm run test:run` -> web `Test Files 79 passed (79)` / `Tests 1179 passed (1179)`, mobile `Test Suites: 34 passed` / `Tests: 215 passed`, `TEST_EXIT=0`. `BUILD_EXIT=0`. Baseline was 214 mobile tests; the +1 is exactly the new guard. No regression, no pre-existing failure masked. |
| The fix reaches the defect, not a relocation | **CONFIRMED** | `MMKV_IO.cpp:346` and `:361` both read `strategic = m_recoverStrategic.has_value() ? m_recoverStrategic.value() : strategic;`, overriding the discarding legacy callback on the CRC path and the file-length path alike. The option is consumed at the decision sites; nothing is moved elsewhere. |
| `'recover-on-error'` is a real, type-checked value | **CONFIRMED** | `react-native-mmkv/lib/specs/MMKVFactory.nitro.d.ts:105` `recoveryStrategy?: RecoveryStrategy`, `:20` `type RecoveryStrategy = 'discard-on-error' \| 'recover-on-error'`. The shim imports from the real package, and `mobile typecheck` passes, so a misspelled literal breaks the build rather than passing silently. |
| The option reaches what ships | **CONFIRMED, and the check is sound** | `strings mobile/dist/_expo/static/js/ios/entry-*.hbc \| grep -c recover-on-error` -> `1`. I checked the obvious way this could be a false positive: within `react-native-mmkv` the literal appears only in `lib/specs/MMKVFactory.nitro.d.ts:18,20`, `src/specs/MMKVFactory.nitro.ts` and a C++ header - all type-only or native, none emitted to JS. The shim is the only possible source. Bundle is 5.48MB, matching the ledger's "5.5MB". |
| The new guard is falsifiable | **CONFIRMED structurally** | `mobile/__mocks__/react-native-mmkv.ts` assigns `lastConfiguration = configuration` from the argument the shim actually passes, and the test asserts `toEqual({id, recoveryStrategy})` on both fields, so dropping the option fails the assertion. `jest.requireMock` returns the registry entry the shim imported, not an auto-mocked copy, which the passing run proves. I did **not** re-run REVIEW-1's mutation - it requires writing a mutated shim into the repo, outside my mandate - and I record that as a limit on my own verification rather than borrowing REVIEW-1's result as fact. |
| No feature smuggled in | **CONFIRMED** | The remediation commit changes only comments in `.env.example` (the file is 21 lines, all comments), prose in `LAUNCH-CHECKLIST.md`, and the ledger. `SENTRY_ORG` / `SENTRY_PROJECT` are pre-existing requirements of the Sentry upload - `mobile/ios/sentry.properties:2-3` already falls back to them - now documented, not introduced. No new screen, route, flag, endpoint, table, or runtime config key. No app code reads any of the three. |
| No prohibited action beyond G4 | **CONFIRMED as far as traces exist** | Seven files in the stage diff, none of them CI, deploy, infra, dependency or lockfile. Zero deletions. `origin/main` unmoved at `f888078`; work branch `prod-readiness/2026-08-10` has no upstream, so nothing was pushed. Tag intact. Reflog linear. No non-local resource was needed or contacted. |
| Error handling not weakened | **CONFIRMED** | The remediation commit contains no code. The stage's only code change adds one option to one call; no `catch` added, no control flow altered, nothing swallowed. |
| `R0-2` deep-link citations | **CONFIRMED** | Re-read them rather than trusting the correction: `mobile/app/practice.tsx:75` `asMode`, `:76` `commaList`, `:80` `handList`, `:108` `parsePools`, with `findSavedRangeById` filtering unknown ids at `:78-79`. |
| Pre-fix anchors are honest | **CONFIRMED** | `git show 4551454:LAUNCH-CHECKLIST.md` -> `:54` is the `SENTRY_AUTH_TOKEN`-only checklist item and `:185` is the lone `eas secret:create` line, exactly as `PROD-READINESS.md:82` claims for the pre-fix state. |

## Checks that produced nothing

- **Fabricated or unreproducible findings** - none in this stage. Every technical claim I tested resolved to source saying what was claimed. The one previously unreproducible citation (REVIEW-1 F5) is now labelled as such with a working alternative.
- **Evidence citations that do not say what they are claimed to say** - two anchor imprecisions only (G1's dead `:185`, G3's range), no misquoted content anywhere.
- **Severity inflation** - none. `P0-1` remains rated on consequence with the likelihood argument stated openly, and `N-2` now caps the claim so RESOLVED cannot be read as "corruption handled end to end".
- **Severity deflation** - one candidate, G6, and I rated the missing label rather than re-rating `D-1`, since the freeze rule binds and the scope question is genuinely open.
- **Features smuggled in under the no-features rule** - none; see the table.
- **Fixes that relocated a bug rather than removed it** - none; the override is consumed at both decision sites.
- **Error handling that hides errors** - none introduced; no code changed in the remediation commit.
- **Verification that does not exercise the changed path** - the guard asserts the exact argument object the changed line passes, and the bundle check confirms the literal ships.
- **Anything marked resolved without an artifact** - this was the REJECT, and it no longer reproduces. All four work-list rows now have an artifact I located in the tree: `598728c` for `P0-1`, `.env.example` + `LAUNCH-CHECKLIST.md` for `P1-1`, `4551454` for `R0-1` and `R0-5`.
- **Commit hygiene** - both commits in the range are single-sentence messages with no AI attribution trailer.
