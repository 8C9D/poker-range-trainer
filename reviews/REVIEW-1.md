# REVIEW-1 - adversarial review of Stage 1

Range reviewed: `4551454..598728c`.
Target: the repo at `598728c`, the stage diff, `PROD-READINESS.md`, `reviews/BASELINE.md`, `reviews/REVIEW-0.md`.
Every command below was re-run by the reviewer; no builder narration was available and none was assumed.

## Verdict: REJECT

The code in this stage is the best part of it and should be kept exactly as written.
The P0-1 fix is correct, in scope, traced end to end through the shipping native path, and guarded by a test I proved falsifiable by mutation.
Lint, both suites and both builds are green against `BASELINE.md`, with the mobile count up by exactly the one new test.

The rejection is not about the code.
It is about the artifact the sweep exists to produce: at `598728c` the frozen work list marks **four of four findings RESOLVED while only three have an artifact**.
`P1-1`'s fix does not exist anywhere in the tree, and the ledger's own body text says so on the line below its RESOLVED cell.
A reader trusting the status column ships an App Store build with no source maps, believing that item closed.
Two further ledger claims - the ordering of the RESOLVED column, and DEFERRED `D-1`'s central evidence - do not survive verification either.

Remedy is bounded and does not touch the stage's code: set `P1-1` back to OPEN or land its two lines of documentation, correct `D-1`, re-anchor the stale line citations.

---

## Findings

### F1 | P1 (blocking) | `P1-1` is marked RESOLVED with no artifact anywhere in the repository

**Evidence.**
`PROD-READINESS.md:80` - `| P1-1 | observability | P1 | ... | document `SENTRY_ORG` and `SENTRY_PROJECT` next to `SENTRY_AUTH_TOKEN` | documentation only; zero runtime effect | RESOLVED |`.

```
$ git grep -n "SENTRY_ORG\|SENTRY_PROJECT"
PROD-READINESS.md:80    (the RESOLVED row itself)
PROD-READINESS.md:110   (quoted sentry.properties fallback comment)
PROD-READINESS.md:111   (quoted sentry.properties fallback comment)
PROD-READINESS.md:114   (the finding narrative)
PROD-READINESS.md:164   (CANNOT ASSESS)

$ git log --oneline 21f568b..HEAD -- LAUNCH-CHECKLIST.md .env.example
(no output)

$ git status --short
(no output - nothing staged, nothing dirty, nothing untracked)
```

`LAUNCH-CHECKLIST.md:54` still reads `- [ ] **[Y]** Add \`SENTRY_AUTH_TOKEN\` to EAS secrets for source-map upload - see "Your steps" step 7.` and step 7 (`:180-190`) still documents only `SENTRY_AUTH_TOKEN` and `EXPO_PUBLIC_SENTRY_DSN`.
`mobile/eas.json` has no `env` block on any profile.
`.env.example` documents one variable and neither of these.

The ledger contradicts itself inside a five-line span: `PROD-READINESS.md:114` asserts "`git grep` for `SENTRY_ORG` and `SENTRY_PROJECT` across the tracked tree returns **nothing**", which still reproduces exactly, while `:80` calls the same finding RESOLVED.
The fix is two lines of Markdown, explicitly "documentation only; zero runtime effect", so nothing about it was hard or blocked.

**Why the builder missed it.**
The status column was written as a batch of intentions in `4551454` (see F2), not as a record of completed work.
Once written it was never re-derived from the tree, and the one item that needed no code was the one nothing later forced it to revisit: `P0-1` got a commit that would have failed loudly if skipped, `R0-1` and `R0-5` were prose edits made in the same commit as their own status flags, and `P1-1` fell into the gap between them.

### F2 | P1 (blocking) | The RESOLVED column is predictive, and it was authored inside a commit that sits in a review gap

**Evidence.**

