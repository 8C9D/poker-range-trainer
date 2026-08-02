# Manual Testing Guide

A complete, current guide to manually testing the Poker Range Trainer: how to run
it, what features exist (and what records what), what does **not** exist yet, and a
feature-by-feature checklist of what to test.

This guide reflects the app through the **full v1–v9 roadmap** — every roadmap
version is implemented (the only intentionally deferred items are the heavy v5.1
community features; see §4) — plus post-roadmap additions (range tags). The older, narrower [`manual-testing-checklist.md`](./manual-testing-checklist.md)
only covers v1–v1.3 and is superseded by this document.

---

## 1. How to run the app

The app is a **local-first** React + TypeScript + Vite SPA: everything runs in the
browser and persists to `localStorage`, with no account required. It also installs
as an offline-capable PWA and supports **optional** Supabase cloud accounts/sync
that are **off unless** configured via env vars (see
[README → Cloud sync](../README.md#cloud-sync-optional)). With cloud unconfigured —
the default for local testing — there is no backend, account, or network dependency
at all.

| Goal | Command | Notes |
|------|---------|-------|
| Install deps | `npm install` | First time only. |
| Dev server | `npm run dev` | Opens Vite, default http://localhost:5173. Hot-reloads. |
| Production build | `npm run build` | `tsc -b` typecheck + `vite build`. Must pass clean. |
| Preview the build | `npm run preview` | Serves the built `dist/` to test the real bundle. |

For day-to-day manual testing, use `npm run dev` and open the printed URL in a
browser. Use `npm run preview` when you specifically want to test the production
build.

### App layout

The UI is organized as routed screens, navigated from the left icon rail (bottom
tabs under 640px):

- **Today** (default) — the **Daily workout** card (the primary action), a review
  queue and streak, the optional daily-goal card, and (once the library covers a
  standard spot) a **Play the spot** card; **Start review** drills the due
  ranges straight through.
- **Library** — searchable, filterable rows; **New range** opens a blank editor;
  clicking a row opens that range's page.
- **Range page** — a per-range page with a header **Practice** button and a **⋯**
  overflow menu, plus tabs **Overview / Edit / Actions / Combos / Frequencies /
  Stats**.
- **Progress** — streak / 30-day / all-time tiles, a 7-day chart, library analytics,
  and weakest hands.
- **Account** — sign-in, cloud sync, and data tools (backup / pack / range
  import-export).

Practice runs as a full-screen overlay: a mode picker, then the drill, then a session
summary.

### Automated checks (run these first)

Before manual testing, confirm the automated suite is green — it covers the domain
and storage logic so manual testing can focus on the UI and wiring:

- `npm run lint`
- `npm run test:run` (943 tests across 88 files at time of writing)
- `npm run build`

If any fail, fix the root cause before manual testing — a red build means the UI
you're about to test may not reflect the source.

---

## 2. Managing test state (important)

All data lives in `localStorage` under these keys (origin = the dev/preview URL):

| Key | Holds |
|-----|-------|
| `poker-range-trainer.saved-ranges.v1` | Saved ranges — hands, scenario metadata, per-hand actions, combo selections, mixed-frequency strategies, per-hand notes, source/reference, tags, and favorite/archived flags |
| `poker-range-trainer.practice-stats.v1` | Per-range cumulative stats (attempts, accuracy, last practiced) |
| `poker-range-trainer.hand-accuracy.v1` | Per-hand accuracy (for the heatmap / weakest-hands table) |
| `poker-range-trainer.action-accuracy.v1` | Per-action accuracy (from action quizzes) |
| `poker-range-trainer.session-history.v1` | Finished-session log (per range) + streak source |
| `poker-range-trainer.review-state.v1` | Spaced-repetition schedule per range |
| `poker-range-trainer.training-goal.v1` | Daily hands goal (target, or off) |
| `poker-range-trainer.spot-accuracy.v1` | Per-spot accuracy (the weakest-spots report) |
| `poker-range-trainer.workout.v1` | When the daily workout was last completed |

**To reset to a clean slate:** open DevTools → Application → Local Storage and
delete those keys (or "Clear site data"), then reload. An incognito/private window
is the easiest fully-clean environment.

> **Cloud note:** the nine keys above are the whole story for local-only testing.
> When cloud sync is configured **and** you are signed in, a copy of your library
> also lives server-side (Supabase) and is **not** removed by clearing
> `localStorage` — use the "Delete cloud data" control for that (see §3).

**Tips for testing time-based features:**

- The app uses the **real browser clock** (`Date.now()`), not a fixed date.
- A brand-new range is **immediately "due for review"** (it has no schedule yet).
- After a recorded practice session, a range's next due date moves **at least 1 day
  out**, so it won't reappear in "Due for review" the same day. To re-test the due
  queue same-day, edit/delete the `review-state.v1` key (e.g. set a range's `dueAt`
  to a past time) and reload.

---

## 3. What features exist

### Range creation & editing (v1, v1.1, v1.2, v1.3)

- **13×13 starting-hand grid** — all 169 hands (pairs on the diagonal, suited above,
  offsuit below) in standard matrix order.
- **Click to toggle** a hand in/out of the range.
- **Drag to paint** — press an unselected hand and drag to add; press a selected hand
  and drag to remove. The first cell sets the paint mode for the whole drag.
- **Keyboard toggle** — Tab to the grid (one tab stop, not 169), move with the arrow
  keys, and press Enter/Space to toggle. Home/End jump to the ends of the row,
  Ctrl/Cmd+Home/End to the grid's corners, and PageUp/PageDown to the ends of the
  column. The multi-action grid navigates the same way.
- **Clear Selection** — empties the grid (keeps name + metadata).
- **New range** — the Library header's "New range" button opens a blank editor screen (`#/library/new`) for composing a fresh range.
- **Range shortcuts** — Add all pairs, Add 77+, Add suited broadways, Add offsuit
  broadways, Add all broadways (additive to the current selection).
- **Range notation import/export** — paste notation (`22+`, `A2s+`, `ATo+`, `KTs+`,
  `QJs`, dash ranges like `A5s-A2s`, comma lists) to set the grid; read-only "Current
  range" field shows live notation; invalid notation shows an error and leaves the
  selection unchanged.
- **Live range summary** — hands selected, combo count, % of all hands. Combos turned
  off on the Combos tab count as off, so a narrowed range reports its real size.
- **Scenario metadata** (all optional) — game type, table size, stack depth (bb),
  hero position, versus position, action type, free-form notes.
- **Tags** (optional) — free-form organization tags (e.g. "MTT") added via a text
  input and removed from their chips; blanks and case-insensitive duplicates are
  rejected.
- **Save Range / Save Changes** — save a new named range or update the one being edited in
  place; save is blocked (with a hint) until there's a name and ≥1 hand, and a bad
  stack-depth value blocks save.

### Range library (v1.4)

- **Starter ranges** — an empty library offers to add nine standard 6-max 100bb charts
  (an open for each seat, two big-blind defences, two 3-bets) in one action. They are
  ordinary editable ranges, tagged `Starter`.
- **List of saved ranges** as rows: a range thumbnail, name (★ when favorited),
  metadata chips (position, action, % of hands, plus **Due** / **Archived** and any
  tags when they apply), and a practice line (accuracy · last practiced, or "Not
  practiced"). Clicking a row opens that range's page.
- **Search** by name.
- **Filter** by position, action type, stack depth, game type, tag (the tag filter
  appears only when at least one range carries a tag).
- **Sort** by name, recently edited, recently practiced, accuracy (default = storage
  order).
- **Favorite / Unfavorite** (badge + "Favorites only" toggle).
- **Archive / Unarchive** (hidden by default behind a "Show archived" toggle).
- **Duplicate** a range into an independent copy.
- Opening a row leads to the **range page**, whose header **Practice** button, **⋯**
  overflow menu (Duplicate, Favorite, Archive, Compare…, Export JSON/CSV/SVG, Copy
  share link, Publish/Unpublish link, Delete), and tabs (Overview / Edit / Actions /
  Combos / Frequencies / Stats) hold every per-range action.

### Practice modes (v2, v2.1, v2.3, v4.2)

Clicking **Practice** on a range's page opens a **mode picker** (Today's "Start review" and the weak-hand drills skip it and go straight into recognition):

1. **Recognize hands (in/out)** — random hand shown as concrete cards; you answer with
   the range's action verb (default "In range") or "Fold", with immediate feedback +
   the expected answer. The drill runs a fixed set of hands (or until you close it),
   then ends on a **session summary** (accuracy ring, score, and streak).
2. **Build from memory** — rebuild the whole range on a blank grid, then "Check my
   range" reports correct / missed / added-by-mistake.
3. **Timed drill** — choose 30/60/120s from the picker's "Timed drill duration" select
   (default 60s), then answer as many as possible against a countdown; summary at the end.
4. **Weakness drill** — recognition loop that resurfaces hands you've missed this
   session more often.
5. **Pick the correct action** — *only shown when the range has a saved action chart.*
   Prompts a hand, you choose the action (Fold/Call/Raise/3-bet/4-bet/Jam/Mixed),
   scored against the chart.
6. **Frequency quiz** — *only shown when the range has a saved mixed-frequency chart.*
   Prompts a hand, you choose its **primary** action, scored against the
   highest-frequency action. Records nothing (like build-from-memory).
7. **Combo drill** — blocker-aware self-graded drill dealing concrete combos from the
   range (records nothing). Detailed under *Combo-level precision*.
8. **Postflop drill** — set up a flop spot and self-grade the decision (records nothing).
   Detailed under *Postflop & board-aware views*.
9. **Range vs board** — explore how the range hits a flop texture. Detailed under
   *Postflop & board-aware views*.

Plus:

- **Practice mistakes only** — the range page's **Stats** tab has a "Practice mistakes"
  button that starts a recognition session restricted to hands you've gotten wrong.

### Performance & tracking (v2.1, v2.3)

Open via the range page's **Stats** tab:

- **Accuracy heatmap** — 13×13 grid colored by per-hand accuracy (low/medium/high).
- **Per-hand accuracy table** — weakest-first: hand, accuracy %, attempts, missed,
  wrongly included.
- **Per-action accuracy table** — accuracy % and attempts per action (from action
  quizzes).
- **Session history** — newest-first list of finished sessions (date, score,
  accuracy).
- **Practice mistakes** button (when there are recorded mistakes).

### Spaced repetition (v2.2)

- The **Today** screen surfaces due ranges: a "Today's review" card with a **Start
  review** button and a "Due now" list (each row has its own **Review** button), plus
  an "All caught up" state when nothing is due.
- **Review streak** — consecutive days with at least one finished session.
- Each finished recognition/timed/weakness session advances that range's schedule by
  accuracy (low → due tomorrow, medium → hold, high → interval grows).

### Multi-action ranges (v2.3)

Open via the range page's **Actions** tab:

- **Action palette** — pick the active action (Fold/Call/Raise/3-bet/4-bet/Jam/Mixed).
- **Multi-color action grid** — click a hand to assign the active action.
- **Per-action percentages** summary.
- **Action notation** — import/export action-grouped notation (e.g.
  `Raise: 77+, AJs+` / `3-bet: AA, KK`).
- **Save actions** — persists the chart onto the range (which then unlocks the
  "Pick the correct action" quiz).

### Import / export & backup (v3, v3.2)

Split between the **Account** screen's **Data** section and the range page's **⋯** menu:

- **Export backup / Import backup** — "Export backup" downloads one dated JSON file
  holding every persisted slice (ranges, practice stats, per-hand, per-action &
  per-spot accuracy, session history, review state). "Import backup" reads such a file
  and — behind a confirm — **replaces all local data** with it. The daily-goal target
  and the day-scoped workout-completion flag are deliberately left out; they are device
  settings, not library data.
- **Per-range JSON** — the range page **⋯** menu has **Export JSON** (a versioned
  single-range envelope); the Account **Data** section has **Import range** (adds the
  file as a **new** range, never overwriting an existing one).
- **CSV** — the range page **⋯** menu has **Export CSV** (summary + hand list); the
  Account **Data** section has **Import CSV** (adds a new range from a CSV hand list).
- **SVG image** — the range page **⋯** menu has **Export SVG** (a standalone 13×13 SVG,
  cells colored by in-range / assigned action).
- **Range packs** — the Account **Data** section has **Export pack** / **Import pack**
  to move the whole library in/out as one JSON bundle.

### Sharing (v3.2, v5.1)

- **Copy share link** (range page **⋯** menu) — encodes the range into a `#range=…` URL
  fragment (no backend). Opening that link imports the range as a new local range.
- **Publish / unpublish link** (range page **⋯** menu, **requires sign-in**) —
  publishes the range to Supabase and returns a `#/r/:id` link; that link renders a
  read-only shared-range page with a **save to my library** fork.
- **Publish pack link / unpublish** (**Account** screen cloud-sync row, **requires
  sign-in**) — publishes the whole library as a `#/p/:id` pack link whose read-only
  page forks the entire pack.

### Optional accounts & cloud sync (v3) — only when configured

- Cloud is **off unless** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set
  (see README). Unconfigured, the auth panel shows only a one-line "local-only mode"
  note and none of the cloud controls appear.
- Configured: **sign up / sign in / sign out** (email/password; OAuth via Supabase).
  Signed in, a cloud-sync row appears with **Push to cloud** (uploads the whole
  library as a backup), **Pull from cloud** (downloads and **replaces** local data,
  behind a confirm), **Delete cloud data** (removes the server copy; local kept), and
  the pack publish controls.
- Deleting the Supabase **account** itself is out of scope for the client (needs
  admin privileges); only the stored cloud data is deletable here.

### Mobile & PWA (v3.1)

- Responsive layout: the 13×13 grid stays square and control rows wrap, with ≥44px
  tap targets on small screens.
- Installable PWA (web manifest + theme color) and an offline service worker. The
  service worker registers **only in a production build** (`npm run preview` or a
  deploy) — **not** under `npm run dev`.
- Swipe gestures in the recognition session: swipe **right** = in range, swipe
  **left** = out of range (the buttons remain the primary control).

### Postflop & board-aware views (v4)

- **Postflop drill** (practice mode picker) — pick a scenario, then self-grade a
  bet/check/call/raise/fold decision against a heuristic.
- **Range vs board** (practice mode picker) — enter a flop and see the range's
  made-hand / draw breakdown, with flop-texture tags.

### Combo-level precision (v4.1)

- **Edit combos** (range page **Combos** tab) — expand a hand class into its exact
  combos and toggle which are in the range (persisted per range; absence of a
  selection = all combos).
- **Combo drill** (practice mode picker) — a self-graded drill that deals blocker-aware,
  un-blocked combos against a board, honoring the range's saved combo selections.
- Blocker-aware combo counts vs a board are shown where relevant (a board card
  removes the combos it blocks).

### Mixed-frequency strategies (v4.2)

- **Edit frequencies** (range page **Frequencies** tab) — assign per-hand action
  frequencies with sliders; a read-only primary-action grid reflects them;
  import/export frequency notation.
- Practice via the **Frequency quiz** mode (see Practice modes) — offered only when
  the range has a mixed-frequency chart.

### Range comparison & provenance (v5)

- **Compare** (range page **⋯** menu → "Compare…") — pick a second range and see a
  diff grid (in A only / in B only / in both).
- **Source / reference** — the **Edit** tab records where a range came from (coach /
  course / solver sim / book / personal study) plus an optional citation; it shows on
  the range's **Overview** tab.
- **Edit notes** (range page **Edit** tab) — attach free-text notes to individual
  hands; the **Overview** tab shows a hand-notes count.

### Onboarding & analytics (v6)

- Empty-state prompts appear when there are no ranges: **Today** shows a "Welcome"
  card and the **Library** shows a "No ranges yet" card; both disappear once a range
  is saved.
- The **Progress** screen aggregates practice stats across ranges: streak / 30-day /
  all-time tiles, a 7-day bar chart, and an "Across your library" summary.

### What records what (subtle but important)

Different practice modes persist different things. Use this when verifying tracking:

| Mode | Per-range stats line | Per-hand accuracy / heatmap | Session history | Advances spaced-rep schedule | Per-action accuracy |
|------|:--:|:--:|:--:|:--:|:--:|
| Recognize (full) | ✅ | ✅ | ✅ | ✅ | — |
| Recognize (mistakes-only) | ✅ | ✅ | ✅ | ✅ | — |
| Timed drill | ✅ | ✅ | ✅ | ✅ | — |
| Weakness drill | ✅ | ✅ | ✅ | ✅ | — |
| Build from memory | — | — | — | — | — |
| Action quiz | — | — | — | — | ✅ |
| Frequency quiz (mixed) | — | — | — | — | — |

All recorders are **no-ops when zero questions were answered**, so ending a mode
immediately records nothing. Build-from-memory and the frequency quiz deliberately
record nothing (their score shape is different), and the self-graded **postflop
drill** and **combo drill** (also practice mode picker options) also record
nothing. The streak counts days with any recorded recognition/timed/weakness session.

---

## 4. What does NOT exist yet

The app now implements the full **v1–v9** roadmap. The only intentionally
**deferred** items are the heavy multi-user community features and a few solver-grade
niceties — don't test for these; confirm they're absent if anything.

**v5.1 — community / coaching (deferred; needs a multi-user backend):**
- No study groups, group leaderboards, or shared mistake review.
- No coach-created assignments.
- No comments on ranges.
- No version history for shared ranges.
- (What DOES exist from v5.1: forking a shared range or pack into your library, plus
  public/private shared range & pack links — see §3.)

**Solver-grade pieces not built:**
- No automated solver-file import or image/screenshot range extraction (OCR). Data
  comes in via JSON / CSV / range-notation / pack import and manual entry.
- The frequency quiz asks only for the **primary** action; it does not grade an
  approximate-frequency answer.

**Account / data:**
- Deleting your Supabase **account** itself (as opposed to your stored cloud data) is
  out of scope for the client — only "Delete cloud data" exists.

**Smaller gaps within scope:**
- No undo/redo in the editor.
- No bulk delete / multi-select in the library.
- Build-from-memory, the frequency quiz, and the self-graded postflop / combo drills
  do **not** feed the "Practiced N · accuracy" line, the heatmap, or the streak (see
  the records table in §3) — by design, not a bug.

---

## 5. Manual test checklist

Work top-to-bottom for a full pass, or jump to the area you changed. Start each area
from a known state (see §2).

### 5.1 Baseline

- [ ] `npm run dev` starts and the app loads with no console errors.
- [ ] `npm run lint`, `npm run test:run`, and `npm run build` all pass.
- [ ] On a clean profile, Today shows the "Welcome" card and the Library shows "No ranges yet."

### 5.2 Range editor — selection (v1, v1.1)

- [ ] The 13×13 grid renders with the correct hands (AA top-left, 22 bottom-right).
- [ ] Clicking an unselected hand selects it; clicking again deselects it.
- [ ] Press-and-drag across unselected hands selects all crossed.
- [ ] Press-and-drag starting on a selected hand deselects all crossed.
- [ ] Re-entering a hand during one drag does not flip it back and forth.
- [ ] Releasing the mouse off the grid ends the drag (later hovers don't change it).
- [ ] Dragging does not select the cell labels as text.
- [ ] Tab to a hand and press Enter/Space toggles it.
- [ ] The summary (hands / combos / % of all hands) updates live.
- [ ] Clear Selection empties the grid but keeps the name and metadata; it's disabled
      when nothing is selected.

### 5.3 Range shortcuts (v1.1)

- [ ] Buttons present: Add all pairs, Add 77+, Add suited broadways, Add offsuit
      broadways, Add all broadways.
- [ ] Add all pairs selects all 13 pairs.
- [ ] Add 77+ selects 77–AA and leaves 66 unselected.
- [ ] Add suited broadways / offsuit broadways select the expected hands.
- [ ] Add all broadways selects TT+ plus suited and offsuit broadway non-pairs.
- [ ] Shortcuts add to the current selection; re-applying one changes nothing.

### 5.4 Range notation (v1.2)

- [ ] "Current range" field is empty with no selection and updates as you
      click/drag/shortcut/load.
- [ ] Applying an exact list (`AA, KK, AKs`) selects exactly those.
- [ ] `77+`, `A2s+`, `ATo+` select the expected hands.
- [ ] Dash ranges work (`A5s-A2s`, `AJo-ATo`, `77-TT`) in either endpoint order, with
      whitespace around the dash ignored, and inside a comma list.
- [ ] Applying notation **replaces** the selection; empty notation clears it.
- [ ] Invalid notation (`AK`, `A5s-A5o`, `A5s-K5s`) shows a clear error and leaves the
      selection unchanged; a later valid apply clears the error.

### 5.5 Scenario metadata (v1.3)

- [ ] Game type / table size / position / versus / action-type dropdowns each default
      blank and list the expected options.
- [ ] Stack depth: blank is allowed; a positive number is accepted; 0/negative shows a
      validation message and keeps Save disabled; correcting it re-enables Save.
- [ ] Changing metadata never changes the selected hands or the notation.
- [ ] Saved metadata shows as chips on the range's **Overview** tab (game / table /
      stack / position vs / action, plus notes); the Library row shows a subset
      (position / action / %); a metadata-less range shows no empty labels.
- [ ] Loading a range restores every metadata field.

### 5.6 Save / load / edit / delete (v1)

- [ ] Save is disabled with a hint until there's a name **and** ≥1 hand.
- [ ] Saving a new range opens its range page on the **Edit** tab; editing an existing
      range keeps you there (button reads "Save Changes"), and a "Saved …" status line
      confirms the name.
- [ ] Editing a range on its **Edit** tab and saving updates it **in place** (no duplicate); a
      metadata-only edit also updates in place and advances "recently edited".
- [ ] The Library's "New range" button opens a blank editor (`#/library/new`) for a fresh range.
- [ ] Delete (range page **⋯** menu) removes the range and returns to the Library.
- [ ] Reload the page — saved ranges persist.

### 5.6a Starter ranges

- [ ] With the library empty, **Add starter ranges** fills it with nine charts, each
      tagged `Starter`, and the empty state disappears.
- [ ] The spot-coverage map immediately reports covered spots, and Today offers a
      workout and a review queue.
- [ ] The charts are ordinary ranges: one can be edited, renamed, and deleted.

### 5.7 Library: search / filter / sort (v1.4)

- [ ] Search narrows by name; a no-match shows the "No ranges match …" message.
- [ ] Each filter (position, action, stack depth, game type, tag) narrows correctly and
      they compose together.
- [ ] Stack-depth options reflect the depths actually saved.
- [ ] Tags added on a range's **Edit** tab show as chips on its Library row; the tag
      filter lists only tags actually saved and is absent when no range has tags.
- [ ] Sort by Name / Recently edited / Recently practiced / Accuracy reorders as
      expected; "Default order" restores storage order; never-practiced ranges sort
      last for practiced/accuracy.

### 5.8 Library: favorite / archive / duplicate (v1.4)

- [ ] Favorite (range page **⋯** menu) adds a ★ star to the Library row; the "Favorites only" filter narrows to favorites.
- [ ] Archive (range page **⋯** menu) hides the range by default; the "Show archived"
      filter reveals it with an "Archived" chip; Unarchive (**⋯** menu) restores it.
- [ ] Duplicate (range page **⋯** menu) creates an independent copy (editing one doesn't change the other).
- [ ] All four flags survive a page reload.

### 5.9 Practice — recognition + session summary (v1, v2 mode 4)

- [ ] The range page's **Practice** button opens the mode picker; choosing "Recognize
      hands" starts the session.
- [ ] A random hand is shown as cards; the two answer buttons read the range's action
      verb (default "In range") and "Fold", and give immediate correct/incorrect
      feedback with the expected answer.
- [ ] Answering locks the buttons; after a brief feedback pause it auto-advances to the
      next hand (no "Next hand" button).
- [ ] A progress bar advances as you answer.
- [ ] Completing the set (or closing with **×** "Close practice") shows the **session
      summary** — accuracy ring, "N of M correct", and streak — then **Done** returns.
- [ ] After returning, the Library row and the range's **Overview** / **Stats** tab
      show the updated practice stats.

### 5.10 Practice — build from memory (v2 mode 3)

- [ ] Shows only the range name + a blank grid.
- [ ] "Check my range" reports Correct (of N) / Missed / Added-by-mistake, with hand
      lists (or "Perfect" when exact).
- [ ] "Try again" clears the grid; "Back to library" returns.
- [ ] Confirm it records **nothing** (card stats / heatmap / history unchanged).

### 5.11 Practice — timed drill (v2 mode 5)

- [ ] The mode picker's "Timed drill duration" select offers 30s / 60s / 120s (default 60s).
- [ ] Countdown ticks down; answering flashes brief feedback and advances.
- [ ] At 0 the session is recorded and the **session summary** appears (accuracy ring +
      score); answers after time stop counting.
- [ ] **Done** returns (or **Next range** when a queue follows).

### 5.12 Practice — weakness drill (v2 mode 6)

- [ ] Recognition-style loop; hands you answer incorrectly recur noticeably more often
      as the session goes on.
- [ ] Closing with **×** (or completing the set) records the session like recognition, ending on the summary.

### 5.13 Practice — action quiz (v2.3 mode 2)

- [ ] "Pick the correct action" appears in the picker **only** for a range with a
      saved action chart (assign + save actions first — §5.16).
- [ ] Prompts a hand from the chart; choosing an action scores it with the correct
      action shown.
- [ ] Total / Correct / Accuracy update; "End quiz" records **per-action accuracy**
      only (visible in Stats), not the per-range stats line.

### 5.14 Practice mistakes only (v2.1)

- [ ] After making mistakes in a recognition session, open the range's **Stats** tab →
      "Practice mistakes" launches a recognition session restricted to missed hands.
- [ ] The button is absent when the range has no recorded mistakes.

### 5.15 Performance view (v2.1, v2.3)

- [ ] The **Stats** tab on an unpracticed range shows the empty "No practice data yet" message.
- [ ] After recognition/timed/weakness sessions: the heatmap and weakest-first
      per-hand table appear (accuracy %, attempts, missed, wrongly included).
- [ ] Session history lists finished sessions newest-first (date, score, accuracy).
- [ ] After an action quiz: the per-action accuracy table appears.
- [ ] "Close" returns to the Overview tab.

### 5.16 Multi-action editor + action notation (v2.3)

- [ ] The range page's **Actions** tab shows the palette + grid + per-action %.
- [ ] Selecting an action and clicking hands colors them; the per-action % updates.
- [ ] "Current actions" mirrors the chart as notation; applying action notation
      (`Raise: 77+` / `3-bet: AA, KK`) sets the grid; invalid input shows an error and
      leaves the chart unchanged.
- [ ] "Save actions" persists; reopening the **Actions** tab shows the saved chart and
      the Practice picker now offers "Pick the correct action".

### 5.17 Spaced repetition: due today + streak (v2.2)

- [ ] The **Today** screen's "Today's review" / "Due now" list shows never-practiced
      (and overdue) non-archived ranges; archived ranges never appear.
- [ ] "Start review" (or a "Due now" row's **Review** button) drills a due range and
      returns to Today.
- [ ] After a recorded session, the range leaves the due list (next due ≥1 day out).
- [ ] The review streak reflects consecutive days with finished sessions. (To re-test
      "due" same-day, edit `review-state.v1` per §2.)

### 5.18 Practice — frequency quiz (v4.2)

- [ ] "Frequency quiz" appears in the picker **only** for a range with a saved
      mixed-frequency chart (assign one first — §5.25).
- [ ] It prompts a hand; choosing the primary action scores it with the expected
      action shown.
- [ ] Total / Correct / Accuracy update; ending records **nothing** (see the §3
      records table).

### 5.19 Import / export files (v3, v3.2)

- [ ] The **Account** screen's **Data** section shows: Export backup, Import backup,
      Import range, Import CSV, Export pack, Import pack.
- [ ] "Export backup" downloads a dated JSON; "Import backup" confirms, then
      **replaces** all local data with the file's contents.
- [ ] Practise a few spots, export, clear site data, then import: the Progress screen's
      **Weakest spots** card comes back with the same numbers.
- [ ] The range page **⋯** menu's Export JSON / Export CSV / Export SVG each download a
      file; the Account **Data** section's "Import range" adds the JSON as a **new**
      range (no overwrite), and "Import CSV" adds a new range from a hand list.
- [ ] "Export pack" downloads the whole library; "Import pack" adds the pack's ranges.
- [ ] A malformed import file shows an alert and changes nothing.

### 5.20 Share links & published links (v3.2, v5.1)

- [ ] The range page **⋯** menu's "Copy share link" copies a `#range=…` URL; opening it
      in a clean profile imports that range as a new local range.
- [ ] (Cloud configured + signed in) The **⋯** menu's "Publish link" yields a `#/r/:id`
      link that renders a read-only page with "save to my library"; "Unpublish link"
      removes it.
- [ ] (Cloud) The **Account** screen's "Publish pack link" yields a `#/p/:id` page that
      forks the whole pack; "Unpublish pack" removes it.

### 5.21 Optional cloud accounts & sync (v3)

- [ ] With **no** Supabase env vars: the **Account** screen's Cloud section shows only
      the local-only note, and no Push / Pull / Delete / Publish controls appear.
- [ ] With env vars set (and a real Supabase project): sign up / in / out work, and
      the cloud-sync row appears when signed in.
- [ ] "Push to cloud" uploads; "Pull from cloud" confirms then **replaces** local
      data; "Delete cloud data" confirms then removes the server copy (local kept).

### 5.22 PWA & mobile (v3.1)

- [ ] On a narrow viewport the grid stays square and control rows wrap with large tap
      targets.
- [ ] In a production build (`npm run preview` / deployed — **not** dev) the app is
      installable and loads offline after the first visit.
- [ ] In recognition, swipe right = in range, swipe left = out of range; buttons still
      work.
- [ ] The browser Back button leaves an open drill or workout and returns to the screen
      underneath it (same URL), instead of navigating the app while the drill stays up.

### 5.23 Postflop & range-vs-board (v4)

- [ ] "Postflop drill" (practice mode picker) runs a self-graded bet/check/call/raise/fold
      decision against a scenario and records nothing.
- [ ] "Range vs board" (practice mode picker): entering a flop shows the made-hand /
      draw breakdown and flop-texture tags.

### 5.24 Combo-level precision (v4.1)

- [ ] The **Combos** tab expands hand classes into combos; toggling persists per range
      and survives reload (absence = all combos).
- [ ] The tab reports "N of M combos · X% of all hands", and the figure drops as combos
      are turned off. After saving, the Library row, the Overview tab, the Edit tab's
      live summary, and an exported CSV all report that same narrowed size.
- [ ] The "Combo drill" practice mode deals un-blocked, blocker-aware combos vs a board
      (self-graded; records nothing) and honors the range's saved combo selections.
- [ ] Blocker-aware combo counts vs a board look right (a board card removes the
      combos it blocks).

### 5.25 Mixed-frequency editor (v4.2)

- [ ] The **Frequencies** tab: sliders assign per-hand action frequencies; the
      read-only primary-action grid reflects them. ("Save frequencies" persists.)
- [ ] Frequency notation import/export round-trips; invalid input shows an error and
      changes nothing.
- [ ] Saving unlocks the Frequency quiz in the practice picker (§5.18).

### 5.26 Range compare, source & per-hand notes (v5)

- [ ] The range page **⋯** menu's "Compare…": picking a second range shows a diff grid
      (in A only / in B only / in both).
- [ ] The **Edit** tab's source/reference (coach / course / solver / book / personal +
      citation) saves and shows on the range's **Overview** tab.
- [ ] The **Edit** tab's per-hand notes attach to individual hands, persist, and the
      **Overview** tab shows a hand-notes count.

### 5.27 Onboarding & library analytics (v6)

- [ ] With no ranges, Today shows a "Welcome" card and the Library shows a "No ranges
      yet" card; both disappear once a range is saved.
- [ ] The **Progress** screen reflects aggregate practice stats — streak / 30-day /
      all-time tiles, a 7-day bar chart, and an "Across your library" summary.

### 5.28 Leak report by hand type (v7.0)

- [ ] **Progress** shows a "Leaks by hand type" card ranking the hand classes you miss
      most (suited connectors, offsuit broadway, …), weakest first.
- [ ] A class needs at least 3 recorded answers and at least one miss to appear;
      otherwise the card explains that instead.
- [ ] **Drill** on a row starts a recognition session restricted to the missed hands of
      that class, across every range that has them.

### 5.29 Miss explanations (v7.1)

- [ ] A wrong answer in the recognition drill adds one explanatory line under the
      feedback — the hand's class, how much of that class the range plays, and whether
      it sits on the range edge.
- [ ] A correct answer does not add the line, and the cards do not shift either way.
- [ ] A wrong answer replaces the two answer buttons with a single **Next** and stays on
      screen indefinitely; Next (or Enter) deals the following hand. The same holds in
      the spot drill.
- [ ] A correct answer still advances on its own, and the **timed** drill auto-advances
      through misses too (the clock does not stop for you).

### 5.30 Edge drill (v7.2)

- [ ] The mode picker offers **Edge drill**, which prompts only from the range boundary
      (in-range hands with an out-of-range neighbour, and vice versa).
- [ ] The option is hidden for a range with no boundary (empty, or all 169 hands).

### 5.31 Daily hands goal (v7.3)

- [ ] Today shows a goal card with a progress bar; the target (10 / 20 / 40 / 80, or
      off) persists across a reload.
- [ ] Answering hands advances the bar, and the card reports the goal as met.

### 5.32 Confidence-weighted scheduling (v7.4)

- [ ] Two ranges finished at the same session accuracy come back at different times
      when one still has stubbornly-wrong hands in its per-hand record — the shakier
      range is due sooner.

### 5.33 Spot coverage map (v8.1)

- [ ] The **Library** shows a "Spot coverage" card below the range list (hidden while
      the library is empty), opening on the table size and stack depth your ranges
      mostly declare.
- [ ] Each cell reads `covered/total` for one seat and situation; seats with no such
      spot (the big blind with the pot folded to it) show a dash.
- [ ] Tapping a cell lists its spots — covered ones link to the range that answers
      them, uncovered ones offer **Create**.
- [ ] **Create** opens the range editor with position, versus, action, table size, and
      stack depth already filled in.
- [ ] Changing the table size or stack depth redraws the map.

### 5.34 Play the spot (v8.2, v8.3, v8.5)

- [ ] **Play these spots** on the coverage card starts a drill that states a situation
      in words ("6-max, 100bb. Folded to you in the BTN.") instead of naming a range.
- [ ] **Today** shows a "Play the spot" card starting the same drill whenever the
      library covers at least one standard spot, and hides it when none is covered.
- [ ] The answer buttons use the matched range's action verb (Open / Defend / 4-bet …).
- [ ] Every answer names the chart that graded it; a miss also explains the hand.
- [ ] Playing a hand correctly can continue it into the follow-up spot — the same two
      cards, marked "Same hand — the action continues." Folding, missing, or having no
      range for the next spot deals a fresh one instead.
- [ ] Closing the drill records the run: the summary sums it and says how many ranges
      it spanned, and each range's own stats/schedule advance.
- [ ] With no range covering the chosen format, the drill explains that instead of
      dealing.

### 5.35 Accuracy by seat and action (v8.4)

- [ ] **Progress** shows a "Where you leak" card with two ranked columns — by seat and
      by action — weakest first.
- [ ] A seat/action needs at least 5 answered questions to appear; below that the card
      explains what to do instead.

### 5.36 Weakest spots (v8.6)

- [ ] After a spot session, **Progress** gains a "Weakest spots" card naming the exact
      situations you play worst, each with its record and accuracy.
- [ ] A spot needs at least 5 answered questions to appear.
- [ ] **Drill** on a row reruns the spot drill on that spot alone — it deals only that
      situation and never chains into a follow-up.

### 5.37 Daily workout (v9)

- [ ] **Today** leads with a "Daily workout" card summarizing the plan in one line
      (e.g. "20 hands · 2 reviews · 1 weak spot · free play · ~2 min");
      **Start workout** runs it.
- [ ] The run plays its parts back-to-back with a hand-off screen before each
      ("Part 2 of 3", the segment's reason); reviews come first, then weakest
      spots, then free spot play.
- [ ] Segment sizes scale with the daily goal (the goal's hands split across the
      parts, never below 5 questions each).
- [ ] One combined summary ends the run: hands answered, accuracy, what each part
      contributed, and (when a goal is set) daily-goal progress.
- [ ] Closing mid-run keeps what was answered (stats/schedules advance) and jumps
      to a summary labelled "Stopped early"; closing before any answer abandons
      without recording.
- [ ] Only a full run flips the Today card to "Done for today" (with goal
      progress) for the rest of the day; an early exit re-offers the plan.
- [ ] The plain review and Play-the-spot cards remain alongside the workout.
- [ ] With no due ranges, no weak spots, and no spot coverage, the card is hidden.

### 5.38 Persistence / data integrity

- [ ] Everything survives a page reload (ranges, stats, history, actions, schedule).
- [ ] Clearing the nine localStorage keys returns the app to a clean slate with no
      crash.
- [ ] Manually corrupting a key (e.g. set `saved-ranges.v1` to `not json`) doesn't
      crash the app — it should fall back to empty/defaults. (Storage validates and
      drops malformed data.)

---

## 6. Testing notes & gotchas

- **Local-first:** clearing browser data or switching devices loses local data
  **unless** you've exported a backup (or pushed to the cloud, when configured).
  Use "Export backup" or cloud "Push to cloud" to move data safely (see §3).
- **No same-day re-due:** by design a practiced range won't reappear in Today's "Due
  now" list until its next scheduled date; edit `review-state.v1` to force it.
- **Mode-specific recording:** if a session "didn't show up" in stats, check the
  records table in §3 — build-from-memory and action quizzes intentionally don't feed
  the per-range stats line.
- **Action quiz gating:** the action quiz is hidden until a range has a saved action
  chart with ≥1 assigned hand.
- **Empty sessions:** ending a mode without answering anything records nothing — this
  is expected.
