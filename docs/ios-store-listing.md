# App Store listing — draft

Draft metadata for the **Poker Range Trainer** iOS app, to be pasted into App
Store Connect at submission. This is a starting point, not final copy — every
line marked **TODO** needs a value only you can supply (URLs, final category,
contact email, age rating). Character limits are App Store Connect's; counts are
approximate, re-check after editing.

> Truthfulness note: the App Privacy section below must match what the binary
> actually does. It is written for the current build: **local-first**, with an
> **optional** Supabase sign-in for cross-device sync. It is consistent with the
> privacy manifest in `mobile/app.json` (`NSPrivacyTracking: false`). If you change
> data practices, update this file, `docs/privacy-policy.md`, and the manifest
> together.

## Listing fields

- **App name** (≤30 chars): `Poker Range Trainer`
- **Subtitle** (≤30 chars): `Preflop range builder & drills`
- **Promotional text** (≤170 chars, editable any time without review):
  `Build Texas Hold'em preflop ranges on a 13×13 grid, then drill them with
  spaced repetition, heatmaps, and combo/mixed-frequency practice. Offline-first.`
- **Keywords** (≤100 chars, comma-separated, no spaces between items for density):
  `poker,range,preflop,holdem,trainer,GTO,ranges,combos,equity,grid,drill,study,strategy,practice`
- **Primary category**: TODO — choose `Education` (study tool) or `Games → Card`.
  Suggested: **Education** primary, **Card** secondary.
- **Support URL**: TODO — required by Apple (a page where users can get help).
- **Marketing URL** (optional): TODO.
- **Copyright**: TODO — e.g. `2026 <your name>`.
- **Age rating**: TODO — answer the questionnaire. Note: the app has **no
  real-money gambling** (it is a study tool with no wagering), which usually keeps
  the rating low, but "Simulated Gambling" questions should be answered honestly.

## Description (≤4000 chars)

```
Poker Range Trainer helps you build, organize, and master Texas Hold'em preflop
ranges — entirely on your device.

BUILD RANGES FAST
• Tap or drag across a standard 13×13 starting-hand grid to select hands.
• One-tap shortcuts for pairs, suited/offsuit groups, and broadways.
• See live hand count, combo count (out of 1326), and range percentage as you go.
• Import and export ranges as standard notation (e.g. "77+, ATs+, KQo") via the
  clipboard, or as CSV.

ORGANIZE YOUR LIBRARY
• Save unlimited named ranges with scenario metadata (position, action, stack,
  game type).
• Search, filter, sort, duplicate, favorite, and archive ranges.
• Each card shows your practice accuracy at a glance.

A COMPLETE PRACTICE SUITE
• Recognition drills: is this hand in the range? Swipe to answer, with haptics.
• Build-from-memory, timed drills, and a "mistakes only" mode.
• Per-hand accuracy heatmap and a weakest-hands view.
• Spaced repetition with a due-today indicator and a practice streak.
• Multi-action ranges with an action palette, per-action accuracy, and an action
  quiz.

GO DEEPER
• Board explorer with flop texture tagging and range-vs-board overlays.
• Postflop decision practice on random spots.
• Combo explorer with blocker-aware counts and a blocker drill.
• Mixed-frequency editor, primary-action quiz, and notation.
• Range diff to compare two ranges; per-hand notes.

YOURS, EVERYWHERE (OPTIONAL)
• The app is fully usable offline with no account.
• Optionally sign in to sync your library across devices, export/import file
  backups, and open shared range links.

No ads. No tracking. Your ranges stay on your device unless you choose to sync.
```

## App Privacy (App Store Connect questionnaire) — truthful answers

Answer these in App Store Connect → App Privacy. They reflect the current build.

- **Does this app collect data?**
  - If you ship **without** Supabase configured (`EXPO_PUBLIC_SUPABASE_*` unset):
    **No** — all ranges and stats stay in on-device storage; nothing leaves the
    device.
  - If you ship **with** cloud sync enabled: **Yes**, the data below.
- **Data types collected (cloud build only):**
  - **Contact Info → Email Address** — for account creation/sign-in.
  - **User Content** — the ranges, practice stats, and notes you choose to sync.
- **For each type:**
  - **Used for:** App Functionality (account + cross-device sync). **Not** for
    tracking, advertising, analytics, or product personalization.
  - **Linked to your identity:** Yes (tied to your account).
  - **Used for tracking:** **No** — consistent with `NSPrivacyTracking: false` in
    the privacy manifest. No third-party trackers, ads, or analytics SDKs.
- **Data deletion:** users can delete all synced data in-app via Account → "Delete
  cloud data"; uninstalling removes all local data.
- **Privacy policy URL:** TODO — host `docs/privacy-policy.md` publicly and put the
  URL here (required).

## Still your job (not in this draft)

- App icon + splash artwork (a design asset).
- Screenshots on the required device sizes.
- Choosing the bundle identifier, category, age rating, and all URLs above.
- Hosting the privacy policy and entering its URL.