```
$ git show 4551454 --stat
 PROD-READINESS.md   | 49 +++++++++++-----------
 reviews/BASELINE.md | 12 ++++++++++++
 2 files changed, 49 insertions(+), 12 deletions(-)

$ git diff 2c3334f..4551454 -- PROD-READINESS.md   (excerpt)
+| P0-1 | persistence | P0 | ... | RESOLVED |
+| P1-1 | observability | P1 | ... | RESOLVED |
+| R0-1 | ledger integrity | P1 | ... | RESOLVED |
+| R0-5 | baseline provenance | P1 | ... | RESOLVED |

$ git log --oneline 4551454..598728c -- PROD-READINESS.md reviews/
(no output)
```

`P0-1` was stamped RESOLVED in a docs-only commit whose diff touches no code, one commit *before* the fix landed at `598728c`.
The stage that actually did the work then recorded nothing: the ledger and `reviews/` are untouched across `4551454..598728c`.
So the status column never encodes "verified done"; at best it encodes "planned", which is why F1 could persist undetected.

Compounding it: `REVIEW-0.md:3` states its range was `21f568b..2c3334f`, and this stage's diff base is `4551454`.
Commit `4551454` - which introduced the RESOLVED column, rewrote DEFERRED, rewrote NEXT ROUND, and struck one of Review 0's sub-claims - is inside **no** stage diff and was reviewed by nobody until now.
That is a structural hole, not a one-off: every "apply the review corrections" commit will land in the same blind spot.

**Why the builder missed it.**
Applying corrections and declaring them applied felt like one action, so both went into one commit; the same reflex then pre-declared the two items the commit did not touch.

### F3 | P1 | DEFERRED `D-1` asserts something false about the web path, and that assertion is the stated basis for deferring

**Evidence.**
`PROD-READINESS.md:145` - "`mobile/components/BackupPanel.tsx:52-66`: one tap ... `src/screens/AccountScreen.tsx:78` is the same. There is no confirmation step, no ... preview, and no undo."

`src/screens/AccountScreen.tsx:68-83`:

```
  async function handleImportBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (
      !window.confirm('Importing a backup REPLACES all your current local data. Continue?')
    ) {
      return
    }
    try {
      restoreBackup(parseBackup(await file.text()))
```

The web restore path already has a confirmation, with copy that names the consequence in capitals.
Only the mobile path lacks one - `mobile/components/BackupPanel.tsx:52-65` runs `parseBackup` then `restoreBackup(backup)` with no gate.
So `D-1` is not "the product has no confirmation"; it is "the mobile port dropped a confirmation the shared product already ships".

This is load-bearing, not a wording nit, because `PROD-READINESS.md:147` defers the item on exactly that premise: "every available fix (a confirmation dialog, a pre-restore auto-backup, an undo) is a new user-visible capability, which the scope constraint forbids".
A confirmation dialog is not a new capability for this product; it is existing behavior on the other surface.
Whether porting it is in scope is genuinely arguable and I am not ruling on that.
What is not arguable is that the deferral was justified with a fact that the file contradicts, and that `D-1` as written misdirects the next run to design a feature rather than close a parity gap.

**Why the builder missed it.**
The sentence is inherited verbatim from `REVIEW-0.md:151` and was pasted into the ledger without opening `AccountScreen.tsx`.
The builder demonstrably knew better - it treated Review 0's `expo-env.d.ts` claim as a lead and struck it on evidence (`PROD-READINESS.md:84-91`) - but applied that discipline to one inherited claim and not this one.

### F4 | P2 | The stage's own edit invalidated the ledger's `P0-1` line anchors, and the ledger was not updated

**Evidence.**
`PROD-READINESS.md:79` (evidence cell) and `:94` both cite `mobile/platform/localStorageShim.ts:34`; ASSUMPTION 2 at `:138` cites `:31-37`.
After `598728c`, lines 31-41 of that file are the new explanatory comment and line 34 reads `// through to the legacy handler callback; with no handler registered - and`.
The `createMMKV` call is now line 45.
Anyone verifying the sweep's only P0 from the ledger lands on prose.

