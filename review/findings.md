# Phase 2/3 - Findings

Baseline: `npx vitest run` is green at 134 files / 1770 tests before and after this review. Every
finding below is a gap in a passing suite. Each confirmed trigger was executed, not reasoned about;
the verification method is stated per finding.

**Kill rate: 9 of 18 Phase-2 candidates died in Phase 3 (50%).**

---

## Confirmed

### 1. A crafted share link blanks the viewer's whole app, on both platforms

`src/domain/rangeTransfer.ts:322` · `src/components/SharedRangePage.tsx:113` ·
`src/components/SharedPackPage.tsx:116,158` · `mobile/app/r/[id].tsx:103` ·
`mobile/app/p/[id].tsx:111`

**Trigger.** `shared_ranges.data` / `shared_packs.data` are `jsonb`; the RLS insert policy
(`supabase/migrations/0003_shared_ranges.sql`, `0004_shared_packs.sql`) constrains only
`owner_id = auth.uid()`. Any signed-up user can therefore insert a row whose payload is arbitrary
JSON and send the link. Two payloads suffice:

- range: `{id:"x", name:"Perfectly ordinary range", hands:["AA","KK","AKs"], createdAt:<iso>,
  updatedAt:<iso>, comboSelections:{AA: 5}}`
- pack: `{kind:"poker-range-pack", version:1, name:{…any object…}, ranges:[<a valid range>]}`

**Observable wrong behavior.** Verified by rendering both pages with those payloads through the
components' own injectable `fetchSharedRange` / `fetchSharedPack`:

- range page → `TypeError: number 5 is not iterable` from `selectionForRange`
  (`src/domain/comboSelection.ts:75`), thrown during render;
- pack page → `Error: Objects are not valid as a React child (found: object with keys {toString})`
  from the `<h1>`.

In both cases the subtree unmounts to an empty DOM. In the shipped app the root boundary
(`src/main.tsx:12`) then replaces the *entire* application with "Something went wrong" and the raw
TypeScript error text. The pages have a purpose-built `not-found` branch for a payload they cannot
read; it is never reached.

