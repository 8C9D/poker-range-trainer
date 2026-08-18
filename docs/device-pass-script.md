# Real-device TestFlight pass — 1.0.0 (5)

Execution script for the app's first run on a physical iPhone. Everything until now
has been tested under jsdom or Jest, so treat every step as untested until you have
seen it with your own eyes.

- **Build:** install **1.0.0 (5)** from TestFlight (the build ledger in
  [`LAUNCH-CHECKLIST.md`](../LAUNCH-CHECKLIST.md) — 3 and 4 are superseded; 5 is the
  only one carrying both the gesture crash fix and the drill-feedback polish).
- **Time:** ~30–45 minutes, plus a few idle minutes during step 12.
- **Recording:** fill the findings table at the end **as you go** — pass / fail plus
  what actually happened. A blank row is an untested item, not a pass. Do not stop to
  fix anything; write it down and keep going.
- **Names:** every screen and button below was checked against `mobile/` source on
  2026-08-18. Where `docs/manual-testing-guide.md` or the checklist use different
  wording (they say "End session", "Export backup", "Import backup", "Practice
  mistakes"), this script uses the string actually on screen.

| Field | Value |
|---|---|
| Device / model | |
| iOS version | |
| Build tested | 1.0.0 (5) |
| Date | |

---

## 0. Decide the upgrade path before you install (2 min)

The upgrade path is "data created on the installed build survives installing the next
build over the top". Only one of these two branches is available to you.

- [ ] **If build 3 or 4 is still installed on this phone:** do **not** delete it.
      Run steps 2–4 on the *old* build first (create both ranges, run one drill), then
      update to 1.0.0 (5) from TestFlight **over the top** — never delete and reinstall.
      **Expected:** after the update, both ranges, the accuracy, the session history
      and the streak are exactly as you left them. Then continue from step 5 on build 5.
- [ ] **If build 5 is already installed, or the app has never been installed:** the
      upgrade path **cannot be verified in this pass** — there is no older build to
      upgrade *from*. Record it as "not verifiable this pass", install 5, and **keep
      the data you create today** (step 17): the next build installed over it is the
      verification.

---

## 1. Install and first launch (2 min)

- [ ] Install 1.0.0 (5) via the TestFlight app and open it.
      **Expected:** the splash resolves into the **Today** screen without a crash;
      bottom tabs read **Today / Library / Progress / Account**; there is no sign-in
      anywhere. On a clean install, Today shows a **Welcome** card with **Create a
      range** and **Open Library**, and Library shows its empty state with **Create a
      range**. No starter charts — an empty app is correct.
- [ ] Note anything that flashes, stutters, or renders in a system font after the
      splash (the app holds the splash until its own fonts load).

## 2. Create range A with drag-paint (5 min)

- [ ] **Library** tab → **New range**. Type a name, e.g. `BTN open 100bb`.
      **Expected:** no Save button anywhere — the editor live-saves.
- [ ] Press an **unselected** cell and drag across a row and down a column without
      lifting your finger.
      **Expected:** every cell you cross fills; crossing one twice in the same drag
      does **not** flip it back; the stats line under the name (hands / combos / % of
      hands) updates live as you paint.
- [ ] Start a drag on a **selected** cell and drag across selected cells.
      **Expected:** all of them clear — the first cell sets the mode for the whole drag.
- [ ] Lift your finger off the edge of the grid mid-drag.
      **Expected:** the drag ends cleanly, no stuck paint state, no scroll fight
      between the grid and the page.
- [ ] Tap the shortcut chips **All pairs** and **Suited broadways**.
      **Expected:** they add to what is already selected rather than replacing it.
- [ ] Fill in scenario metadata below the grid: game type, table size, position,
      action type, stack depth `100`.
      **Expected:** every value sticks; the selected hands do not change.
- [ ] Tap **Done** in the header.
      **Expected:** the range's page opens, titled with the name, with metadata chips
      under it and tabs **Overview / Edit / Stats**.
- [ ] **← Library**.
      **Expected:** a row with the name, its chips, a **Due** chip (never practiced),
      and **Not practiced** on the right.

## 3. Create range B (2 min)

- [ ] **New range** → name it `Test chart B` → tap about ten individual cells → **Done**.
      **Expected:** as above. This second range exists to be deleted and restored in
      step 15, so keep it small.

## 4. Full recognition drill, ended by completing the set (6 min)

- [ ] Library → range A → **Practice**.
      **Expected:** a full-screen overlay headed **How do you want to train?** listing
      Recognize hands / Build from memory / Timed drill (with a 30/60/120s selector) /
      Weakness drill, and **Edge drill** if the range has a boundary.
- [ ] Tap **Recognize hands**.
      **Expected:** `×` top-left, a progress bar, the range name; two playing cards;
      two answer buttons reading the range's action verb and **Fold**.
- [ ] Answer all **20** hands, getting at least **3 wrong on purpose**.
      **Expected:** a correct answer auto-advances after a short beat; a miss holds a
      one-line explanation and replaces the two buttons with a single **Next** until
      you tap it; the progress bar advances with each answer.
- [ ] On at least two prompts, answer by **swiping right (in range)** and **swiping
      left (fold)** instead of tapping.
      **Expected:** the swipe registers the answer and you feel a light haptic tap.
      This is the gesture path that crashed release builds before build 4 — if it
      crashes or does nothing, that is the single most important finding of this pass.
- [ ] After question 20 the summary appears.
      **Expected:** accuracy ring, "N of M correct", a comparison line, a streak line,
      a recap of what you missed, a **Drill these now** button, and **Done**.
- [ ] Tap **Done**. **Expected:** back on the range page.

## 5. Ending a drill explicitly, mid-session (3 min)

There is **no button labelled "End session"** in this build; the checklist and the
manual-testing guide are stale on that name. A session records when the 20-question
set completes, or when you end it with the overlay's **`×`** (VoiceOver reads it as
"Close practice").

