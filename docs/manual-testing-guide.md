# Manual Testing Guide

A complete, current guide to manually testing the Poker Range Trainer: how to run
it, what features exist (and what records what), what does **not** exist yet, and a
feature-by-feature checklist of what to test.

This guide reflects the app through **v2.3 (multi-action ranges)** — all of v1.x and
v2.x are implemented. The older, narrower [`manual-testing-checklist.md`](./manual-testing-checklist.md)
only covers v1–v1.3 and is superseded by this document.

---

## 1. How to run the app

The app is a client-only React + TypeScript + Vite SPA. There is no backend,
account, or network dependency — everything runs in the browser and persists to
`localStorage`.

| Goal | Command | Notes |
|------|---------|-------|
| Install deps | `npm install` | First time only. |
| Dev server | `npm run dev` | Opens Vite, default http://localhost:5173. Hot-reloads. |
| Production build | `npm run build` | `tsc -b` typecheck + `vite build`. Must pass clean. |
| Preview the build | `npm run preview` | Serves the built `dist/` to test the real bundle. |

For day-to-day manual testing, use `npm run dev` and open the printed URL in a
browser. Use `npm run preview` when you specifically want to test the production
build.

### Automated checks (run these first)

Before manual testing, confirm the automated suite is green — it covers the domain
and storage logic so manual testing can focus on the UI and wiring:

- `npm run lint`
- `npm run test:run` (671 tests across 38 files at time of writing)
- `npm run build`

If any fail, fix the root cause before manual testing — a red build means the UI
you're about to test may not reflect the source.

---

## 2. Managing test state (important)

All data lives in `localStorage` under these keys (origin = the dev/preview URL):

| Key | Holds |
|-----|-------|
| `poker-range-trainer.saved-ranges.v1` | Saved ranges (hands, metadata, actions, favorite/archived flags) |
| `poker-range-trainer.practice-stats.v1` | Per-range cumulative stats (attempts, accuracy, last practiced) |
| `poker-range-trainer.hand-accuracy.v1` | Per-hand accuracy (for the heatmap / weakest-hands table) |
| `poker-range-trainer.action-accuracy.v1` | Per-action accuracy (from action quizzes) |
| `poker-range-trainer.session-history.v1` | Finished-session log (per range) + streak source |
| `poker-range-trainer.review-state.v1` | Spaced-repetition schedule per range |

**To reset to a clean slate:** open DevTools → Application → Local Storage and
delete those keys (or "Clear site data"), then reload. An incognito/private window
is the easiest fully-clean environment.

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
- **Keyboard toggle** — Tab to a cell, press Enter/Space to toggle.
- **Clear Selection** — empties the grid (keeps name + metadata).
- **New Range** — resets the whole editor (name, hands, metadata).
- **Range shortcuts** — Add all pairs, Add 77+, Add suited broadways, Add offsuit
  broadways, Add all broadways (additive to the current selection).
- **Range notation import/export** — paste notation (`22+`, `A2s+`, `ATo+`, `KTs+`,
  `QJs`, dash ranges like `A5s-A2s`, comma lists) to set the grid; read-only "Current
  range" field shows live notation; invalid notation shows an error and leaves the
  selection unchanged.
- **Live range summary** — hands selected, combo count, % of all hands.
- **Scenario metadata** (all optional) — game type, table size, stack depth (bb),
  hero position, versus position, action type, free-form notes.
- **Save / Save Changes** — save a new named range or update the one being edited in
  place; save is blocked (with a hint) until there's a name and ≥1 hand, and a bad
  stack-depth value blocks save.

### Range library (v1.4)

- **List of saved ranges** as cards: name, hand/combo/percentage summary, scenario
  line, notes preview, and a practice-stats line (attempts · accuracy · last
  practiced) once practiced.
- **Search** by name.
- **Filter** by position, action type, stack depth, game type.
- **Sort** by name, recently edited, recently practiced, accuracy (default = storage
  order).