**Why the builder missed it.**
The stage commit is code-only (F2); nothing in the workflow re-reads the ledger's anchors after a file grows by eleven lines above the cited call site.

### F5 | P2 | The evidence used to strike a Review 0 sub-claim is not reproducible from the tree

**Evidence.**
`PROD-READINESS.md:86-89` quotes:

```
$ cd mobile && npx tsc --noEmit --listFiles | grep expo-env
/Users/<user>/dev/poker-range-trainer/mobile/expo-env.d.ts
```

`mobile/expo-env.d.ts` does not exist at `598728c` (`ls mobile/expo-env.d.ts` -> `No such file or directory`; the ledger says it was generated then deleted), so re-running the quoted command returns nothing at all.
The reviewer receives the repo, not the builder's transient working directory, so the one command offered to overturn a reviewer finding is the one command the reviewer cannot run.

**The conclusion survives.** I verified it by a route that does reproduce - a throwaway project with `"include": ["**/*.ts"]`, one `a.ts` and one `types.d.ts`:

```
$ npx tsc --noEmit --listFiles -p tsconfig.json | grep tsglob
/private/tmp/claude-501/tsglob/a.ts
/private/tmp/claude-501/tsglob/types.d.ts
```

A `**/*.ts` glob does pull `.d.ts` files into the program, so the dropped `include` entry was redundant and the strike is substantively right.
Recorded at P2 because the finding is about reproducibility of the evidence, not about the answer.

### F6 | P2 | Citation slippage in the R0-2 correction

**Evidence.**
`PROD-READINESS.md:51` states "`mobile/app/range/[id].tsx:69` resolves against the live library".
Line 69 is `const { id } = useLocalSearchParams<{ id: string }>();`; the resolution is line 71, `useState<SavedRange | null>(() => findSavedRangeById(id) ?? null)`.
The claim is true, the anchor is two lines off.

### F7 | P2 | `P0-1` is closed without recording what the fix does not fix

**Evidence.**
`mobile/ios/Pods/MMKVCore/Core/MMKV_IO.cpp:347-350` and `:361-366`: on `OnErrorRecover` MMKV sets `loadFromFile = true; needFullWriteback = true` and, on the file-length path, first clamps `m_actualSize = fileSize - Fixed32Size`.
That salvages what it can, which is the improvement claimed - but a partial recovery is still invisible to the user and to Sentry, and the P0 criterion `P0-1` was rated under is "data loss ... silent failure".
The item is marked RESOLVED with nothing appended to NEXT ROUND carrying the residual forward.
`CANNOT ASSESS` (`:165`) records only that the native behavior cannot be exercised here, which is a different gap.

---

## What I verified and could not break

