# App Store listing - draft

Draft metadata for the **Poker Range Trainer** iOS app, to be pasted into App Store Connect at submission.
This is a starting point, not final copy - every line marked **TODO** needs a value only you can supply (URLs, final category, contact email, age rating).
Character limits are App Store Connect's; counts are approximate, re-check after editing.

> Truthfulness note: the App Privacy section below must match what the binary actually does.
> It is written for the shipped v1 build: **local-only**, no accounts, no cloud sync, with crash and performance diagnostics via Sentry as the only data collection.
> It is consistent with the privacy manifest in `mobile/app.json` (`NSPrivacyTracking: false`; collected data types: Crash Data and Performance Data, not linked to identity, not used for tracking).
> If you change data practices, update this file, `docs/privacy-policy.md`, and the manifest together.

## Listing fields

- **App name** (≤30 chars): `Poker Range Trainer`
- **Subtitle** (≤30 chars): `Preflop range builder & drills`
- **Promotional text** (≤170 chars, editable any time without review):
  `Build Texas Hold'em preflop ranges on a 13×13 grid, then drill them until you know them cold - spaced repetition, streaks, and leak reports. Works fully offline.`
- **Keywords** (≤100 chars, comma-separated, no spaces between items for density):
  `poker,range,preflop,holdem,trainer,ranges,grid,drill,study,strategy,practice,flashcards`
- **Primary category**: TODO - suggested **Education** primary, **Reference** secondary (a study tool, not a game).
- **Support URL**: TODO - required by Apple (a page where users can get help).
- **Marketing URL** (optional): TODO.
- **Copyright**: TODO - e.g. `2026 <your name>`.
- **Age rating**: TODO - answer the questionnaire.
  Note: the app has **no real-money gambling** and no simulated play (it is a study tool with no wagering, no chips and no dealt gameplay), which usually keeps the rating low, but read the "Simulated Gambling" questions and answer them honestly.

## Description (≤4000 chars)

```
Poker Range Trainer helps you build and master Texas Hold'em preflop ranges -
entirely on your device.

BUILD RANGES FAST
• Tap or drag across a standard 13×13 starting-hand grid to select hands.
• One-tap shortcuts for pairs, suited/offsuit groups, and broadways.
• See live hand count, combo count, and range percentage as you build.
• Attach scenario details (position, action, table size, stack depth) to every
  range.

ORGANIZE YOUR LIBRARY
• Save unlimited named ranges.
• Search by name, hand, or scenario; filter and sort; duplicate, favorite, and
  archive.
• Select several ranges and practice them as one queue.

DRILL UNTIL IT STICKS
• Recognition drill: is this hand in the range? Tap or swipe to answer, with
  haptics.
• Build-from-memory, timed, weakness-weighted, and range-edge drills.
• Every miss is explained and held on screen until you're ready to move on.

TRACK YOUR PROGRESS
• Spaced repetition schedules each range's next review; a due queue and streak
  keep you honest.
• A daily goal with weekly tiles shows how much you've practiced.
• Leak reports: weekly accuracy trends, leaks by hand type, miss-direction
  reads, and your weakest hands - each one tap from a targeted drill.

YOUR DATA STAYS YOURS
• 100% offline. No account, no sign-up, no cloud.
• Export your whole library as a JSON backup file and restore it on a new
  phone.
• No ads and no tracking.
```

## App Privacy (App Store Connect questionnaire) - truthful answers

Answer these in App Store Connect → App Privacy.
They reflect the shipped v1 build with crash reporting enabled (`EXPO_PUBLIC_SENTRY_DSN` set in the production build profile; if you ship without it, the truthful answer is instead "No, this app does not collect data").

- **Does this app collect data?** Yes.
- **Data types collected:**
  - **Diagnostics → Crash Data** - crash logs sent to Sentry, our crash-reporting processor.
  - **Diagnostics → Performance Data** - app-start and navigation timing, sampled at 10% of sessions.
- **For each type:**
  - **Used for:** App Functionality (finding and fixing crashes and performance problems).
    **Not** for tracking, advertising, analytics beyond diagnostics, or personalization.
  - **Linked to your identity:** **No** - the app has no accounts and sends no user identifier.
  - **Used for tracking:** **No** - consistent with `NSPrivacyTracking: false` in the privacy manifest.
    No ads, no third-party trackers, no analytics SDKs.
- **Collection is optional for the user?** No (crash reporting has no in-app toggle in v1), so answer the questionnaire as always-collected.
- **Data deletion:** all user content is on-device; uninstalling removes it.
  Diagnostics at Sentry age out automatically (90-day retention).
- **Privacy policy URL:** TODO - host `docs/privacy-policy.md` publicly and put the URL here (required).

## Still your job (not in this draft)

- App icon + splash artwork (a design asset).
- Screenshots on the required device sizes.
- Choosing the bundle identifier, category, age rating, and all URLs above.
- Hosting the privacy policy and entering its URL.
- Setting `EXPO_PUBLIC_SENTRY_DSN` (and `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` for source maps - all three, not just the token) in the EAS production profile, per LAUNCH-CHECKLIST.md steps 2 and 7.
