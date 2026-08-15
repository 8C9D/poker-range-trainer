# Launch checklist - iOS App Store, v1.0

Target: the Expo app in `mobile/`, submitted to the iOS App Store.
The web app in `src/` is not launching in v1; it stays a local development surface and the shared `@core` domain source.

## Decisions taken (2026-08-06)

These four answers shape every item below.
Re-opening any of them changes the work.

1. **Cloud sync is CUT from v1.** Supabase accounts, push/pull and delete-cloud-data are archived like the other 13 trimmed features. This removes the in-app-account-deletion blocker, the privacy-manifest conflict, the EAS env requirement and the missing password-reset flow in one move. Sync returns in 1.1 if it earns its place.
2. **iOS only.** No web deploy pass, no host, no domain, no service-worker-on-real-origin verification.
3. **Crash reporting ships (Sentry).** Without it, a crash on a stranger's phone is invisible. It collects diagnostic data, so the privacy manifest, the App Privacy answers and the privacy policy must all declare it.
4. **JSON backup export/import is restored.** Only the whole-library backup, not the four overlapping export paths (notation, CSV, action notation, range files) that were trimmed for good reason. With sync cut this is the user's only way to move ranges to a new phone, and the only honest answer to "where did my work go".

## Owner legend

- **[A]** an agent can complete it in the repo; covered by the Fable prompt.
- **[Y]** needs you - an account, a payment, a dashboard, a device, or a judgement call an agent must not fake.

## Status baseline (verified 2026-08-15 at `66835ab`)

Every line below was re-run at that commit, not carried forward - and being behind the tree this block lives in is the floor here rather than a lapse, stated per REVIEW-R7 R7-6: a stamp cannot name the tree it lives in, for the same reason a status cell may only name a commit that already exists, so this line always names the parent of the commit that writes it.
The gap then grows as the round's remaining documentation lands, which round 8 wrote this block as though it would not - corrected per REVIEW-R8 R8-9. The check that replaces the claim is one a reader can run: `git diff --stat <stamp>..HEAD` must be Markdown or static `docs/` pages only, because the gate covers executable state and nothing else.
It read `6186581` until round 7, five commits behind, one of which changed a comment in `@core`; refreshed per REVIEW-R6 R6-6 and at every round since. The mobile counts moved at `66835ab`: the send-test-crash-report hook added one suite and two tests (previously 37 / 241).

- `npm run lint` clean on both apps.
- `npm run test:run`: web 79 files / 1187 tests, mobile 38 suites / 243 tests, all passing.
- `npm run build` clean, mobile `tsc --noEmit` clean.
- `npm audit --omit=dev`: web 0 vulnerabilities.
- All five confirmed findings in `review/findings.md` have matching fix commits (`3c709bf`, `7ccefad`, `5fe714b`, `3078e7b`, `cc0a5d7`).

**Why the web count fell, and why it is not a loss of coverage.**
The previous baseline read 87 files / 1229 tests, verified 2026-08-06 at `1f59e2e`.
No test was deleted to get from there to here.
Pass 1 archived cloud sync in `1a325c3`, which moved eight web test files byte-identical into `archived/cloud-sync/` (`git diff -M` scores every one R100), and `vitest.config.ts:14` excludes `archived/**` deliberately, because archived features were cut from v1 and their code is expected not to compile.
Those eight files hold 56 tests, and six tests were added afterwards (five in `8f487c4`, one in `ef93dee`): 1229 − 56 + 6 = 1179, exactly the count `reviews/BASELINE.md:62-63` recorded on 2026-08-10 before the production-readiness work began.
The five web tests above that, and all of mobile's growth from 35/217, are that work; `PROD-READINESS.md` names the commit for each.
Restoring cloud sync would restore those 56 tests along with it - see `archived/RESTORE.md`.

---

## Pass 1 - Cut cloud sync

