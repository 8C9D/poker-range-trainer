# Manual Testing Guide

A complete, current guide to manually testing the Poker Range Trainer: how to run
it, what features exist (and what records what), what does **not** exist, and a
feature-by-feature checklist of what to test.

This guide reflects the **shipped v1 feature set** after the launch-scope trim:
the 12-feature keep list on both apps, plus the restored whole-library JSON backup
and the mobile-only Sentry crash reporting. Thirteen pre-launch features (cloud
sync and accounts among them) are archived under `archived/` — see
[`TRIM-REPORT.md`](../TRIM-REPORT.md) — and are **absent by design**; §4 lists
them so nobody tests for ghosts. The older
[`archive/manual-testing-checklist.md`](./archive/manual-testing-checklist.md)
covers only v1–v1.3 and is superseded by this document.

---

## 1. How to run the app

Two apps share one domain core. The **iOS app** (`mobile/`, Expo / React Native)
is the launching product; the **web app** (`src/`, React + TypeScript + Vite) is a
development surface that exercises the same `@core` logic. Both are **local-only**:
everything persists on-device, and there is no account, backend, or network
dependency. (The one optional network feature is mobile crash reporting, inert
unless `EXPO_PUBLIC_SENTRY_DSN` is set.)

| Goal | Command | Notes |
|------|---------|-------|
| Install deps | `npm install` and `npm install --prefix mobile` | First time only. |
| Web dev server | `npm run dev` | Opens Vite, default http://localhost:5173. Hot-reloads. |
| Web production build | `npm run build` | Typecheck + build + mobile typecheck. Must pass clean. |
| Preview the web build | `npm run preview` | Serves the built `dist/` to test the real bundle. |
| iOS simulator | `npm run ios` from `mobile/` | Expo dev build. |

For day-to-day manual testing, use `npm run dev` and open the printed URL. The
web and iOS apps mirror each other screen for screen; web-only extras are
keyboard grid navigation and the installable PWA, iOS-only extras are haptics
and the native share sheet on backup export.

### App layout

The UI is organized as routed screens, navigated from the left icon rail on the
web (bottom tabs under 640px, and native bottom tabs on iOS):