| Claim | Status | How confirmed |
| --- | --- | --- |
| Fix reaches the defect, does not relocate it | **CONFIRMED** | `react-native-mmkv/cpp/HybridMMKV.cpp:260-270` maps `RECOVER_ON_ERROR` -> `MMKVRecoverStrategic::OnErrorRecover`, passed as `.recover` at `:33`; `MMKVCore/Core/MMKV.cpp:116` `m_recoverStrategic = config.recover;`; `MMKV_IO.cpp:346` and `:361` `strategic = m_recoverStrategic.has_value() ? m_recoverStrategic.value() : strategic;` override the default on **both** the CRC and file-length paths. |
| Default really is discard | **CONFIRMED** | `HybridMMKV.cpp:261-263` returns `std::nullopt` when unset; `grep -rn "registerHandler\|MMKVHandler\|g_handler" node_modules/react-native-mmkv/cpp/ node_modules/react-native-mmkv/ios/` returns nothing, so the legacy callback path applies. |
| `'recover-on-error'` is a real value | **CONFIRMED** | `react-native-mmkv/lib/specs/MMKVFactory.nitro.d.ts:20` and `:105`. |
| Pin is tracked and exact (R0-1 re-anchor) | **CONFIRMED** | `NitroMmkv.podspec:27` `s.dependency 'MMKVCore', '2.4.0'`; `mobile/package-lock.json` resolves `react-native-mmkv@4.3.2`; installed version is 4.3.2. |
| One MMKV instance only | **CONFIRMED** | `grep -rn createMMKV` over `app components platform theme __tests__ __mocks__` -> one call site, `platform/localStorageShim.ts:45`. |
| The new test is not decorative | **CONFIRMED BY MUTATION** | I remapped the shim import to a byte-identical copy that omits `recoveryStrategy` and re-ran the file. It fails, with the precise diff: `- "recoveryStrategy": "recover-on-error",` at `__tests__/storage-shim.test.ts:94`. `Tests: 1 failed, 5 passed`. Restoring the real shim, it passes. The `jest.requireMock` wiring is also proven by the pass: an auto-mocked copy would return `undefined` and fail. |
| Baseline comparison | **CONFIRMED, no regression** | `npm run lint` -> `LINT_EXIT=0`. `npm run test:run` -> web `Test Files 79 passed / Tests 1179 passed`, mobile `Test Suites: 34 passed / Tests: 215 passed`, `TEST_EXIT=0` - baseline was 214, the +1 is precisely the new guard. `npm run build` -> vite clean, `mobile typecheck` clean, `BUILD_EXIT=0`. Matches `BASELINE.md:30-32`. |
| No feature smuggled in | **CONFIRMED** | `recoveryStrategy` is an option on an existing call to an existing dependency; no new screen, route, flag, key, table or endpoint. `__lastConfiguration` is a test-only export added to an existing Jest manual mock, which is what `REVIEW-0` R0-8 asked for. |
| No prohibited action | **CONFIRMED** | Stage diff is 3 files, +61/-3, none of them CI, deploy, infra, dependency or lockfile. No deletions (`git diff --diff-filter=D` empty). No history rewrite (reflog is linear, `HEAD@{0}` a plain commit). Tag `pre-trim-full-featureset` intact. `origin/main` still `f888078`, unmoved; the work branch has no upstream, so nothing was pushed. No non-local connection was needed or made. |
| Error handling not weakened | **CONFIRMED** | The diff adds no `catch`, swallows nothing, and changes no control flow; `getStore()` is unchanged except for one added option. |
| Typo protection on the new option | **CONFIRMED** | The mock types `recoveryStrategy?: string` loosely, but the shim is typed against the real package (`import { createMMKV } from 'react-native-mmkv'`), and `mobile typecheck` runs against real types, so a misspelled literal fails the build rather than silently passing the test. |
| R0-3 dependency paths (corrected in the ledger) | **CONFIRMED** | `npm ls image-size --omit=dev --all` and `npm ls uuid --omit=dev --all` reproduce the ledger's two chains character for character. |
| R0-2 deep-link validation citations | **CONFIRMED** | `mobile/app/practice.tsx:75` `asMode`, `:80` `handList`, `:108` `parsePools`; `findSavedRangeById` drops unknown ids. |

## Checks run that produced nothing

- **Fabricated findings in the stage** - none. Every technical claim in the stage's code comment reproduces against the installed package and the local pod tree.
- **Severity inflation** - none found. `P0-1` remains rated on consequence with the likelihood argument stated honestly.
- **Severity deflation** - one candidate, F3, and I have rated the ledger defect rather than re-rating `D-1` itself, since the scope question there is genuinely open.
- **Verification that does not exercise the changed path** - the opposite; the mutation run proves it does.
- **Fixes that relocate a bug** - no. The override is consumed at the two decision sites, not moved elsewhere.
- **Commit hygiene** - `598728c` is a single-sentence message with no AI attribution trailer.
