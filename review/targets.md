# Phase 1 - Seam inventory

## Phase 0: what this repo actually is

**Stack.** A local-first React 19 + TypeScript 6 SPA built by Vite 8 (`src/`), plus a second
React Native 0.85 / Expo SDK 56 app (`mobile/`) that consumes the same `src/` tree through the
`@core/*` alias. Tests: Vitest 4 + jsdom + Testing Library on web, Jest + RNTL on mobile
(`npm run test:run` runs both).

**Runtime model.** Single-threaded browser event loop. No server the app controls. There is no
router library: navigation is `window.location.hash` read through `useSyncExternalStore`
(`src/app/routes.ts`). Full-screen practice is React state layered over the shell, not a route
(`src/App.tsx`, `src/app/useBackToClose.ts`).

**Persistence.** Nine `localStorage` keys, each owned by one module under `src/storage/`, all
funneled through `readJson` / `writeJson` / `removeJson` (`src/storage/storageHelpers.ts`).
Five of them are keyed by range id. On iOS the same modules run against an MMKV-backed
`localStorage` shim (`mobile/platform/localStorageShim.ts`). There is no migration machinery:
each loader re-validates on every read and silently drops malformed records.

**Transport.** Optional, env-gated Supabase (`src/cloud/*`): email/password auth, a one-row
`backups` table for explicit push/pull, and two publish tables (`shared_ranges`, `shared_packs`)
read by anonymous visitors through `SECURITY DEFINER` RPCs. Everything is `jsonb` - the DB
enforces no shape. A PWA service worker (`public/service-worker.js`) sits in front of every
same-origin GET.

**Consequence for this review.** There is no server-side validation anywhere, no transactions,
and no concurrency inside a tab. So the classic seams instantiate as: *JSON-blob shape contracts*
(three of them: file import, `localStorage` read, and cloud `jsonb`), *multi-key writes that are
not atomic*, *module-level mutable state used to hand data between unmounting screens*, *two
platforms sharing a core but not sharing their screens*, and *a cache that decides what runs*.

Excluded up front and why:

- **Thread/lock/concurrency-within-a-request bugs** - don't apply; single-threaded, no workers
  other than the service worker (which shares no state with the page).
- **SQL injection / query building** - every call is a PostgREST builder with literal column
  names; no interpolation anywhere.
- **Authorization inside the app** - there is no in-app authz; the only trust boundary is
  Supabase RLS, which is reviewed as target T7/T8, not as app code.
- **CSS/visual regressions** - already fenced by `cssIntegrity.test.ts`, `accessibleNames`,
  `headingOutline`, and the mobile theme-parity guards. Re-reviewing them is duplicated work.
- **Poker correctness of the starter charts** - a judgement call the code explicitly disclaims.
- **`mobile/` UI screens beyond the ones that mirror a web seam** - covered only where the same
  invariant crosses both platforms (T1, T4, T15); a full mobile-only sweep is out of budget and
  is called out as a blind spot.

## Ranked seams

Rank = blast radius × fragility. Blast radius is "how much of a user's data or session is
affected"; fragility is "how little enforces the invariant".

### T1 - Publisher-controlled payload vs. its render consumers · **rank 1**
**Invariant.** A row fetched from `shared_ranges` / `shared_packs` is fully structurally checked
before anything renders or computes over it.
**Sides.** `src/domain/rangeTransfer.ts:322` (`isValidSavedRange`) and
`src/cloud/sharedRangesRepo.ts:101` / `sharedPacksRepo.ts:102` (raw `data as T`) on one side;
`src/components/SharedRangePage.tsx:113`, `SharedPackPage.tsx:116,158`,
`mobile/app/r/[id].tsx:103`, `mobile/app/p/[id].tsx:111` on the other.
**Why fragile.** `isValidSavedRange` checks 5 of the ~12 fields of `SavedRange` and nothing checks
`RangePack` beyond `ranges`. The gap is invisible because the checker's own doc-comment asserts the
opposite ("a published row is publisher-controlled in exactly the way an imported file is"). The
`jsonb` column accepts any shape; RLS only constrains `owner_id`.
**Blast radius.** Any signed-up user can craft a row and hand the link to a victim; the victim's
whole page is the unit at risk. Both platforms.

### T2 - Hash → route decoding · **rank 2**
**Invariant.** A corrupt location hash yields *no route*, never a thrown error, because the parse
runs during `App`'s render.
**Sides.** `src/app/routes.ts:35` (`decodeURIComponent(parts[1])`, unguarded) vs.
`src/domain/shareRoute.ts:19` (`safeDecode`, guarded, with a comment naming this exact failure).
**Why fragile.** Two sibling parsers of the same string, one hardened and one not; `routes.test.ts`
tests `%20` (the happy path) and nothing malformed. `useHashRoute` runs it inside `useSyncExternalStore`,
so a throw is a render throw.
**Blast radius.** The entire app behind the root `ErrorBoundary`, unrecoverable by its own
"Try again" (re-render re-parses the same hash).