- [ ] **Practice → Recognize hands**, answer **5** hands, then tap **`×`**.
      **Expected:** the run ends into its summary with 5 answers recorded — `×` is the
      recording path, not an abandon.
- [ ] **Done**, then **Practice → Recognize hands**, answer **2** hands, then dismiss
      by **swiping in from the left screen edge** instead of tapping `×`.
      **Expected — verify, do not assume:** write down whether those 2 answers turn up
      in the Stats tab in step 6. A swipe-dismiss that silently discards a played
      session is a finding, not a pass.
- [ ] **Practice → Recognize hands**, then tap `×` **without answering anything**.
      **Expected:** nothing is recorded — no new session appears in Stats.

## 6. Stats and library reflect the drills (2 min)

- [ ] Range A page → **Stats** tab.
      **Expected:** a **Weakest hands** card of hand chips with accuracy percentages,
      a **Practice weak hands** button (it appears only because you missed hands), and
      a **Session history** card listing today's sessions newest-first with
      `correct/total · %`. (The guide's "per-hand accuracy table" and "Practice
      mistakes" button are the web wording; mobile shows chips and "Practice weak
      hands".)
- [ ] **Overview** tab. **Expected:** the metadata facts you entered plus **Recent
      sessions**.
- [ ] **← Library**. **Expected:** range A's row now shows an accuracy percentage and
      a "practiced" line instead of "Not practiced", and its **Due** chip is gone.

## 7. Today: streak, review queue, daily goal (3 min)

- [ ] **Today** tab.
      **Expected:** a **🔥 1 day** chip beside the greeting; tapping it explains that
      one rest day is forgiven. Range A has left **Due now** (it is scheduled at least
      a day out) while range B is still listed as due, with **Today's review** and
      **Start review** above it. The week tiles show **Hands this week**, **Accuracy**
      and **Sharpest range** with real numbers.
- [ ] Set the **Daily goal** to **20**.
      **Expected:** the goal line and progress bar reflect the hands you have already
      answered today.

## 8. Progress (2 min)

- [ ] **Progress** tab.
      **Expected:** **Hands answered this week** roughly matching what you answered;
      **Accuracy by week** with this week's bucket filled; **Across your library**
      populated; **Which way you miss** (it needs ~6 misses to draw — an explanatory
      line instead of a chart is correct, not a bug); **Leaks by hand type** listing
      the classes you missed, each with a **Drill**; **Weakest hands**. No card should
      render as an empty or broken chart.
- [ ] Tap one **Drill** button.
      **Expected:** it goes straight into a recognition drill over those hands with no
      mode picker. Answer two or three, then `×` out.

## 9. Dark mode and light mode (2 min)

- [ ] With the app in the foreground on Today, switch the system appearance to **Dark**
      (Control Centre brightness long-press, or Settings → Display & Brightness).
      **Expected:** the app flips immediately, with no relaunch.
- [ ] Walk Today → Library → a range page (all three tabs) → Progress → Account, and
      open a drill.
      **Expected:** everything legible; the playing-card faces stay light-on-dark-
      background readable (they must *not* invert); selected vs unselected grid cells
      stay clearly distinguishable; no black-on-black or white-on-white text; the tab
      bar and status bar match the theme.
- [ ] Switch back to **Light** mid-drill and spot-check the same screens.

## 10. Largest accessibility text size (3 min)

- [ ] **Settings → Accessibility → Display & Text Size → Larger Text** → turn on
      **Larger Accessibility Sizes** and drag the slider to the **maximum**. Return to
      the app.
- [ ] Check specifically, in this order: the bottom tab labels; Today's cards, streak
      chip and daily-goal chips; the range page header row (← Library / Practice / ⋯);
      the editor's name field and shortcut chips; the drill's two answer buttons and
      the miss-explanation line; the Account panels' buttons.
      **Expected:** nothing truncated with "…" that matters, nothing clipped at a card
      edge, nothing overlapping, nothing pushed off-screen with no way to scroll to it,
      every button still tappable. The 13×13 grid itself does not scale with text size
      — that is expected; what to eyeball there is the cell labels inside it.
- [ ] Put the text size back to your normal setting before continuing.

## 11. Narrow-screen layout (2 min)

- [ ] **If you have an iPhone SE / mini / any 4.7" device:** install 1.0.0 (5) on it
      and tap through Today, Library, a range page, the grid, and a drill.
      **Expected:** no horizontal overflow anywhere and the grid still square with
      tappable cells.
- [ ] **If you do not:** record "not tested on a small device" — do not pass it blind —
      and eyeball these on the phone you have, since they are what breaks first when
      the screen narrows: the 13×13 grid staying square with no sideways scroll and
      cells big enough to hit accurately; the range page header (← Library / Practice /
      ⋯) not colliding; the drill's two answer buttons sitting side by side without
      wrapping mid-word; Progress bars and labels staying inside their cards; a long
      range name truncating instead of shoving the row's accuracy off the edge.

## 12. Backgrounding mid-drill (2 min + wait)

- [ ] Start a recognition drill on range A and answer a few hands. While a **question**
      is on screen (not a feedback screen), swipe home or switch to another app. Wait
      **3–5 minutes**, then return to the app.
      **Expected:** you come back to the same drill, same question, same two cards,
      with your answer count intact — not a relaunch to Today. If iOS evicted the app
      and it cold-started, note that *and* whether the answers up to that point
      survived into Stats.
- [ ] Finish or `×` the drill and confirm the summary and Stats match what you answered.

## 13. Airplane mode (2 min)

- [ ] Turn on **Airplane Mode**. Then: open a range, edit its grid, run a short drill,
      open Progress, open Account.
      **Expected:** complete, unchanged functionality — no error banner, no spinner, no
      timeout, nothing greyed out. The app is entirely on-device; the only network
      feature is crash reporting, and it must not affect anything you can see.
- [ ] Leave Airplane Mode **on** through step 14, then turn it off.

## 14. Force-quit persistence (2 min)

- [ ] Open the App Switcher and swipe the app's card away to kill it. Relaunch from the
      home screen.
      **Expected:** both ranges present with their hands and metadata; range A's
      accuracy, weakest hands and session history intact; the 🔥 streak chip still on
      Today; the daily goal still 20; and **no storage-warning notice on Today** — that
      notice appearing means keys went missing between launches and is a serious find.

## 15. Backup export → destroy → restore (6 min)

On the **Account** tab the panels are **File backup** (*Back up to a file* / *Restore
from a file*) and **Practice record** (*Reset practice stats*). The guide calls these
"Export backup" / "Import backup".

- [ ] **Account → Back up to a file.**
      **Expected:** the iOS share sheet opens on `poker-ranges-backup.json`. Choose
      **Save to Files → On My iPhone** and save it, then confirm the panel shows
      "Exported your library."
- [ ] Now destroy data: **Library → Test chart B → ⋯ → Delete → confirm.** On the
      Library, **Dismiss** the undo offer — do *not* tap Undo, that would defeat the
      test. Then **Account → Reset practice stats → confirm**.
      **Expected:** range B is gone; range A survives but its accuracy, history and
      streak are cleared; Today and Progress fall back to their empty states.
- [ ] **Account → Restore from a file** → pick the saved `poker-ranges-backup.json` →
      confirm **Restore** on the "this REPLACES all your current local data" alert.
      **Expected:** "Restored 2 ranges from the file."; both ranges back in the
      Library; range A's accuracy, weakest hands and session history back with the
      **same numbers** as before; the streak and the daily goal of 20 restored.
- [ ] Try **Restore from a file** again and pick something that is not a backup (any
      other JSON or a renamed text file).
      **Expected:** an error line on the panel and **nothing changed** — no data loss,
      no crash.

## 16. Sentry crash pipeline (4 min)

- [ ] **Account** tab, scroll to the bottom.
      **Expected:** a **Diagnostics** section with a **Send test crash report** button.
      It is a section on the Account screen — there is no Account → Diagnostics
      submenu — and it renders **only** when the build carries
      `EXPO_PUBLIC_SENTRY_DSN`. **If the section is not there**, this build shipped
      without the DSN: record that as a fail for this item and stop here, there is
      nothing else to press and crash reporting is inert in the build you are testing.
- [ ] Tap **Send test crash report**.
      **Expected:** "Test report sent — it should appear in the Sentry dashboard
      within a minute."
- [ ] On sentry.io, org **<sentry-org>**, project **poker-range-trainer** → **Issues**.
      **Expected within a minute:** an event reading *"Sentry pipeline test - sent
      deliberately from the Account tab"*.
- [ ] Open the event and read the stack trace.
      **Expected: symbolicated** — readable frames naming real files and line numbers
      from the app (`DiagnosticsPanel.tsx`, `crashReporting.ts`, and native frames with
      names rather than bare addresses). If you instead see one minified bundle frame,
      `??` frames, or raw hex addresses, the source-map upload did not land for build 5
      — that is a **fail** and it has to be fixed before submitting, because an
      unsymbolicated crash report tells you nothing when a real crash arrives.
- [ ] Check the event's release / dist tags name **1.0.0 (5)**.

## 17. Keep the data (upgrade path, closing note)

- [ ] Do **not** delete the app or clear its data after this pass, and keep the backup
      file you exported in step 15. The next build installed over this one is what
      verifies the upgrade path; a wiped device makes that check impossible. If step 0
      already exercised it (3 or 4 → 5), record the result there and this is just
      housekeeping.

---

## Findings

Fill this in as you go. "Result" is pass / fail / skipped / not verifiable — a blank
row means the item was not tested.

| # | Item | Result | Notes |
|---|---|---|---|
| 0 | Upgrade path branch chosen (old build → 5, or deferred) | | |
| 1 | Install and first launch | | |
| 2 | Range A: drag-paint, shortcuts, metadata, live save | | |
| 3 | Range B created | | |
| 4 | Full 20-hand recognition drill, misses, swipe answers, summary | | |
| 5 | Ending a drill: `×` records, edge-swipe dismiss, empty run records nothing | | |
| 6 | Stats tab and library row updated | | |
| 7 | Today: streak, review queue, daily goal | | |
| 8 | Progress screen and one Drill button | | |
| 9 | Dark mode / light mode, switched mid-use | | |
| 10 | Maximum Larger Text still usable | | |
| 11 | Narrow-screen layout (tested on small device? which) | | |
| 12 | Backgrounding mid-drill, returned after minutes | | |
| 13 | Airplane mode: fully functional offline | | |
| 14 | Force-quit → relaunch: nothing lost | | |
| 15 | Backup export → delete + reset → restore; bad file rejected | | |
| 16 | Sentry test crash arrives **symbolicated**, tagged 1.0.0 (5) | | |
| 17 | Data kept for the next build's upgrade check | | |

Anything that failed, crashed, or looked wrong but is not covered above:

| What happened | Where | Reproducible? |
|---|---|---|
| | | |