**Why the code permits it.** `isValidSavedRange` checks 5 of the ~12 fields of `SavedRange` - `id`,
`name`, `hands`, `createdAt`, `updatedAt` - and nothing checks `RangePack.name`, `.kind`, or
`.version` at all. Both call sites carry a comment asserting the opposite ("A shared range's data is
publisher-controlled, so it gets the same full structural check as an imported file"). The comment
is what the reviewer reads; the field list is what runs. Nothing mechanically ties the checked
fields to the fields the pages then read (`comboSelections` via `countRangeCombos` /
`rangeComboPercentage`, `handActions` via `ActionGrid`, `pack.name` into JSX). The *fork* path is
safe - `saveSavedRanges` re-normalizes - so only the render path is exposed, which is why it
survived: the dangerous path is the one that looks read-only.

**Note on mobile.** `mobile/app/r/[id].tsx:103` makes the identical `rangeComboPercentage` call and
`mobile/app/p/[id].tsx:111` renders `{pack.name || 'Untitled pack'}` inside `<Text>`, which throws
the same React child error under the RN renderer. Same defect, ported.

### 2. A malformed percent-escape in the hash throws during render and locks the app

`src/app/routes.ts:35`

**Trigger.** Any hash of the form `#/library/<bad-escape>` - verified with `#/library/%`,
`#/library/a%b/edit`, and `#/library/%E0%A4%A`. All three raise `URIError: URI malformed` out of
`parseAppRoute`.

**Observable wrong behavior.** `parseAppRoute` runs inside `useHashRoute`
(`src/app/routes.ts:87-90`), which runs during `CoachApp`'s render, so the throw is a render throw.
The root `ErrorBoundary` shows "Something went wrong / URI malformed", and its "Try again" button
(`src/components/ErrorBoundary.tsx:55`) cannot recover: `reset()` re-renders, which re-reads the
same hash, which throws again. The user is stuck until they hand-edit the URL. `App`'s two earlier
share-route checks both return `null` for this hash, so there is no upstream guard.

**Why the code permits it.** `src/domain/shareRoute.ts:19-25` wraps exactly this call in
`safeDecode`, with a comment naming exactly this failure: *"A hash like `#/r/%` would otherwise
throw during App render, blanking the whole app."* The lesson was learned in one of two sibling
parsers of the same string and never carried to the other. `routes.test.ts:64` covers
`#/library/a%20b` - the well-formed case - which is what makes the gap read as covered.

### 3. The service worker returns a failed HTTP response instead of the copy it has cached

`public/service-worker.js:45-66`

**Trigger.** The worker has cached `/assets/PracticeHost-<hash>.js`. A redeploy removes that hashed
file from the server. The user - **online** - taps "Start review". Verified by evaluating the
shipped `public/service-worker.js` against a stub whose `fetch` resolves
`{ok:false, status:404, type:'basic'}` and whose cache contains that exact asset: the handler
returns the 404 object. The cache is never consulted.

**Observable wrong behavior.** The `import()` at `src/App.tsx:16` rejects (HTML body where a module
was expected, or a 404). `SessionChunk`'s boundary (`src/App.tsx:232`) renders *"This part of the
app has not been downloaded yet, and it could not be fetched just now. Reconnect and reload to
finish the download"* - to a user who is connected, and whose browser is holding the file. Reloading
does not help either, because the fetch will 404 again; only a hard cache purge or a new tab
picking up the new `index.html` does.

**Why the code permits it.** "The network cannot supply this" is implemented as `.catch()`, which
only fires on transport failure. An HTTP 404/500 is a *resolved* promise, so control never reaches
the cache-fallback branch - it falls through `if (response.ok && response.type === 'basic')`
(skipping the cache write, correctly) and returns the failure verbatim. `src/serviceWorker.test.ts`
has five cases covering offline navigation, offline uncached asset, offline cached asset, online
caching, and cross-origin passthrough - and not one with `ok: false`. The strategy is described in
the file header as "network-first, falling back to cache when offline", and "when offline" is
precisely the narrower thing it implements.

### 4. `handActions` is the one per-hand overlay never scoped to the range's hands

`src/storage/rangeStorage.ts:88-98` (vs. `:113`, `:138`, `:163`) ·
`src/screens/RangeEditTab.tsx:261-279`

**Trigger.** Verified through `normalizeSavedRanges`. Save a range with `hands: ['AA','KK']`, then
open the Actions tab and paint an action onto `QQ` - `ActionGrid` renders all 169 cells
(`src/components/ActionGrid.tsx:46`), so this is the ordinary interaction, not an edge case. Storage
keeps `hands: ['AA','KK']` **and** `handActions: {AA:'raise', QQ:'threeBet'}`. The same state also
arises by deselecting a previously-assigned hand on the Edit tab.

**Observable wrong behavior.** Three consumers then disagree about `QQ`, all verified:

- `assignedHands` (`src/domain/actionRange.ts:39`) puts `QQ` in the action quiz's prompt pool and
  `correctActionFor` grades it as `threeBet`;
- `RecognitionDrill` grades `QQ` against `range.hands` and marks answering "play" a **miss**;
- `formatRangeSvg` (`src/domain/rangeTransfer.ts:204-211`) paints the `QQ` cell in the 3-bet colour,
  so the exported image shows a hand the Overview's "2 hands · 10 combos" line excludes.

Two drills on the same chart therefore return opposite correct answers for the same hand, and both
record against the same range id.

**Why the code permits it.** `normalizeComboSelections`, `normalizeMixedStrategies` and
`normalizeHandNotes` all take a `rangeHands` set and drop entries outside it. `normalizeHandActions`
takes no such parameter. `RangeEditTab.handleSave` mirrors that split: it explicitly prunes notes,
mixed strategies and combo selections, with the rationale *"a mixed strategy or combo selection for
a hand that left the range is unreachable in its editor … yet would still drive the frequency quiz
and the grids"* - reasoning that applies verbatim to `handActions`, which is simply absent from the
list. The one difference (the action grid *is* reachable for all 169 hands) explains why pruning
was skipped but not why the quiz and the export treat the overlay as membership.

*Stated honestly:* `SavedRange`'s own doc says `hands` and `handActions` "may coexist", so the
storage shape is intended. What is not intended, and not documented anywhere, is that the coexistence
makes the action quiz and the recognition drill contradict each other.

### 5. Closing a workout drill on its final answer continues the workout instead of leaving it

`src/practice/WorkoutHost.tsx:193,218` · `src/practice/RecognitionDrill.tsx:214` ·
`src/practice/SpotDrill.tsx:203`

**Trigger.** In a daily workout's review segment, answer the segment's last question **incorrectly**
(so `holdsForAcknowledgement` keeps the feedback up indefinitely - `drillPacing.ts:30`), then press
the overlay's close control instead of "Next".

**Observable wrong behavior.** `OverlayFrame`'s `onClose` calls `finish(attemptsRef.current)`, which
hands `WorkoutHost` exactly `segment.questionsPerRange` attempts. `finishReviewRange` decides
"did the user quit?" with `attempts.length < segment.questionsPerRange`, which is now false, so it
calls `advance()` - starting the next range or the next segment. Pressing close starts another
drill. On the final segment it goes further and calls `showSummary(true)`, which writes
`recordWorkoutCompletion` and marks the day's workout done. The same shape exists for spot segments
at `:218`. By contrast the standalone `PracticeHost` treats the identical close as "end the run and
show the summary" (`src/practice/PracticeHost.tsx:181-211`), so the button means two different
things in two hosts.

**Why the code permits it.** "The drill ran to completion" and "the user closed the overlay" arrive
through one callback with one payload, and only the attempt count separates them - a count that is
equal in exactly the state where the distinction matters. Nothing carries the *reason* the drill
ended.

---

## Killed

Nine Phase-2 candidates did not survive re-checking.

| Candidate | Why it died |
|---|---|
| `ranges.id` is a **global** primary key (`0001_ranges.sql`), so `pushRanges`' untargeted `upsert` could collide across users | **Unreachable.** `grep` over `src/` and `mobile/` shows `pushRanges`/`pullRanges` are imported by nothing but `rangesRepo.test.ts`; the only live import from that module anywhere is `NotSignedInError`. Cloud sync goes through `backupRepo` (`backups`, PK `user_id`), which is correctly single-row-per-user. No constructible trigger. |
| `pullRanges` returns `row.data` cast straight to `SavedRange` with no validation, unlike `pullBackup` which validates | Same reason - dead path. Real asymmetry, zero blast radius today. |
| `isReviewDue` buckets by local **calendar day** while `suggestFreePractice` compares **instants**, so "due" means two things | **Upstream check already prevents divergence.** `TodayScreen.tsx:107` only computes `freePractice` when `due.length === 0`, i.e. when every scheduled range's `dueAt` falls on a strictly later local day than today - which necessarily makes its instant strictly greater than `now` too. The two rules cannot disagree in the only composition that exists. Latent, not live. |
| `ProgressScreen.tsx:86` filters `spotLeaks` **after** ranking, two lines below a comment warning that scoping must happen before ranking or an orphan will spend a capped slot | **Trigger cannot reach the state.** `rankSpotLeaks` (`spotLeaks.ts:29`) returns *all* qualifying leaks - it has no cap. The `.slice(0, 5)` happens at render (`:337`), after the filter. The comment's hazard is real for `rankWeakHands` (limit 10), which *is* correctly pre-scoped. |
| A stale undo offer could re-insert a deleted range into a library replaced by a backup restore | **Trigger cannot reach the state.** The Library consumes `pendingUndo` on mount and clears it in an effect (`LibraryScreen.tsx:107-108`); a Library-initiated delete never calls `rememberDeletedRanges` at all and lives only in component state. Reaching the Account screen unmounts the Library and destroys the offer. |
| `ActionQuiz.nextHand()` calls `getRandomHandFrom(pool)` with no empty-pool guard, unlike the guarded initializer at `:63`; an empty pool yields `pool[-1]` → `undefined` | **Upstream check prevents it.** `ModePicker.tsx:35` only offers the action mode when `assignedHands(range.handActions).length > 0`, and the only other source of `handPool` is `missedActionHandsOf`, which returns `null` rather than `[]`. |
| A lone surrogate in a range name breaks `encodeRangeToHash` (`encodeURIComponent` throws `URIError` on unpaired surrogates) | **Upstream transform prevents it.** `serializeRangeExport` runs `JSON.stringify` first, which since ES2019 emits well-formed output - a lone surrogate leaves as the seven ASCII characters `\ud800`. Verified: `encodeURIComponent(JSON.stringify({name:"\uD800bad"}))` succeeds. |
| The MMKV `localStorage` shim calls `remove()` / `.length`, which the mock provides but the real v4 native module might not - a device-only failure invisible to Jest | **Read the shipped spec.** `mobile/node_modules/react-native-mmkv/src/specs/MMKV.nitro.ts` declares `remove(key): boolean`, `readonly length: number`, `clearAll()`, `getAllKeys()`, `set`, `getString`. `mobile/__mocks__/react-native-mmkv.ts` matches it exactly. |
| `restoreBackup` bypasses `writeJson`, so a quota failure surfaces a raw `QuotaExceededError` instead of the app's actionable message | **The "wrong behavior" isn't wrong enough to be a defect.** The raw DOM message names the key and the quota, `AccountScreen.handleImportBackup` alerts it, and the hand-rolled rollback at `backup.ts:244-249` does restore the snapshot. Inconsistent with the rest of the storage layer; not a failure. |

---

## Suspicions

Real-looking, but with no trigger I could construct. Each states exactly what would settle it.

**S1 - `starterRangesMissingFrom` de-duplicates by name, so a renamed starter chart is re-added.**
`src/domain/starterRanges.ts:112` matches templates against `range.name` (trimmed, lowercased). Its
doc claims safety for "a chart the user already has (even renamed-then-re-added, or edited beyond
recognition)". Renaming a starter chart removes the only thing the check looks at, so Account's
"Add starter ranges" would hand the user a second copy of the same chart under the template name.
*Confirm or kill by:* rename one starter range, press "Add starter ranges" on Account, and check
whether ten charts result. If it does duplicate, the doc-comment is the finding.