### T3 - Service-worker cache fallback · **rank 3**
**Invariant.** When the network cannot supply an asset, the cached copy is served.
**Sides.** `public/service-worker.js:45-66` (network-first) vs. `src/App.tsx:16-21` (lazy chunks)
and `src/App.tsx:232` (the `SessionChunk` boundary that exists because of this).
**Why fragile.** "Cannot supply" is implemented as `.catch()` - i.e. transport failure only. An
HTTP error is a *resolved* promise and is returned untouched. `serviceWorker.test.ts` exercises
offline, cross-origin, and non-GET, but never a non-ok response.
**Blast radius.** Every lazily-loaded chunk after a redeploy; the practice overlay is the only
lazy subtree, so "practice stops working" for anyone with a stale tab or stale SW.

### T4 - The four per-hand overlays and which ones get pruned · **rank 4**
**Invariant.** A per-hand overlay only describes hands the range actually holds.
**Sides.** `src/storage/rangeStorage.ts:100-190` (`normalizeComboSelections` /
`normalizeMixedStrategies` / `normalizeHandNotes` take `rangeHands`; `normalizeHandActions` does
not) and `src/screens/RangeEditTab.tsx:258-279` (prunes three of four).
**Why fragile.** The asymmetry is deliberate for the editor (the action grid shows all 169 cells)
but nothing downstream knows that: `formatRangeSvg`, `assignedHands`, and `correctActionFor` all
treat `handActions` as authoritative while `RecognitionDrill` treats `hands` as authoritative.
**Blast radius.** One range at a time; contradictory grading between two drills on the same chart.

### T5 - Multi-key writes with no transaction · **rank 5**
**Invariant.** A finished session is recorded, or it is not.
**Sides.** `src/app/sessionRecording.ts:42-48` (four sequential stores) and
`src/practice/PracticeHost.tsx:296-301` (a loop over N ranges) vs.
`src/app/sessionRecording.ts:33` (`captureRecordingFailure`, which reports one message).
**Why fragile.** Only statement order enforces that `advanceReviewSchedule` reads hand accuracy
*after* `recordHandAccuracy` wrote it (`sessionRecording.ts:80`). A mid-loop quota failure leaves
some ranges recorded and some not, under one "could not save" line.
**Blast radius.** One session's worth of stats plus a schedule that may be advanced on stale data.

### T6 - Delete → purge → undo, across five stores and a module-level holder · **rank 6**
**Invariant.** Undo restores exactly what the delete removed, to where it was.
**Sides.** `src/storage/rangeRemoval.ts:61-116` (purge order, index splice, `replaceSavedRanges`)
and `src/screens/LibraryScreen.tsx:107,231-240` / `src/screens/RangeScreen.tsx:370` (the
`pendingUndo` module holder crossing a route change).
**Why fragile.** The range write happens first and the five purges after, deliberately; the undo
snapshot is in-memory and survives arbitrary intervening actions (including a backup restore).
**Blast radius.** Weeks of practice history per delete.

### T7 - `ranges` table primary key vs. per-user rows · **rank 7**
**Invariant.** A user's push cannot collide with another user's row.
**Sides.** `supabase/migrations/0001_ranges.sql` (`id text primary key`, `user_id` separate) vs.
`src/cloud/rangesRepo.ts:48-61` (`upsert(rows)` with no conflict target).
**Why fragile.** The PK is global, not `(user_id, id)`. Whether this is reachable depends entirely
on whether any production path calls `pushRanges` - which is exactly the kind of thing a repo with
100% test coverage of a dead module hides.
**Blast radius.** Cross-tenant, if reachable.

### T8 - Backup push/pull as last-writer-wins · **rank 8**
**Invariant.** The cloud row is the user's latest library.
**Sides.** `src/cloud/backupRepo.ts:41-49` (`upsert` with client-supplied `updated_at`) and
`src/screens/AccountScreen.tsx:50-70` (pull replaces everything, behind one `confirm`).
**Why fragile.** No version check, no compare-and-set; `updated_at` is `backup.exportedAt`, a
client string never read back. Two devices, one wins silently.
**Blast radius.** The entire library.