- **Favorite / Unfavorite** (badge + "Favorites only" toggle).
- **Archive / Unarchive** (hidden by default behind a "Show archived" toggle).
- **Duplicate** a range into an independent copy.
- **Load**, **Delete**, **Practice**, **Stats**, **Actions** per-card actions.

### Practice modes (v2, v2.1, v2.3)

Clicking **Practice** on a card opens a **mode picker**:

1. **Recognize hands (in/out)** — random hand, you answer "in range"/"out of range",
   immediate feedback + expected answer. Ending opens a **missing-hands review**
   (hands missed vs. wrongly included) before returning.
2. **Build from memory** — rebuild the whole range on a blank grid, then "Check my
   range" reports correct / missed / added-by-mistake.
3. **Timed drill** — pick 30/60/120s, answer as many as possible against a countdown,
   no per-answer pause; summary at the end.
4. **Weakness drill** — recognition loop that resurfaces hands you've missed this
   session more often.
5. **Pick the correct action** — *only shown when the range has a saved action chart.*
   Prompts a hand, you choose the action (Fold/Call/Raise/3-bet/4-bet/Jam/Mixed),
   scored against the chart.

Plus:

- **Practice mistakes only** — from the performance view, a recognition session
  restricted to hands you've previously gotten wrong.

### Performance & tracking (v2.1, v2.3)

Open via **Stats** on a card:

- **Accuracy heatmap** — 13×13 grid colored by per-hand accuracy (low/medium/high).
- **Per-hand accuracy table** — weakest-first: hand, accuracy %, attempts, missed,
  wrongly included.
- **Per-action accuracy table** — accuracy % and attempts per action (from action
  quizzes).
- **Session history** — newest-first list of finished sessions (date, score,
  accuracy).
- **Practice mistakes** button (when there are recorded mistakes).

### Spaced repetition (v2.2)

- **Review due ranges** button (below the editor) opens the **Due for review** queue:
  ranges due now, each with a Practice action, plus an all-caught-up empty state.
- **Review streak** — consecutive days with at least one finished session.
- Each finished recognition/timed/weakness session advances that range's schedule by
  accuracy (low → due tomorrow, medium → hold, high → interval grows).

### Multi-action ranges (v2.3)

Open via **Actions** on a card:

- **Action palette** — pick the active action (Fold/Call/Raise/3-bet/4-bet/Jam/Mixed).
- **Multi-color action grid** — click a hand to assign the active action.
- **Per-action percentages** summary.
- **Action notation** — import/export action-grouped notation (e.g.
  `Raise: 77+, AJs+` / `3-bet: AA, KK`).
- **Save actions** — persists the chart onto the range (which then unlocks the
  "Pick the correct action" quiz).

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

All recorders are **no-ops when zero questions were answered**, so ending a mode
immediately records nothing. Build-from-memory deliberately records nothing (its
score shape is different). The streak counts days with any recorded
recognition/timed/weakness session.

---

## 4. What does NOT exist yet

These are on the roadmap but **not built**. Don't test for them — confirm they're
absent if anything.

**Within reach but not started:**
- **Backup export/import** (export all data to a JSON file). The roadmap queues this
  as the first v3 slice, but it is **not implemented** — there is no export/import
  button anywhere.

**v3 — Accounts / cloud / backend:**
- No user accounts, login, or authentication.
- No server/database persistence — data is **local to one browser on one device**.
- No cross-device sync.

**v3.1 — Mobile / PWA:**
- Not an installable PWA; no offline mode, home-screen icon, or swipe gestures. (The
  layout is usable on desktop; it is not mobile-optimized.)

**v3.2 — Import/export ecosystem:**
- No JSON/CSV export, no range images, no shareable links, no public range pages, no
  range packs. (Note: range *notation* and action *notation* text import/export DO
  exist — see §3. The missing piece is file/link/pack-based sharing.)