**S2 - `workout.v1` is the one storage key outside the backup.** `backup.ts:225-238` writes eight
keys; `statsReset.ts:23-31` clears seven *including* `WORKOUT_STORAGE_KEY`; `AccountScreen.tsx:350`
says "Backups include everything". Restoring a backup taken before today's workout leaves the "done
for today" flag set while the restored history shows zero hands today. *Confirm or kill by:*
deciding whether the flag is data (must round-trip) or device state (must not). If it is data, the
three hand-maintained key lists want one shared constant.

**S3 - "Push to cloud" has no confirmation; "Pull from cloud" does.**
`AccountScreen.tsx:40-48` vs `:50-70`. `pushBackup` is an unconditional `upsert` on the single
`backups` row with no version check and a client-supplied `updated_at` that is never read back
(`backupRepo.ts:41-49`), so a stale device silently overwrites a newer cloud copy. Symmetric
destruction, asymmetric guardrail. *Confirm or kill by:* deciding whether "explicit push/pull, no
merge logic" (the v3 design note) was meant to extend to silently discarding the remote copy.

**S4 - a spot segment with no covered spots dead-ends a workout.** If `coveredSpots` is empty at run
time, `SpotDrill` renders its "None of your saved ranges covers a spot" panel
(`SpotDrill.tsx:182-193`) with no way forward; the only control is close, which routes to
`finishSpotSegment` with zero attempts and abandons the entire workout rather than skipping the
segment. `buildDailyWorkout` only emits such a segment when coverage exists, and both sides read the
same storage, so I could not make the two disagree. *Confirm or kill by:* finding any path that
mutates the library between `TodayScreen`'s render and `WorkoutHost`'s mount - or by confirming
there is none, in which case the panel is unreachable inside a workout and its close handler is
dead code.