### T9 - Backup slice coverage vs. what the UI promises · **rank 9**
**Invariant.** "Backups include everything."
**Sides.** `src/storage/backup.ts:86-99,223-250` (8 slices) vs. `src/storage/statsReset.ts:23-31`
(7 stores, including `workout.v1`) and `src/screens/AccountScreen.tsx:349-352` (the copy).
**Why fragile.** The store list is maintained by hand in three places with no shared constant; a
tenth key added tomorrow lands in none of them.
**Blast radius.** Whatever a new key holds; today, one boolean-ish flag.

### T10 - `restoreBackup` atomicity and its error channel · **rank 10**
**Invariant.** A restore is all-or-nothing and reports failure readably.
**Sides.** `src/storage/backup.ts:223-250` (raw `localStorage.getItem`/`setItem`, hand-rolled
rollback) vs. `src/storage/storageHelpers.ts:70-100` (`writeJson`, the readable-error wrapper
every other write uses).
**Why fragile.** The one place that deliberately bypasses the wrapper. The snapshot read itself is
outside the `try`, so a store that throws on *read* fails before any write - different failure
mode, same catch site.
**Blast radius.** The whole library, on the one operation that has no undo.

### T11 - Two definitions of "due" · **rank 11**
**Invariant.** "Due now" means the same thing everywhere.
**Sides.** `src/domain/spacedRepetition.ts:86-92` (`isReviewDue`, local *calendar day*) vs.
`src/domain/freePractice.ts:70-79` (`at <= nowMs`, *instant*) and
`src/screens/TodayScreen.tsx:88,107` (the two are used as complements).
**Why fragile.** The calendar-day rule was introduced as a fix, with a long comment; the
instant comparison in `freePractice` was written later and never reconciled.
**Blast radius.** The Today screen's primary CTA - what a returning user is offered every day.

### T12 - Orphan scoping applied by some readers and not others · **rank 12**
**Invariant.** Records whose range is gone do not appear in any figure.
**Sides.** `src/domain/weeklyStats.ts:20-28` (`sessionsForLibrary`) and
`src/screens/ProgressScreen.tsx:62,68-88` (three different scoping expressions in twenty lines)
vs. `src/storage/rangeRemoval.ts:26-32` (per-spot accuracy deliberately survives a delete).
**Why fragile.** Scoping is a caller responsibility repeated at every call site, with an inline
comment warning that order matters (scope before ranking) - and one line right below it that
filters after ranking.
**Blast radius.** Every number on Progress and Today.

### T13 - Practice hand-pool precedence · **rank 13**
**Invariant.** A drill deals from the pool its caller intended.
**Sides.** `src/practice/PracticeHost.tsx:430` (`phase.handPool ?? request.handPool ??
queue.handPools?.[range.id]`) vs. `src/App.tsx:140-145,173-179,200-210` and
`src/screens/ProgressScreen.tsx:98-127` (five callers, one of which passes `{}` on purpose).
**Why fragile.** Three-level fallback whose bottom rung is "all 169 hands" - a silently wrong pool
looks like a working drill.
**Blast radius.** One session; the drill teaches the wrong thing rather than failing.

### T14 - Workout segment completion detection · **rank 14**
**Invariant.** A workout is marked done only when every segment was actually played.
**Sides.** `src/practice/WorkoutHost.tsx:187-220` (`attempts.length < segment.questionsPerRange`)
vs. `src/practice/RecognitionDrill.tsx:129` and `src/practice/SpotDrill.tsx:116` (each drill's own
end condition) and `src/domain/dailyWorkout.ts:120` (where `share` is computed).
**Why fragile.** Equality of two independently-computed counts is the completion signal; a drill
that can end at a *different* count (empty coverage, timed variant) reads as "user quit".
**Blast radius.** One day's workout flag and the whole run's summary.

### T15 - Web/mobile core-sharing boundary · **rank 15**
**Invariant.** A fix to shared behavior reaches both apps.
**Sides.** `src/` (shared via `@core/*`) vs. `src/screens/*` + `src/practice/*` (web-only) and
`mobile/app/*` + `mobile/components/*` (mobile-only, hand-ported).
**Why fragile.** The split is by directory, not by rule; `PracticeHost`, `SessionSummary`,
`SpotDrill`, and the shared pages exist twice with divergent internals (e.g. web accumulates
action-quiz attempts in component state, mobile in a host ref).
**Blast radius.** Any invariant that lives in a screen rather than in `src/domain`.

### T16 - In-memory handoffs between unmounting screens · **rank 16**
**Invariant.** A module-level holder is written by one screen and consumed exactly once by the next.
**Sides.** `src/storage/rangeRemoval.ts:127-145` (`pendingUndo`) and
`src/app/libraryView.ts:46-61` (`lastView`) vs. `src/screens/LibraryScreen.tsx:87,107-108`.
**Why fragile.** Read during render, cleared in an effect, explicitly to survive StrictMode's double
invocation - a pattern that is correct only as long as nobody adds a second consumer.
**Blast radius.** A stale undo offer can re-insert ranges into a library the user has since replaced.