**v4 — Postflop / advanced:**
- No board-aware or postflop ranges, no flop-texture tagging, no hand categories, no
  postflop decision practice.

**v4.1 — Combo-level precision:**
- No specific-suit combos (e.g. AhKh vs AcKc), no board/dead-card removal, no
  blocker-aware practice. Hands are tracked at the 169-class level only.

**v4.2 — Mixed frequencies:**
- No frequency sliders or probabilistic strategies. The `Mixed` action is a **single
  label**, not a 50/50 split.

**v5 / v5.1 — Solver imports & community:**
- No solver imports, range comparison/diff, per-hand notes, coaching, study groups,
  leaderboards, or comments.

**Smaller gaps within the current scope:**
- No undo/redo in the editor.
- No bulk delete / multi-select in the library.
- Build-from-memory and action quizzes do **not** feed the "Practiced N · accuracy"
  line, the heatmap, or the streak (see the records table above) — by design, not a
  bug.

---

## 5. Manual test checklist

Work top-to-bottom for a full pass, or jump to the area you changed. Start each area
from a known state (see §2).

### 5.1 Baseline

- [ ] `npm run dev` starts and the app loads with no console errors.
- [ ] `npm run lint`, `npm run test:run`, and `npm run build` all pass.
- [ ] On a clean profile, the library shows "No saved ranges yet."

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
- [ ] Saved metadata shows on the library card (game/table/stack/seats/action/notes,
      notes truncated when long); a metadata-less range shows no empty labels.
- [ ] Loading a range restores every metadata field.

### 5.6 Save / load / edit / delete (v1)

- [ ] Save is disabled with a hint until there's a name **and** ≥1 hand.
- [ ] Saving creates a card; the editor stays attached (button reads "Save Changes",
      an "Editing saved range" indicator shows the name).
- [ ] Editing a loaded range and saving updates it **in place** (no duplicate); a
      metadata-only edit also updates in place and advances "recently edited".
- [ ] New Range clears the whole editor; the active-card highlight clears.
- [ ] Delete removes the card; deleting the range being edited resets the editor.
- [ ] Reload the page — saved ranges persist.

### 5.7 Library: search / filter / sort (v1.4)

- [ ] Search narrows by name; a no-match shows the "No ranges match …" message.
- [ ] Each filter (position, action, stack depth, game type) narrows correctly and
      they compose together.
- [ ] Stack-depth options reflect the depths actually saved.
- [ ] Sort by Name / Recently edited / Recently practiced / Accuracy reorders as
      expected; "Default order" restores storage order; never-practiced ranges sort
      last for practiced/accuracy.

### 5.8 Library: favorite / archive / duplicate (v1.4)

- [ ] Favorite toggles a "Favorite" badge; "Favorites only" narrows to favorites.
- [ ] Archive hides the range by default; "Show archived" reveals it with an
      "Archived" badge and an Unarchive button.