---

## Blind spots

- **The Supabase project itself.** The four SQL files say in their own headers that they are *not*
  executed by the app or the tests. Nothing verifies that the deployed schema, RLS policies, or
  `SECURITY DEFINER` functions match them. Finding 1's severity rests on the insert policy being
  what `0003`/`0004` describe. *More visibility:* a smoke test against a throwaway project, or at
  minimum a checked-in `supabase db diff` output.
- **`mobile/` beyond the shared-page mirrors.** I reviewed `mobile/platform/*`, both share screens,
  `PracticeHost`, and the session recorder. The ~25 remaining mobile components and 11 routes were
  not read. They are hand-ports of web screens with known divergences (web accumulates action-quiz
  attempts in component state, mobile in a host ref), which is exactly where a web-only fix stops.
  *More visibility:* a diff-oriented pass pairing each `mobile/components/*` file with its `src/`
  counterpart.
- **Everything the tests already mock.** `rangesRepo.test.ts` is 100% coverage of a module no
  production path calls - the tests pass on a fake Supabase client and would pass identically if the
  implementation were deleted. The same construction (injectable `client` + `resolveUserId`) is used
  by the three *live* repos, so their tests prove the call shape and nothing about the wire. *More
  visibility:* one contract test per table against a real (local) Postgres.
- **Real browser behavior.** Everything here ran under jsdom or Node. The service-worker finding was
  verified against the shipped source with a stub `fetch`/`caches`, not against a real
  `ServiceWorkerGlobalScope`; the `history.back()` pairing in `useBackToClose` (target T17) has no
  jsdom-faithful way to be exercised and I left it unattacked. *More visibility:* a Playwright run
  against a built bundle, including a redeploy-while-open scenario.
- **Timezone and DST.** `localCalendarDay`, `localDayStart`, `formatDayDistance`, `currentStreak`
  and `isReviewDue` all do local-day arithmetic, and the whole suite runs in one timezone. I read
  them and found the offset handling correct, but I did not exercise a DST boundary or a
  device-timezone change between sessions. *More visibility:* run the suite under `TZ=` a few
  half-hour and DST-observing zones.