### T17 - Back-button ↔ session-overlay history pairing · **rank 17**
**Invariant.** Every `pushState` a session makes is popped exactly once.
**Sides.** `src/app/useBackToClose.ts:26-47` vs. `src/App.tsx:106-120` (the single-hook
workout→practice handoff that exists *because* two hooks broke this).
**Blast radius.** Browser history; a mispaired `history.back()` can leave the site.

### T18 - Storage-shape contract: what each loader accepts vs. what each importer demands · **rank 18**
**Invariant.** The same record is judged the same way however it arrives.
**Sides.** `src/storage/rangeStorage.ts:196` (`parseSavedRange`: timestamps only need to be
`string`) vs. `src/domain/rangeTransfer.ts:322` (`isValidSavedRange`: timestamps must parse) and
`src/storage/*.ts` `validateX` (throwing) vs. `loadX` (skipping) pairs in every module.
**Blast radius.** One record; mostly cosmetic (sort order).

### T19 - CSV export/import round-trip · **rank 19**
**Invariant.** `parseRangeCsv(formatRangeCsv(r))` recovers name and hands.
**Sides.** `src/domain/rangeTransfer.ts:68-135,235-275` vs. `src/screens/AccountScreen.tsx:227-255`
(file name fallback, `name` may be `''`).
**Blast radius.** One imported range.

### T20 - `spotKey` string as a persisted primary key · **rank 20**
**Invariant.** `parseSpotKey(spotKey(s))` round-trips, and a stored key stays readable across
vocabulary changes.
**Sides.** `src/domain/spot.ts:146-177` vs. `src/storage/spotAccuracyStorage.ts:23` (validation on
read) and `src/domain/spotLeaks.ts:36` (silently skips unparseable keys).
**Blast radius.** Per-spot history; silently shrinking reports.

### T21 - Daily-workout sizing vs. the daily goal · **rank 21**
**Invariant.** The composed plan lands near the user's goal.
**Sides.** `src/domain/dailyWorkout.ts:115-120` (`MIN_SEGMENT_QUESTIONS` floor, per-range units)
vs. `src/domain/trainingGoal.ts:35-52` and `src/screens/TodayScreen.tsx:124-132`.
**Blast radius.** One card's honesty; a 10-hand goal can plan 25 hands.

### T22 - Mixed-strategy completeness · **rank 22**
**Invariant.** The frequency quiz grades against a strategy that describes a whole decision.
**Sides.** `src/domain/mixedStrategy.ts:77-96` (`incompleteMixedHands`, `primaryAction`) vs.
`src/screens/RangeScreen.tsx:682-765` (warns but does not block saving) and `MixedActionQuiz`.
**Blast radius.** Grading of one range's frequency quiz.

### T23 - `useAuthSession` subscription lifetime · **rank 23**
**Invariant.** Exactly one auth subscription per mount, torn down on unmount including the
resolve-after-unmount path.
**Sides.** `src/cloud/useAuthSession.ts:38-68` (deps include two function identities) vs.
`src/screens/AccountScreen.tsx:34` and `src/screens/RangeScreen.tsx:90` (both call with no args).
**Blast radius.** A leaked subscription per RangeScreen visit, if a caller ever passes deps inline.

### T24 - Cloud "delete everything" completeness · **rank 24**
**Invariant.** "Revokes every share link you have published" actually revokes them all.
**Sides.** `src/screens/AccountScreen.tsx:72-95` (`Promise.allSettled` over three deletes, first
rejection reported) vs. `unpublishAllSharedRanges` / `unpublishAllSharedPacks`.
**Blast radius.** Published links stay live while the UI reports a failure - or, on partial
failure, two of three succeed and the message names only one.

### T25 - Postflop `facing` string as a parsed contract · **rank 25**
**Invariant.** `isFacingAggression` reads back every phrase the drills can produce.
**Sides.** `src/domain/postflopScenario.ts:34-41` (`POSTFLOP_FACINGS`) and `:124-126` (the regex,
with a negative lookbehind added to un-break `c-bet`) vs.
`src/components/PostflopDrillSetup.tsx` and `mobile/components/postflopDrill.ts`.
**Why fragile.** A regex reading prose is a schema with no compiler; the last commit on `main`
fixed exactly this. Low blast radius (a self-graded teaching heuristic), so it ranks last despite
being the freshest churn.