- [ ] Duplicate creates an independent copy (editing one doesn't change the other).
- [ ] All four flags survive a page reload.

### 5.9 Practice — recognition + missing-hands review (v1, v2 mode 4)

- [ ] Practice opens the mode picker; choosing "Recognize hands" starts the session.
- [ ] A random hand is shown; "In range" / "Out of range" give immediate
      correct/incorrect feedback with the expected answer.
- [ ] The same hand can't be answered twice; "Next hand" advances and re-enables.
- [ ] Total / Correct / Accuracy update.
- [ ] "End Practice" shows the review (missed vs. wrongly-included hands, or "No
      mistakes — nice!"), then "Back to library" returns.
- [ ] After returning, the card shows the updated practice-stats line (and Stats
      reflects the session).

### 5.10 Practice — build from memory (v2 mode 3)

- [ ] Shows only the range name + a blank grid.
- [ ] "Check my range" reports Correct (of N) / Missed / Added-by-mistake, with hand
      lists (or "Perfect" when exact).
- [ ] "Try again" clears the grid; "Back to library" returns.
- [ ] Confirm it records **nothing** (card stats / heatmap / history unchanged).

### 5.11 Practice — timed drill (v2 mode 5)

- [ ] Offers 30s / 60s / 120s.
- [ ] Countdown ticks down; answering advances immediately with no feedback pause.
- [ ] At 0 the summary appears (total / correct / accuracy); answers after time stop
      counting.
- [ ] "New drill" returns to duration choice; "Back to library" records the session.

### 5.12 Practice — weakness drill (v2 mode 6)

- [ ] Recognition-style loop; hands you answer incorrectly recur noticeably more often
      as the session goes on.
- [ ] "End practice" records the session like recognition.

### 5.13 Practice — action quiz (v2.3 mode 2)

- [ ] "Pick the correct action" appears in the picker **only** for a range with a
      saved action chart (assign + save actions first — §5.16).
- [ ] Prompts a hand from the chart; choosing an action scores it with the correct
      action shown.
- [ ] Total / Correct / Accuracy update; "End quiz" records **per-action accuracy**
      only (visible in Stats), not the per-range stats line.

### 5.14 Practice mistakes only (v2.1)

- [ ] After making mistakes in a recognition session, open Stats → "Practice
      mistakes" launches a recognition session restricted to missed hands.
- [ ] The button is absent when the range has no recorded mistakes.

### 5.15 Performance view (v2.1, v2.3)

- [ ] Stats on an unpracticed range shows the empty "No practice data yet" message.
- [ ] After recognition/timed/weakness sessions: the heatmap and weakest-first
      per-hand table appear (accuracy %, attempts, missed, wrongly included).
- [ ] Session history lists finished sessions newest-first (date, score, accuracy).
- [ ] After an action quiz: the per-action accuracy table appears.
- [ ] "Back to library" returns.

### 5.16 Multi-action editor + action notation (v2.3)

- [ ] Actions on a card opens the editor with the palette + grid + per-action %.
- [ ] Selecting an action and clicking hands colors them; the per-action % updates.
- [ ] "Current actions" mirrors the chart as notation; applying action notation
      (`Raise: 77+` / `3-bet: AA, KK`) sets the grid; invalid input shows an error and
      leaves the chart unchanged.
- [ ] "Save actions" persists; reopening Actions shows the saved chart and the
      Practice picker now offers "Pick the correct action".

### 5.17 Spaced repetition: due today + streak (v2.2)

- [ ] "Review due ranges" lists never-practiced (and overdue) non-archived ranges;
      archived ranges never appear.
- [ ] Practicing a due range from the queue works and returns to the library.
- [ ] After a recorded session, the range leaves the due list (next due ≥1 day out).
- [ ] The review streak reflects consecutive days with finished sessions. (To re-test
      "due" same-day, edit `review-state.v1` per §2.)

### 5.18 Persistence / data integrity

- [ ] Everything survives a page reload (ranges, stats, history, actions, schedule).
- [ ] Clearing the six localStorage keys returns the app to a clean slate with no
      crash.
- [ ] Manually corrupting a key (e.g. set `saved-ranges.v1` to `not json`) doesn't
      crash the app — it should fall back to empty/defaults. (Storage validates and
      drops malformed data.)

---

## 6. Testing notes & gotchas

- **Local-only:** clearing browser data or switching browsers/devices loses
  everything — there is no sync or backup yet (see §4).
- **No same-day re-due:** by design a practiced range won't reappear in "Due for
  review" until its next scheduled date; edit `review-state.v1` to force it.
- **Mode-specific recording:** if a session "didn't show up" in stats, check the
  records table in §3 — build-from-memory and action quizzes intentionally don't feed
  the per-range stats line.
- **Action quiz gating:** the action quiz is hidden until a range has a saved action
  chart with ≥1 assigned hand.
- **Empty sessions:** ending a mode without answering anything records nothing — this
  is expected.