- **Today** (default) — greeting, review streak, a review queue ("Today's
  review" / "Due now"), an "All caught up" next-step suggestion, the optional
  daily-goal card, and this week's tiles.
- **Library** — searchable, filterable rows; **New range** opens a blank editor;
  clicking a row opens that range's page.
- **Range page** — a per-range page with a header **Practice** button, a **⋯**
  overflow menu (Duplicate / Favorite / Archive / Delete), and tabs
  **Overview / Edit / Stats**.
- **Progress** — training-overview tiles, hands answered this week, accuracy by
  week, library analytics, which way you miss, leaks by hand type, and weakest
  hands.
- **Account** — the file backup (export / import) and the practice-stats reset.

Practice runs as a full-screen overlay: a mode picker, then the drill, then a
session summary.

### Automated checks (run these first)

Before manual testing, confirm the automated suite is green — it covers the
domain and storage logic so manual testing can focus on the UI and wiring:

- `npm run lint`
- `npm run test:run` (web 1179 tests / 79 files, mobile 214 tests / 34 suites at
  time of writing; run from the **repo root** — from `mobile/` it runs the
  mobile-only variant)
- `npm run build`

If any fail, fix the root cause before manual testing — a red build means the UI
you're about to test may not reflect the source.

---

## 2. Managing test state (important)

All data lives in `localStorage` (web; origin = the dev/preview URL) or MMKV
behind a `localStorage` shim (iOS) under these nine keys:

| Key | Holds |
|-----|-------|
| `poker-range-trainer.saved-ranges.v1` | Saved ranges — hands, scenario metadata, favorite/archived flags, and dormant overlay fields from archived features (actions, frequencies, combo selections, notes, tags, source) that storage still carries |
| `poker-range-trainer.practice-stats.v1` | Per-range cumulative stats (attempts, accuracy, last practiced) |
| `poker-range-trainer.hand-accuracy.v1` | Per-hand accuracy (weakest hands, leak reports) |
| `poker-range-trainer.action-accuracy.v1` | Per-action accuracy (orphaned: nothing writes it since the trim; reset clears it, backups carry it) |
| `poker-range-trainer.session-history.v1` | Finished-session log (per range) + streak source |
| `poker-range-trainer.review-state.v1` | Spaced-repetition schedule per range |
| `poker-range-trainer.training-goal.v1` | Daily hands goal (target, or off) |
| `poker-range-trainer.spot-accuracy.v1` | Per-spot accuracy (orphaned like action accuracy) |
| `poker-range-trainer.workout.v1` | Day-scoped workout flag (orphaned; the ONE key outside the backup) |

**To reset to a clean slate:** open DevTools → Application → Local Storage and
delete those keys (or "Clear site data"), then reload. An incognito/private
window is the easiest fully-clean environment. On iOS, delete and reinstall the
app, or use **Account → Reset practice stats** for the practice record alone.

There is no migration machinery: every loader re-validates on read and silently
drops malformed records. The storage-versioning rule lives in
[`CLAUDE.md`](../CLAUDE.md) — read it before changing any stored shape.

**Tips for testing time-based features:**

- The app uses the **real clock** (`Date.now()`), not a fixed date.
- A brand-new range is **immediately "due for review"** (it has no schedule yet).
- After a recorded practice session, a range's next due date moves **at least 1
  day out**. To re-test the due queue same-day, edit/delete the
  `review-state.v1` key (e.g. set a range's `dueAt` to a past time) and reload.

---

## 3. What features exist

### Range creation & editing

- **13×13 starting-hand grid** — all 169 hands (pairs on the diagonal, suited
  above, offsuit below) in standard matrix order.
- **Click/tap to toggle** a hand in/out of the range.
- **Drag to paint** — press an unselected hand and drag to add; press a selected
  hand and drag to remove. The first cell sets the paint mode for the whole drag.
- **Keyboard toggle (web)** — Tab to the grid (one tab stop, not 169), move with
  the arrow keys, Enter/Space toggles; Home/End, Ctrl/Cmd+Home/End, and
  PageUp/PageDown jump.
- **Range shortcuts** — Add all pairs, Add 77+, Add suited broadways, Add offsuit
  broadways, Add all broadways (additive to the current selection).
- **Live range summary** — hands selected, combo count, % of all hands (the
  169-hand-class model).
- **Scenario metadata** (all optional) — game type, table size, stack depth (bb),
  hero position, versus position, action type, free-form notes; the editor offers
  to read the scenario straight out of a recognizable name ("SB 3-bet vs BTN open
  (6-max 100bb)").
- **Saving** — the iOS editor live-saves every change once the range has a name
  and a hand (an unwritable store shows a save-error banner); the web editor has
  an explicit Save button, blocked with a hint until there's a name and ≥1 hand,
  and a bad stack-depth value blocks either.

### Range library

- **List of saved ranges** as rows: name (★ when favorited), metadata chips
  (position, action, % of hands, plus **Due** / **Archived** when they apply),
  and a practice line (accuracy · last practiced, or "Not practiced").
- **Search** by name, scenario notes — or by a hand ("a5s", "TT"), which narrows
  to the charts that play it.
- **Filter** by position, action type, stack depth, game type; **Sort** by name,
  recently edited, recently practiced, accuracy (default = storage order). The
  view survives opening a range and coming back.
- **Favorite / Archive / Duplicate**, each from the range page's **⋯** menu.
- **Manage** — tick several ranges (or "Select visible") and **Practice
  selected** drills them back to back as one recognition queue, plus bulk
  favorite, archive, and delete.
- A delete — one range or a selection — is offered back as an **Undo** that
  restores the ranges along with their practice records. The undo is held in
  memory only and does not survive a reload.
- **Empty states** — with no ranges, Today shows a "Welcome" card and the
  Library a "No ranges yet" card; both point at **Create a range** and disappear
  once one is saved. (A fresh install is empty: the starter-charts offer is
  archived.)

### Practice modes

Clicking **Practice** on a range's page opens a **mode picker** (Today's "Start
review" and the weak-hand drills skip it and go straight into recognition):

1. **Recognize hands (in/out)** — random hand shown as concrete cards; you
   answer with the range's action verb (default "In range") or "Fold", with
   immediate feedback. A fixed set of hands, then a **session summary**
   (accuracy ring, score, streak).
2. **Build from memory** — rebuild the whole range on a blank grid; "Check my
   range" reports correct / missed / added-by-mistake and counts as a practice
   session. Checking a *blank* grid (how you ask to be shown the chart) records
   nothing.
3. **Timed drill** — 30/60/120s (default 60s); answer as many as possible.
4. **Weakness drill** — recognition loop that resurfaces hands you've missed
   this session more often.
5. **Edge drill** — prompts only from the range boundary (in-range hands with an
   out-of-range neighbour, and vice versa); hidden for a range with no boundary.

Plus **Practice mistakes only** — the range page's **Stats** tab has a
"Practice mistakes" button restricted to hands you've gotten wrong.

Every **miss is explained** — the hand's class, how much of that class the range
plays, and whether it sits on the range edge — and the miss holds on screen
until you continue (the timed drill excepted). On iOS, swipe right = in range,
swipe left = out, with a haptic tap; the buttons remain the primary control.

### Performance & tracking

Open via the range page's **Stats** tab:

- **Per-hand accuracy table** — weakest-first: hand, accuracy %, attempts,
  missed, wrongly included.
- **Session history** — newest-first list of finished sessions.
- **Practice mistakes** button (when there are recorded mistakes).

### Spaced repetition, goals & Today

- The **Today** screen surfaces due ranges: "Today's review" with **Start
  review**, a "Due now" list, and an "All caught up" state that still offers a
  next step — the hands you play worst, or the chart whose review comes round
  next.
- **Review streak** — consecutive days with at least one finished session.
- Each finished session advances that range's schedule by accuracy, pulled
  closer when its per-hand record still has stubbornly-wrong hands.
- **Daily goal** — an optional hands target (10/20/40/80) with progress on
  Today, plus this week's tiles.

### Progress analytics

- Training-overview tiles, **Hands answered this week**, **Accuracy by week**
  (eight trailing buckets), and **Across your library**.
- **Leaks by hand type** — the hand classes you miss most, weakest first, each
  with a one-tap **Drill**.
- **Which way you miss** — whether your misses lean loose or tight, with
  per-seat leans and a directional **Drill** per seat.
- **Weakest hands** — the individual hands you play worst.

### JSON backup (Account)

- **Export backup** — one file holding every persisted slice: ranges (dormant
  overlay fields included), practice stats, per-hand / per-action / per-spot
  accuracy, session history, review state, and the daily-goal target. Only the
  day-scoped workout flag is deliberately left out. On the web it downloads a
  dated file; on iOS it writes the file and opens the share sheet.
- **Import backup** — reads such a file and, behind a confirm on the web,
  **replaces all local data**. The payload is validated before anything is
  written, and the write is atomic (a mid-write failure rolls back). A backup
  written before the trim — carrying archived-feature fields like action
  overlays, tags, and notes — still restores, and those fields survive to disk.
- **Reset practice stats** — confirms first, then clears every recorded
  practice store while keeping the ranges and the daily goal.

### Crash reporting (iOS only)

- Gated entirely on `EXPO_PUBLIC_SENTRY_DSN`. Unset (the default in dev and
  test), the app behaves exactly as if Sentry did not exist: no init, no
  network, no console output.
- Set, it reports crashes and caught ErrorBoundary errors plus sampled (10%)
  performance traces. Session replay, screenshots, and view hierarchies are
  disabled — see `mobile/platform/crashReporting.ts` and
  [`docs/privacy-policy.md`](./privacy-policy.md).

### What records what (subtle but important)

| Mode | Per-range stats line | Per-hand accuracy | Session history | Advances spaced-rep schedule |
|------|:--:|:--:|:--:|:--:|
| Recognize (full) | ✅ | ✅ | ✅ | ✅ |
| Recognize (mistakes-only) | ✅ | ✅ | ✅ | ✅ |
| Timed drill | ✅ | ✅ | ✅ | ✅ |
| Weakness drill | ✅ | ✅ | ✅ | ✅ |
| Edge drill | ✅ | ✅ | ✅ | ✅ |
| Build from memory | ✅ | — | ✅ | ✅ |

All recorders are **no-ops when zero questions were answered**, so ending a mode
immediately records nothing. A build grades a whole chart at once, so it does
not write the per-hand record. The streak counts days with any recorded session.

---

## 4. What does NOT exist

The v1 launch scope is the 12-feature keep list plus the JSON backup. The
following are **archived by design** (`archived/`, restorable per
[`archived/RESTORE.md`](../archived/RESTORE.md)) — confirm they are absent, do
not test for them:

- Cloud accounts, sync, and published share links (no sign-in anywhere).
- Offline `#range=` share links, and the notation / CSV / action-notation /
  mixed-notation / range-files import-export panels (the JSON backup is the only
  data path in or out).
- Starter charts (a fresh install is empty).
- Per-hand notes, tags, and source/reference.
- Action and frequency overlays and their quizzes.
- Combo tools (explorer, selector, blocker drill).
- Postflop tools and range compare.
- Play the spot, the coverage map, weakest spots, and seat/action accuracy.
- The daily workout.
- Range thumbnails and the accuracy heatmap.

Also intentionally absent:

- Android — the config was stripped; iOS only.
- Product analytics — crash reporting only.
- Solver imports, OCR, or any automated range extraction.

The dormant storage for archived features (overlay fields on saved ranges, the
spot/action-accuracy and workout keys) is still carried, cleared by Reset, and
round-tripped by backups, so restoring a feature later finds its data intact.

---

## 5. Manual test checklist

Work top-to-bottom for a full pass, or jump to the area you changed. Start each
area from a known state (see §2).

### 5.1 Baseline

- [ ] `npm run dev` starts and the app loads with no console errors.
- [ ] `npm run lint`, `npm run test:run`, and `npm run build` all pass (repo root).
- [ ] On a clean profile, Today shows the "Welcome" card and the Library shows
      "No ranges yet"; both offer **Create a range** and no starter-chart offer.

### 5.2 Range editor — selection

- [ ] The 13×13 grid renders with the correct hands (AA top-left, 22 bottom-right).
- [ ] Clicking an unselected hand selects it; clicking again deselects it.
- [ ] Press-and-drag across unselected hands selects all crossed; starting on a
      selected hand deselects all crossed; re-entering a hand during one drag
      does not flip it back and forth.
- [ ] Releasing the mouse off the grid ends the drag; dragging does not select
      the cell labels as text.
- [ ] (Web) Tab to the grid and toggle with Enter/Space; arrows move the focus.
- [ ] The summary (hands / combos / % of all hands) updates live.

### 5.3 Range shortcuts

- [ ] Buttons present: Add all pairs, Add 77+, Add suited broadways, Add offsuit
      broadways, Add all broadways.
- [ ] Add 77+ selects 77–AA and leaves 66 unselected; the others select their
      expected hands; shortcuts add to the current selection.

### 5.4 Scenario metadata

- [ ] Game type / table size / position / versus / action-type dropdowns each
      default blank and list the expected options.
- [ ] Stack depth: blank is allowed; 0/negative shows a validation message and
      blocks the save; correcting it saves again.
- [ ] Changing metadata never changes the selected hands.
- [ ] Saved metadata shows as chips on the range's **Overview** tab; the Library
      row shows a subset (position / action / %).
- [ ] **From the name**: a range named *SB 3-bet vs BTN open (6-max 100bb)* gets
      the scenario offered above the fields; **Use this** fills only the fields
      not already set; a plain name ("My favourite chart") offers nothing.

### 5.5 Save / load / edit / delete

- [ ] (Web) Save is disabled with a hint until there's a name **and** ≥1 hand;
      (iOS) the editor live-saves once both exist.
- [ ] Edits on the **Edit** tab save in place (no duplicate) and advance
      "recently edited".
- [ ] Delete (range page **⋯** menu) removes the range and returns to the Library.
- [ ] Reload the page — saved ranges persist.

### 5.6 Undoing a delete

- [ ] Deleting a range lands on the Library with an offer naming what went;
      **Undo** puts the range back with its accuracy and review schedule intact.
- [ ] The same works for a **Manage → Delete selected** bulk delete.
- [ ] **Dismiss** or a reload drops the offer and keeps the delete.
- [ ] Practice recorded on other ranges between the delete and the undo survives.

### 5.7 Library: search / filter / sort

- [ ] Search narrows by name and scenario notes; a no-match shows the
      "No ranges match …" message.
- [ ] Typing a hand ("a5s", "5As", "TT") narrows to the charts that PLAY it;
      terms combine ("btn a5s").
- [ ] Each filter (position, action, stack depth, game type) narrows correctly
      and they compose; stack-depth options reflect the depths actually saved.
- [ ] The view survives a round trip into a range and back; **Clear filters**
      (or a reload) starts fresh.
- [ ] Sorts reorder as expected; never-practiced ranges sort last for
      practiced/accuracy.

### 5.8 Library: favorite / archive / duplicate / bulk

- [ ] Favorite adds a ★ to the row; "Favorites only" narrows to favorites.
- [ ] Archive hides the range behind "Show archived"; Unarchive restores it.
- [ ] Duplicate creates an independent copy.
- [ ] All flags survive a reload.
- [ ] **Manage** → tick two ranges → **Practice selected** runs them as one
      queue with **Next range** between them; each range's stats update.
- [ ] With nothing ticked (or the ticked rows hidden by a search), bulk actions
      are disabled.

### 5.9 Practice — recognition + session summary

- [ ] **Practice** opens the mode picker; "Recognize hands" starts the session.
- [ ] The two answer buttons read the range's action verb and "Fold", with
      immediate feedback; correct answers auto-advance.
- [ ] A wrong answer adds the explanation line, swaps the buttons for a single
      **Next**, and holds until you continue.
- [ ] Completing the set (or closing) shows the summary — accuracy ring,
      "N of M correct", streak — then **Done** returns.
- [ ] The Library row and the range's **Stats** tab show the updated stats.

### 5.10 Practice — build from memory

- [ ] Shows only the range name + a blank grid; "Check my range" reports
      Correct / Missed / Added-by-mistake.
- [ ] A checked build updates stats and history and advances the schedule;
      checking a blank grid shows the chart and records nothing.

### 5.11 Practice — timed drill

- [ ] Duration select offers 30/60/120s (default 60s); the countdown ticks; at 0
      the session records and the summary appears.
- [ ] Misses auto-advance too — the clock does not stop for you.

### 5.12 Practice — weakness drill

- [ ] Hands you answer incorrectly recur noticeably more often.
- [ ] Closing (or completing) records the session like recognition.

### 5.13 Practice — edge drill

- [ ] The picker offers **Edge drill**; it prompts only boundary hands.
- [ ] The option is hidden for a range with no boundary (empty or all 169).

### 5.14 Practice mistakes only

- [ ] After misses, the **Stats** tab's "Practice mistakes" launches a session
      restricted to missed hands; the button is absent with no recorded mistakes.

### 5.15 Performance view (Stats tab)

- [ ] Unpracticed: the "No practice data yet" message.
- [ ] After sessions: the weakest-first per-hand table (accuracy %, attempts,
      missed, wrongly included) and the newest-first session history.

### 5.16 Spaced repetition: due today + streak

- [ ] "Due now" shows never-practiced (and overdue) non-archived ranges only.
- [ ] "Start review" (or a row's **Review**) drills a due range and returns.
- [ ] After a recorded session, the range leaves the due list (≥1 day out).
- [ ] With nothing due and a recorded miss, **All caught up** offers **Drill
      weak hands**; with nothing missed, it offers **Review early** on the range
      that comes round next.

### 5.17 Daily goal & week tiles

- [ ] The goal card's target (10/20/40/80, or off) persists across a reload.
- [ ] Answering hands advances the bar; the card reports the goal as met.
- [ ] The week tiles reflect the days practiced.

### 5.18 Progress analytics

- [ ] With nothing practiced, each card explains itself instead of drawing empty.
- [ ] **Hands answered this week** and **Accuracy by week** (eight trailing
      buckets, a practice-free week keeps its slot) reflect real sessions.
- [ ] **Leaks by hand type** ranks missed classes (≥3 answers and ≥1 miss to
      appear); **Drill** runs a recognition session restricted to that class's
      missed hands across ranges.
- [ ] **Which way you miss** says loose / tight / split over a two-color bar
      (≥6 misses to appear); seats that lean decisively are listed, and a seat
      row's **Drill** deals only the hands missed in that direction.
- [ ] **Weakest hands** lists the individual hands you play worst.

### 5.19 JSON backup (Account)

- [ ] The **Account** screen shows exactly: Export backup, Import backup, and
      Reset practice stats (no cloud, sign-in, pack, CSV, or notation controls).
- [ ] **Reset practice stats** confirms first, clears every recorded store, and
      keeps the ranges and the daily goal; Progress falls back to empty states.
- [ ] "Export backup" downloads a dated JSON (web) / opens the share sheet (iOS).
- [ ] "Import backup" confirms, then **replaces** all local data with the file.
- [ ] Round trip: set a daily goal and practice, export, clear site data, then
      import — the goal and every stat come back with the same numbers.
- [ ] A pre-trim backup (with action overlays, tags, notes on its ranges)
      imports without an error, and re-exporting carries those fields through.
- [ ] A malformed file shows an alert and changes nothing.

### 5.20 iOS-specific

- [ ] The grid stays square with ≥44px tap targets on small screens; drag-paint
      works under the gesture handler.
- [ ] In recognition, swipe right = in range, swipe left = out, with a haptic
      tap; buttons still work.
- [ ] An explicit **End session** ends practice and records it (leaving the
      screen does not).
- [ ] With `EXPO_PUBLIC_SENTRY_DSN` unset, the app boots and behaves exactly as
      before Sentry existed (no warnings, no network).
- [ ] Dark mode and light mode both render correctly.

### 5.21 Web-specific (PWA)

- [ ] In a production build (`npm run preview` — **not** dev) the app is
      installable and loads offline after the first visit.
- [ ] The browser Back button closes an open drill and returns to the screen
      underneath it instead of navigating the app while the drill stays up.

### 5.22 Persistence / data integrity

- [ ] Everything survives a page reload (ranges, stats, history, schedule).
- [ ] Clearing the nine localStorage keys returns the app to a clean slate with
      no crash.
- [ ] Manually corrupting a key (e.g. set `saved-ranges.v1` to `not json`)
      doesn't crash the app — storage validates and drops malformed data.

---

## 6. Testing notes & gotchas

- **Local-only:** clearing browser data, switching devices, or uninstalling
  loses local data **unless** you've exported a backup. The JSON backup is the
  only way data moves.
- **No same-day re-due:** a practiced range won't reappear in "Due now" until
  its next scheduled date; edit `review-state.v1` to force it.
- **Empty sessions:** ending a mode without answering anything records nothing —
  this is expected. Checking a blank build grid is the same.
- **Dormant stores:** the action-accuracy, spot-accuracy, and workout keys are
  orphaned by the trim — nothing writes them, Reset still clears them, and
  backups still carry the first two. Not a bug.
- **Sentry in dev:** the DSN is unset in dev and tests, so crash reporting is
  fully inert; nothing to test locally without a DSN.