- [x] **[A]** Archive `src/cloud/*`, both `AuthPanel` components, `mobile/platform/supabaseClient.ts` and `mobile/platform/cloudEnv.ts` to `archived/cloud-sync/`, preserving relative paths.
- [x] **[A]** Unhook the Account screens on both platforms; the Reset-practice-record panel stays.
- [x] **[A]** Drop `@supabase/supabase-js` from both `package.json` files, and `react-native-url-polyfill` from `mobile/` plus its `import 'react-native-url-polyfill/auto'` in `mobile/app/_layout.tsx` (it exists only for Supabase on Hermes).
- [x] **[A]** Add the `cloud-sync` section to `archived/RESTORE.md` in the established format.
- [x] **[Y]** Deal with the live Supabase project - see "Your steps" step 1. Closed 2026-08-15: **no live project was ever provisioned.** Verified three ways - signing in with GitHub landed on a brand-new create-your-first-organization screen (no account existed, nothing was created), the user's inbox has no Supabase mail at all, and the full git history contains no real project ref (only `example.supabase.co` test placeholders). Step 1's premise that "the live project still holds real rows" was an assumption, and it was wrong; cloud sync was built and tested env-gated with no real backend. Nothing to retire, no public read surface, no user data.

## Pass 2 - Restore JSON backup

- [x] **[A]** Restore `BackupPanel.tsx` and `backup-screen.test.tsx` on mobile from `archived/import-export-backup/`, and the web Account screen's backup export/import for parity.
- [x] **[A]** Re-add `expo-document-picker`, `expo-file-system` and `expo-sharing` to `mobile/package.json` at SDK 56 versions, and the `expo-sharing` plugin entry to `mobile/app.json`.
- [x] **[A]** Leave the notation, CSV, action-notation and range-files panels archived.
- [x] **[A]** Confirm a backup written before the trim still restores, and that a restore of a payload carrying archived-feature fields does not throw.

## Pass 3 - Crash reporting

- [x] **[Y]** Create the Sentry account and project - see "Your steps" step 2. Done 2026-08-15: org `<sentry-org>`, project `poker-range-trainer` (renamed from the auto-assigned `react-native`; project ID <sentry-project-id>), US data storage; DSN in `mobile/.env.local` (untracked).
- [x] **[A]** Add `@sentry/react-native` and its Expo config plugin, gated on `EXPO_PUBLIC_SENTRY_DSN` and fully inert when unset, mirroring the `cloudEnv.ts` seam.
- [x] **[A]** Initialise in `mobile/app/_layout.tsx` with `Sentry.wrap` and `expoRouterIntegration`; wire `mobile/components/ErrorBoundary.tsx` to report caught errors.
  (Note: the SDK 56-pinned `@sentry/react-native` ~7.11.0 predates `expoRouterIntegration`; its documented equivalent for expo-router - `reactNavigationIntegration` registered with the router's navigation-container ref - is wired instead.)
- [x] **[A]** Disable session replay, screenshots and view hierarchy; a poker study tool has no reason to ship screen contents to a third party.
- [x] **[A]** Test that the app boots and behaves identically with the DSN unset.
- [x] **[Y]** Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` to EAS secrets for source-map upload - see "Your steps" step 7. Done 2026-08-15, plus `EXPO_PUBLIC_SENTRY_DSN`, all four as secret-visibility production env vars on `@poker-range-trainer/poker-range-trainer` (the auth token was rotated once after an exposure in a chat transcript; the live one exists only in the user's password manager and EAS).
  All three are needed: the plugin entry in `mobile/app.json` carries no `organization` or `project`, so the generated `ios/sentry.properties` falls back to `SENTRY_ORG` and `SENTRY_PROJECT` from the environment.
  Without them the upload has no destination `sentry-cli` can resolve, and it treats that as a hard configuration error rather than a skip, which the build script turns into a failed build - see step 7 for the trace through `sentry-xcode.sh`.
  That was inferred from the vendored script and CLI until 2026-08-15; the first real production build (EAS build `bd69c773`, buildNumber 3) then ran the upload with all three set and it succeeded - "Uploaded files to Sentry", release `com.arthurzhang.pokerrangetrainer@1.0.0+3`, org `<sentry-org>`, project `poker-range-trainer`.
  The missing-variable failure mode itself remains unobserved (no build has run with one unset), but the same build day produced direct evidence for the loud-failure half of the claim: the first build attempt (`2355aaeb`) failed in the bundle phase and `sentry-xcode.sh` surfaced it as an Xcode `error:` and a failed build rather than a silent skip.

## Pass 4 - Privacy and legal

- [x] **[A]** Update `NSPrivacyCollectedDataTypes` in `mobile/app.json` to declare crash and diagnostic data, linked to app functionality and not to tracking.
- [x] **[A]** Rewrite `docs/privacy-policy.md` for the shipped v1: local-first, no account, no cloud upload of ranges, crash diagnostics only.
- [x] **[A]** Update the App Privacy answers in `docs/ios-store-listing.md` to match, and remove the sign-in copy from the listing.
- [x] **[Y]** Host the privacy policy at a public URL - see "Your steps" step 3. Done 2026-08-15: GitHub Pages enabled on `main` `/docs`; <https://8c9d.github.io/poker-range-trainer/privacy.html> confirmed loading by user and agent.
- [x] **[Y]** Provide a support URL and support email - see "Your steps" step 3. Done 2026-08-15: <https://8c9d.github.io/poker-range-trainer/support.html> live with pokerrangetrainer.support@gmail.com.
- [ ] **[Y]** Answer the age-rating questionnaire, including the simulated-gambling questions - see "Your steps" step 8.
- [ ] **[Y]** Decide whether the repo needs a LICENSE (only matters if it is or will be public).

## Pass 5 - Data safety

- [x] **[A]** Write the storage-versioning rule down in `CLAUDE.md` or a short doc: nine `localStorage` keys, no migration machinery, malformed records silently dropped on read. Decide and record whether a shape change bumps the key suffix or migrates in place.
- [x] **[A]** Add a guard test that fails when a storage key is added or renamed without the backup key list being updated, closing finding S2's class of bug.
- [ ] **[Y]** Test the upgrade path on a real device - see "Your steps" step 9.

## Pass 6 - Correctness under real conditions

- [x] **[A]** Run the full suite under several timezones (a half-hour offset such as `Asia/Kolkata`, a DST-observing zone such as `America/New_York`, and `UTC`). Streaks, daily goals, the review schedule and the "today" boundary are all local-day arithmetic that has only ever run in one zone. Fix what breaks, or report it precisely.
- [x] **[A]** Remove the orphaned `src/components/SpotCoverage.css` and the empty `mobile/app/p/` and `mobile/app/r/` directories.
- [x] **[A]** Strip the Android block from `mobile/app.json`; Android has never been built or tested and half-present config invites a bad build.
- [ ] **[Y]** Real-device pass on TestFlight - see "Your steps" step 9. This is the one pass that cannot be simulated, and every test to date has run under jsdom or Jest.

## Pass 7 - Release engineering

- [x] **[A]** Add `.github/workflows/ci.yml` running `npm run lint`, `npm run test:run` and `npm run build` on push and pull request. Today these run only when someone remembers.
- [x] **[A]** Align versions: root `package.json` says `0.0.0` while `mobile/app.json` says `1.0.0`.
- [x] **[A]** Re-run full validation and commit in reviewable slices.
- [ ] **[Y]** Set up the support inbox before the support URL goes public.

## Pass 8a - Paid app (decision of 2026-08-15: v1.0 ships as a PAID app, price not yet chosen)

- [x] **[Y]** Legal entity confirmed (postal code needed the "<postal code>" spacing; user kept the entered address over Apple's standardized one) and the Paid Apps Agreement signed 2026-08-15; status Pending User Info.
- [x] **[Y]** Bank account added 2026-08-15: Wealthsimple, found via the bank-NAME search (routing 070300001 = institution 703 + transit 00001; the transit-number lookup alone matches nothing). Awaiting Apple verification.
- [x] **[Y]** U.S. W-8BEN submitted 2026-08-15 (details omitted).
- [ ] **[Y]** Canadian GST/HST Form 506 - **DEFERRED by user 2026-08-15.** Blocked on registering a CRA Business Number (GST/HST RT0001 account): Apple requires GST/HST registration to sell paid apps in Canada, and the form will not submit without BN + RT. Until this is filed the Paid Apps Agreement cannot go Active and no price can be set.
- [ ] **[Y]** Choose the price (standard tiers cap at US$999.99). Agent sets Pricing and Availability once the agreement is Active.
- [ ] **[Y]** Decide EU distribution: DSA trader declaration (publishes contact info on the EU store) vs excluding EU countries from availability.

## Pass 8 - Apple pipeline

Strictly sequential; each step gates the next.

- [x] **[Y]** Enrol in the Apple Developer Program - step 4. Done 2026-08-15 (user-confirmed).
- [x] **[Y]** Choose the bundle identifier - step 5. Done: `com.arthurzhang.pokerrangetrainer`, registered with Apple 2026-08-15 during credential setup.
- [x] **[Y]** Install and configure EAS - step 6. Done 2026-08-15: Expo account `pokerrangetrainer` (org `poker-range-trainer`), project linked as `@poker-range-trainer/poker-range-trainer` (ID `00db7769-3ca5-4290-93a6-52fc8d3690ae`).
- [x] **[Y]** Create the App Store Connect record - step 8. Record created 2026-08-15 (ASC App ID 6801882118) and build 1.0.0 (3) uploaded to it via `eas submit` the same day, with an APP_MANAGER-scoped ASC API key generated onto EAS servers for future submissions. Listing fields, App Privacy and age rating still being filled from `docs/ios-store-listing.md`.
- [x] **[Y]** Production build - step 7. Done 2026-08-15: EAS build `bd69c773` (buildNumber 3) FINISHED with the source-map upload verified in its Xcode log; the first attempt `2355aaeb` failed because the archiver uploaded the machine-local `mobile/ios/` tree - fixed by the root `.easignore`, which also cut the upload from 311MB to 2.2MB.
- [ ] **[Y]** TestFlight and the real-device pass - step 9.
- [ ] **[Y]** Screenshots - step 10.
- [ ] **[Y]** Submit - step 11.

---

# Your steps, in detail

Everything below needs an account, a payment, a device or a decision.
Do steps 1-3 whenever; they are independent.
Steps 4-11 are a chain.

## Step 1 - Retire the Supabase project

**Closed 2026-08-15 with a corrected premise: no live project ever existed.** The paragraph below asserted live rows and an anonymous read surface; the verification recorded at the Pass 1 checkbox found no Supabase account under either login method, no Supabase email in the user's inbox, and no real project ref in the git history. The instructions below are kept for the record and would apply only if a project were provisioned for the 1.1 sync revival.

Cloud sync is cut, but the live project still holds real rows and the deployed schema was never verified against the checked-in SQL.
Two tables, `shared_ranges` and `shared_packs`, are readable by anonymous visitors through `SECURITY DEFINER` functions, and with publishing archived there is no in-app way to revoke a link that was already sent.

1. Sign in at https://supabase.com/dashboard and open the project.
2. **Table Editor**: check whether `ranges`, `backups`, `shared_ranges` and `shared_packs` hold any rows that are not your own test data. If a real user ever published a link, you owe them a heads-up before you delete it.
3. **Authentication - Users**: note whether any account other than yours exists.
4. If everything is test data, the clean move is to **delete the whole project** (Project Settings - General - Delete project). That revokes every published link and every stored range in one action.
5. If you want to keep the project for 1.1, at minimum run this in the SQL Editor to revoke public reads:

   ```sql
   revoke execute on function public.get_shared_range(text, text) from anon, authenticated;
   revoke execute on function public.get_shared_pack(text, text) from anon, authenticated;
   ```

6. Either way, confirm in **Authentication - Policies** that RLS is actually enabled on every table. The four SQL files in `supabase/` say in their own headers that they are never executed by the app or the tests, so nothing has ever verified the live project matches them. If RLS were off on `backups`, every user's library would have been world-readable.

Tell me or the agent which route you took; the checklist item closes on your answer, not on an assumption.

## Step 2 - Sentry account and DSN

1. Sign up at https://sentry.io (the free Developer tier is enough: 5k errors/month).
2. **Create Project** - platform **React Native** - name it `poker-range-trainer`.
3. Copy the **DSN** it shows you. It looks like `https://<hash>@o<org>.ingest.sentry.io/<project>`.
4. The DSN is safe to expose in a client bundle; it only accepts writes. Do not paste the **auth token** anywhere in the repo.
5. Create `mobile/.env.local` with:

   ```
   EXPO_PUBLIC_SENTRY_DSN=<the DSN you copied>
   ```

   `.gitignore` already excludes `.env*`, so this will not be committed.
6. In **Settings - Auth Tokens**, create a token with `project:write` scope for source-map upload. Keep it for step 7.

Without the DSN the app runs completely normally with reporting inert, so this never blocks the agent's work.

## Step 3 - Public URLs

Apple requires a **support URL** and a **privacy policy URL**, both live before submission.

The pages are pre-staged in the repo (2026-08-15): `docs/privacy.html`, `docs/support.html`, `docs/index.html` and `docs/.nojekyll`, with the contact email prefilled as pokerrangetrainer.support@gmail.com - change it in both HTML files and `docs/privacy-policy.md` first if you want a different public address.

1. On GitHub: **Settings - Pages - Deploy from a branch - `main` - `/docs` - Save**.
2. Wait a minute, then confirm both URLs load: <https://8c9d.github.io/poker-range-trainer/privacy.html> and <https://8c9d.github.io/poker-range-trainer/support.html>.
3. Both URLs are already entered in `docs/ios-store-listing.md`; they go into App Store Connect in step 8.

## Step 4 - Apple Developer Program

1. Go to https://developer.apple.com/programs/ and enrol as an individual.
2. Cost is $99/year. Have a payment method and a government ID to hand.
3. Approval typically takes 24-48 hours and occasionally longer. **Start this early** - it is the longest pure-waiting item on the list.
4. You need the same Apple ID for App Store Connect and EAS.

## Step 5 - Choose the bundle identifier

A permanent, globally unique reverse-DNS string. It cannot be changed after your first submission.

- Convention: `com.<yourname>.pokerrangetrainer`, all lowercase, no hyphens or underscores.
- Do not use `com.example.*` or anything you would be embarrassed to see in a crash log for the next decade.
- Tell the agent the string and it sets `expo.ios.bundleIdentifier` in `mobile/app.json`.

## Step 6 - EAS setup

From the `mobile/` directory:

```sh
npm install -g eas-cli
eas login                 # your Apple-linked Expo account
eas build:configure       # links the project, writes the EAS project id
```

If `eas login` needs an Expo account, create one at https://expo.dev - it is free and separate from your Apple account.

## Step 7 - Production build

1. Add the Sentry auth token from step 2 as an EAS secret so source maps upload during the build, together with the org and project the upload targets:

   ```sh
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
   eas secret:create --scope project --name SENTRY_ORG --value <your-sentry-org-slug>
   eas secret:create --scope project --name SENTRY_PROJECT --value poker-range-trainer
   ```

   All three are required, not just the token.
   The Sentry plugin is registered in `mobile/app.json` as a bare `"@sentry/react-native"` with no `organization` or `project`, so the `ios/sentry.properties` written during prebuild says "no org found, falling back to SENTRY_ORG environment variable" and the same for the project.
   With either unset the source-map upload has no destination it can resolve, and `sentry-cli` treats that as a hard configuration error ("An organization ID or slug is required").
   Expect the **build to fail** rather than to quietly produce an unsymbolicated one: the generated Xcode "Bundle React Native code and images" phase runs `@sentry/react-native/scripts/sentry-xcode.sh`, which turns a failing upload into an Xcode `error:` and `exit 1` unless `SENTRY_DISABLE_AUTO_UPLOAD=true` or `SENTRY_ALLOW_FAILURE=true` is set, and neither is set anywhere in this repo.
   Whichever way it surfaces, the fix is the same: set all three.
   The project slug is `poker-range-trainer` if you named it as step 2 says; the org slug is the one in your Sentry URL (`https://<org>.sentry.io/`).

2. Add the Sentry DSN as a build-visible env var. Either add it to the `production` profile's `env` block in `mobile/eas.json`, or run `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>`. The DSN is public, so either is fine.
3. Build:

   ```sh
   eas build --platform ios --profile production
   ```

4. When prompted, **let EAS manage signing**. It creates the distribution certificate and provisioning profile in your Apple account. Say yes; hand-managing certificates is a well-known way to lose an afternoon.
5. First builds take 15-40 minutes. The output is a `.ipa` on Expo's servers.

## Step 8 - App Store Connect record

1. At https://appstoreconnect.apple.com, **My Apps - +  - New App**.
2. Name `Poker Range Trainer`, primary language, the bundle id from step 5, and an SKU (any private string, e.g. `poker-range-trainer-1`).
3. Paste the listing copy from `docs/ios-store-listing.md` - description, keywords, subtitle, promotional text.
4. Enter the support URL and privacy policy URL from step 3.
5. **App Privacy**: answer the questionnaire. With sync cut and Sentry shipping, the truthful answer is: **Diagnostics - Crash Data and Performance Data**, linked to app functionality, **not** linked to identity, **not** used for tracking. Nothing else is collected. The agent will have this written out in `docs/ios-store-listing.md`; match it exactly to the binary.
6. **Age rating**: answer the questionnaire. The one that matters is **Simulated Gambling**. This app has no wagering, no chips and no simulated play - it is a study tool for starting-hand ranges. Answer honestly and it should rate low, but read the question rather than clicking through; a wrong answer here is a rejection.
7. **Category**: Education, with Reference as secondary, is the honest fit.

## Step 9 - TestFlight and the real-device pass

Everything in this project has been tested under jsdom or Jest.
This is the first time it runs on a phone, and it is the pass most likely to find something real.

1. In App Store Connect, go to **TestFlight** and wait for the build from step 7 to finish processing (10-30 minutes).
2. Add yourself as an internal tester; install via the TestFlight app.
3. Work through `docs/manual-testing-guide.md` on the device. At minimum:
   - Create a range by hand on the 13x13 grid, including drag-paint.
   - Run a recognition drill end to end and press **End session**.
   - Confirm Progress and the streak updated.
   - Force-quit the app, reopen it, confirm nothing was lost.
   - Export a JSON backup, delete a range, re-import the backup, confirm it came back.
4. **Upgrade path**: install the current build, create data, then install the next build over the top and confirm the data survived. Do this before every release, forever.
5. Device-specific checks that jsdom cannot reach:
   - iPhone SE or the smallest device you can find - the 13x13 grid is exactly the layout that breaks on narrow screens.
   - **Settings - Accessibility - Display & Text Size - Larger Text** at maximum.
   - Airplane mode: the app is local-first and must be fully functional offline.
   - Dark mode and light mode.
   - Backgrounding mid-drill, then returning after several minutes.
6. Confirm a crash actually reaches Sentry. The hook exists (added 2026-08-15): **Account - Diagnostics - Send test crash report**, a section that renders only when the DSN is set. Press it, then check the Sentry dashboard for "Sentry pipeline test" - and check the stack trace is symbolicated, which is what proves the step 7 source-map upload worked. Untested crash reporting is not crash reporting.

## Step 10 - Screenshots

1. App Store Connect lists the required sizes. As of now that is 6.7" and 6.5" iPhone at minimum; iPad too if you keep `supportsTablet: true`.
2. Capture on the TestFlight build, on a real device or the simulator.
3. Best five: the grid mid-edit, a drill question, a miss with its explanation, the Progress tab with real data, the Today dashboard with a streak.
4. Populate the library with plausible ranges first. Screenshots of an empty app sell nothing.

## Step 11 - Submit

1. In App Store Connect, attach the build to the version.
2. Complete anything still flagged incomplete.
3. **Submit for Review**.
4. Review typically takes 24-48 hours.
5. **Expect a rejection round.** First submissions very often get one. It is a normal part of the process, not a verdict on the app. Read the reason, fix it, resubmit.
6. There is no rollback on iOS. A bad build means a new build and another review cycle, which is exactly why step 9 matters more than it feels like it should.

---

## Critical path

The Apple chain (steps 4-11) is mostly waiting.
Start **step 4 today** - enrolment approval is the longest blocking item and nothing else in the chain can begin without it.

While that is pending:

1. Agent runs passes 1-7.
2. You do step 1 (Supabase), step 2 (Sentry) and step 3 (URLs) in any order.
3. When enrolment clears: step 5, then 6, then 7.
4. Then 8, 9, 10, 11.

## Explicitly not in v1

Recorded so they do not get silently reintroduced.

- Cloud sync, accounts, published share links - deferred to 1.1.
- Android - config stripped; a separate launch if it ever happens.
- Web deployment - the web app stays a development surface.
- Product analytics - crash reporting only, to keep the privacy story simple and true.
- The notation, CSV, action-notation and range-file export paths - stay archived.
