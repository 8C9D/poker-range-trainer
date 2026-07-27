# Poker Range Trainer Roadmap

## Project vision

Build a poker range trainer where users can create, save, edit, and practice against poker hand ranges.

The app should help users internalize preflop and postflop ranges through repeated practice, visual feedback, performance tracking, and progressively more realistic training modes.

The final product should feel like a serious study tool: fast range creation, clean visual range grids, saved scenarios, mistake review, spaced repetition, analytics, and optional advanced poker logic.

---

## Core product loop

1. User creates or imports a poker range.
2. User saves the range under a meaningful scenario, such as:
   - Button open
   - Small blind 3-bet vs button
   - Big blind defend vs cutoff
   - Flop c-bet range on A-high board
3. User practices identifying whether a hand belongs in that range.
4. The app gives instant feedback.
5. The app tracks mistakes and weak spots.
6. The user reviews and improves over time.

---

## Key assumptions

- Start as a web app.
- Focus first on Texas Hold’em.
- Start with preflop ranges before adding postflop complexity.
- Start with local persistence or simple backend persistence, then evolve to accounts and cloud sync.
- Training should be useful even without poker solver integration.
- The first version should prioritize correctness, speed, and a clean hand-grid UI.

---

# Version roadmap

## v1: Minimum viable range trainer

Goal: Let a user create a preflop poker range, save it, and practice whether random hands are inside or outside the range.

### Features

- 13x13 poker hand matrix:
  - Pairs: AA through 22
  - Suited hands: AKs through 32s
  - Offsuit hands: AKo through 32o
- Click-to-toggle hand selection.
- Basic visual states:
  - Unselected
  - Selected
- Range name field.
- Save range locally.
- View saved ranges.
- Edit saved ranges.
- Delete saved ranges.
- Practice mode:
  - Choose one saved range.
  - App shows one random hand at a time.
  - User answers “in range” or “out of range.”
  - App gives immediate correct/incorrect feedback.
- Basic session stats:
  - Total questions
  - Correct answers
  - Accuracy percentage

### Data model

```ts
type PokerHand = string; // Example: "AKs", "AQo", "TT"

type Range = {
  id: string;
  name: string;
  hands: PokerHand[];
  createdAt: string;
  updatedAt: string;
};

type PracticeAttempt = {
  hand: PokerHand;
  expectedInRange: boolean;
  userAnsweredInRange: boolean;
  correct: boolean;
  timestamp: string;
};
```

### Success criteria

- User can create a range in under 1 minute.
- User can save, reopen, edit, and delete a range.
- Practice mode works reliably.
- App is useful even without accounts or backend.
- No advanced poker abstractions yet.

---

## v1.1: Better range creation UX

Goal: Make range building faster and less tedious.

### Features

- Drag-select on the 13x13 grid.
- Click-and-drag to add/remove multiple hands.
- Clear range button.
- Select all pairs.
- Select all suited Broadway hands.
- Select all offsuit Broadway hands.
- Select pocket pairs above a threshold:
  - Example: 77+
- Select suited aces above a threshold:
  - Example: A5s+
- Text summary of range:
  - Example: `22+, A2s+, KTs+, QJs, ATo+, KQo`
- Range percentage display:
  - Example: “18.1% of hands”
- Visual hand-combo count:
  - Example: “240 combos”

### Success criteria

- User can build common ranges quickly.
- Range percentage and combo count update live.
- Existing v1 data still works.

---

## v1.2: Range notation parser and exporter

Goal: Let users type, paste, export, and share ranges using poker notation.

### Features

- Input box for range notation.
- Parse common notation:
  - `22+`
  - `A2s+`
  - `ATo+`
  - `KTs+`
  - `QJs`
  - `AK`
  - `A5s-A2s`
- Export selected grid as notation.
- Copy range notation to clipboard.
- Validation errors for invalid notation.
- Import range from text.
- Preserve manual grid editing after import.

### Success criteria

- User can paste a common range string and see it appear on the grid.
- User can export any created range into readable notation.
- Parser errors are understandable.

---

## v1.3: Scenario metadata

Goal: Organize ranges by real poker situations.

### Features

Add optional metadata to saved ranges:

- Game type:
  - Cash
  - Tournament
  - Sit & Go
- Table size:
  - Heads-up
  - 6-max
  - 9-max
- Stack depth:
  - Example: 20bb, 40bb, 100bb
- Position:
  - UTG
  - HJ
  - CO
  - BTN
  - SB
  - BB
- Action type:
  - Open
  - Call
  - 3-bet
  - 4-bet
  - Defend
  - Jam
  - Call jam
- Versus position:
  - Optional opponent position
- Notes field.

### Success criteria

- Saved ranges are easier to find.
- Practice sessions can be filtered by scenario.
- App starts becoming a real study library rather than just a grid editor.

---

## v1.4: Range library and filtering

Goal: Help users manage many ranges.

### Features

- Range library page.
- Search by name.
- Filter by:
  - Position
  - Action type
  - Stack depth
  - Game type
- Sort by:
  - Recently edited
  - Recently practiced
  - Accuracy
  - Name
- Duplicate range.
- Archive range.
- Favorite range.
- Range cards with summary:
  - Name
  - Position/action
  - Percent of hands
  - Last practiced
  - Accuracy

### Success criteria

- App remains usable after the user has 50+ ranges.
- User can quickly find the range they want to practice.

---

## v2: Improved practice modes

Goal: Make training more varied and effective.

### Features

Practice modes:

1. In-range or out-of-range
   - Current v1 mode.

2. Pick the correct action
   - Example answers:
     - Fold
     - Call
     - Raise
     - 3-bet
     - Jam

3. Build from memory
   - User sees scenario name.
   - User recreates the range on the grid.
   - App compares their answer to the saved range.

4. Missing hands review
   - App shows hands the user forgot.
   - App shows hands the user incorrectly included.

5. Timed drill
   - User answers as many hands as possible in a set time.

6. Weakness-focused drill
   - App prioritizes hands the user often gets wrong.

### Success criteria

- Practice is not repetitive.
- User can train both recognition and recall.
- Weak hands appear more often.

---

## v2.1: Mistake tracking and review

Goal: Make the app help users improve instead of only quiz them.

### Features

- Track per-hand accuracy for each range.
- Track common false positives.
- Track common false negatives.
- Review mistakes after each session.
- “Practice mistakes only” mode.
- Heatmap overlay on the range grid:
  - Hands frequently answered correctly.
  - Hands frequently missed.
- Session history.
- Range-specific performance page.

### Success criteria

- User knows exactly which hands they struggle with.
- Practice is targeted instead of random.
- App becomes useful for long-term study.

---

## v2.2: Spaced repetition system

Goal: Schedule range review automatically.

### Features

- Each saved range gets a review status.
- Practice performance affects next review date.
- Easy ranges appear less often.
- Weak ranges appear more often.
- Daily review queue.
- “Due today” page.
- Streak tracking.
- Review completion history.

### Suggested review logic

Start simple:

```ts
type RangeReviewState = {
  rangeId: string;
  ease: number;
  intervalDays: number;
  dueAt: string;
  lastReviewedAt: string;
};
```

Possible rules:

- High accuracy: increase interval.
- Medium accuracy: keep interval similar.
- Low accuracy: reset interval or review tomorrow.
- Hands with repeated mistakes appear more often inside the session.

### Success criteria

- User does not need to manually choose what to study.
- The app guides daily poker study.
- Long-term retention becomes a core feature.

---

## v2.3: Multi-action ranges

Goal: Support more realistic strategy charts where hands can have different actions.

Instead of only selected/unselected, each hand can have an assigned action.

### Example actions

- Fold
- Limp
- Call
- Raise
- 3-bet
- 4-bet
- Jam
- Mixed

### Features

- Multi-color grid.
- Action palette.
- Click hand to assign selected action.
- Per-action range percentage.
- Practice mode asks:
  - “What is the correct action for AJs?”
- Action-specific accuracy tracking.
- Import/export notation with action groups.

### Data model

```ts
type RangeAction =
  | "fold"
  | "call"
  | "raise"
  | "threeBet"
  | "fourBet"
  | "jam"
  | "mixed";

type ActionRange = {
  id: string;
  name: string;
  handActions: Record<PokerHand, RangeAction>;
  metadata: RangeMetadata;
};
```

### Success criteria

- App can model actual strategy charts.
- User can practice decision-making, not just membership.

---

## v3: Accounts, cloud sync, and backend

Goal: Make the app usable across devices and protect user data.

### Features

- User accounts.
- Authentication.
- Cloud-saved ranges.
- Sync across devices.
- Server-side persistence.
- Import/export backup file.
- Account settings.
- Delete account/data export flow.
- Optional anonymous local mode.

### Backend features

- Range CRUD API.
- Practice session API.
- User statistics API.
- Review queue API.
- Authentication middleware.
- Basic rate limiting.
- Input validation.
- Database migrations.
- Automated backend tests.

### Success criteria

- User can log in on another device and see their ranges.
- Local-only users can still use the app.
- Data is not lost accidentally.

---

## v3.1: Mobile-first and PWA support

Goal: Make the trainer excellent on phones.

### Features

- Responsive 13x13 grid.
- Mobile-friendly hand selection.
- Large tap targets.
- Swipe gestures for practice answers.
- Installable PWA.
- Offline access for saved ranges.
- Offline practice sessions.
- Sync when online.
- Home screen icon.
- App-like full-screen mode.
- Mobile performance optimization.

### Success criteria

- User can practice comfortably on a phone.
- App loads quickly.
- App works during commute or offline study sessions.

---

## v3.2: Import/export ecosystem

Goal: Make the app interoperable with other poker study workflows.

### Features

- Export to JSON.
- Import from JSON.
- Export range images.
- Export CSV summary.
- Shareable range links.
- Public read-only range pages.
- Private shared range links.
- Range packs.

### Range packs

Example packs:

- 6-max cash 100bb opens
- 6-max cash 100bb 3-bets
- Tournament 20bb push/fold
- Beginner preflop fundamentals
- Custom user-created pack

### Success criteria

- Users can move data in and out safely.
- Users can share ranges with friends, coaches, or study groups.
- The app can grow beyond single-user usage.

---

## v4: Advanced poker training

Goal: Move from simple range memorization toward deeper poker decision training.

### Features

- Board-aware postflop ranges.
- Flop texture tagging:
  - A-high
  - Paired
  - Monotone
  - Rainbow
  - Connected
  - Dry
  - Wet
- Postflop scenario builder:
  - Preflop action
  - Positions
  - Board cards
  - Pot size
  - Stack depth
  - Action facing user
- Hand categories:
  - Top pair
  - Overpair
  - Draw
  - Gutshot
  - Flush draw
  - Air
- Practice postflop decisions:
  - Bet
  - Check
  - Call
  - Raise
  - Fold
- Range-vs-board visualization.
- Combo filtering by blockers and board cards.

### Success criteria

- App supports meaningful postflop study.
- User can practice board-dependent strategy.
- Preflop trainer remains fast and simple.

---

## v4.1: Combo-level precision

Goal: Represent exact card combinations, not just hand classes.

### Features

- Expand each hand class into combos:
  - Example: AKs = 4 combos
  - AKo = 12 combos
  - AA = 6 combos
- Board-card removal.
- Dead-card removal.
- Specific combo selection:
  - Example: AhKh selected but AcKc not selected.
- Combo counts adjust dynamically.
- Blocker-aware practice.
- More accurate postflop range representation.

### Success criteria

- App can handle precise strategy work.
- Board and blocker effects are correctly reflected.
- Advanced users can train at solver-chart granularity.

---

## v4.2: Mixed-frequency strategies

Goal: Support solver-like mixed actions.

### Features

- Assign action frequency per hand or combo.
- Example:
  - A5s: 50% 4-bet, 50% fold
- Frequency sliders.
- Mixed-frequency grid visualization.
- Practice mode accepts probabilistic strategy:
  - User may be asked for primary action.
  - User may be asked for approximate frequency.
- EV-neutral mixed-hand notes.
- Frequency export/import.

### Data model

```ts
type MixedAction = {
  action: RangeAction;
  frequency: number; // 0 to 100
};

type MixedStrategyRange = {
  id: string;
  name: string;
  handStrategy: Record<PokerHand, MixedAction[]>;
};
```

### Success criteria

- App can represent solver-inspired ranges.
- User can train approximations without needing perfect solver precision.

---

## v5: Solver and study-tool integrations

Goal: Let users bring in external strategy data.

### Features

- Import solver exports where feasible.
- Import chart screenshots manually through structured entry.
- Convert solver strategy into simplified practice ranges.
- Compare two ranges:
  - User range vs target range
  - Current version vs previous version
- Range diff view.
- Notes linked to specific hands.
- Attach source/reference to a range:
  - Coach
  - Course
  - Solver sim
  - Book
  - Personal study

### Possible integrations

- CSV imports.
- JSON imports.
- Clipboard text imports.
- Manual solver output mapping.
- Image-based range extraction as a future advanced feature.

### Success criteria

- Users can study real strategy material inside the app.
- The app becomes a hub for range training, not just a standalone quizzer.

---

## v5.1: Coaching, sharing, and community features

Goal: Support coaches, groups, and shared study.

### Features

- Public range packs.
- Private range packs.
- Coach-created assignments.
- Study groups.
- Group leaderboard.
- Shared mistake review.
- Comments on ranges.
- Version history for shared ranges.
- Fork a public range into personal library.

### Success criteria

- Coaches can assign range drills.
- Students can practice and report progress.
- Community content grows the app’s value.

---

## v6: Final polished product

Goal: A complete poker range study platform.

### Final feature set

- Fast range editor.
- Notation parser/exporter.
- Multi-action ranges.
- Mixed-frequency strategy support.
- Combo-level precision.
- Preflop and postflop scenario training.
- Saved range library.
- Range packs.
- Accounts and cloud sync.
- Offline-capable PWA.
- Mobile-first practice.
- Spaced repetition.
- Mistake tracking.
- Performance analytics.
- Shareable ranges.
- Coaching/study group support.
- Import/export ecosystem.
- Strong test coverage.
- Clean onboarding.
- Polished UI.
- Reliable data backup/export.

### Final product principles

- Fast enough for daily use.
- Simple enough for beginners.
- Powerful enough for serious study.
- Useful without solver data.
- Compatible with solver-inspired workflows.
- Mobile-friendly by default.
- Data should always feel safe and portable.

---

## v7: Deeper training quality

Goal: make the existing training loop measurably better at fixing leaks, rather than adding new surface area.
Chosen on 2026-07-24 over three alternatives (realistic multi-street scenarios, the deferred v5.1 community features, and an iOS polish-only pass).

Every slice below builds on data the app already stores (per-hand accuracy, action accuracy, session history, review states), stays local-first, and ships on web and mobile together.

### v7.0: Leak report by hand class

- Group recorded mistakes into poker-meaningful classes (pocket pairs, suited aces, suited connectors, offsuit broadway, offsuit trash, etc.) instead of only listing individual hands.
- Pure domain: a hand-class categorizer plus an aggregator over the stored per-hand accuracy.
- Surface the ranked classes on Progress ("you fold too many suited connectors"), each drillable.

### v7.1: Explain every miss

- After a wrong answer, say *why* in one line: the hand's class, whether the range includes its neighbours, and where it sits relative to the range edge.
- Pure domain: an explanation generator taking the hand, the range, and the attempt.
- Shown in the drill's feedback area and in the end-of-session mistake review.

### v7.2: Borderline-biased prompts

- A range's hard hands are the ones on its edge (in-range hands whose grid neighbours are out, and vice versa).
- Pure domain: an edge-distance score per hand, plus a prompt-drawing weight that mixes edge distance with the user's per-hand accuracy.
- New "Edges" drill variant, and a difficulty ramp that leans on edge hands as session accuracy rises.

### v7.3: Daily training goals

- The user sets a small daily target (hands answered and/or accuracy).
- Today shows progress toward it; the summary reports it; the streak survives a met goal.
- Local storage of the goal, pure domain for progress evaluation.

### v7.4: Confidence-weighted scheduling

- Today's schedule advances on whole-session accuracy; a range with a few stubbornly-wrong hands can look "learned".
- Fold per-hand confidence (accuracy and attempt count) into the interval so a range with weak hands comes back sooner.
- Pure extension of `spacedRepetition`, with the existing behaviour preserved when no per-hand data exists.

---

## v8: Play the spot

Goal: train the preflop *game* rather than one range at a time.
Chosen on 2026-07-25 over two alternatives (fluency/speed training and an adaptive study coach).

Every drill so far starts by picking a range.
At the table nobody hands you a range: you get a seat, an action in front of you, a stack, and a hand.
v8 inverts the loop - the app deals a spot, finds the range in your library that covers it, and grades your decision.

It builds entirely on the v1.3 scenario metadata already stored on each range (`tableSize`, `position`, `actionType`, `versusPosition`, `stackDepthBb`, `gameType`), stays local-first, and ships on web and mobile together.

### v8.0: Spot model and library matching

- Define a `Spot`: table size, hero position, the situation in front of hero (folded to you, facing an open, facing a 3-bet, facing a 4-bet, facing a jam), the villain position where one applies, and a stack depth.
- Enumerate the standard spots for a table size, so the app has a fixed vocabulary of situations to deal from.
- Match a spot against the saved library by scoring metadata alignment, returning the best-matching range and how confident the match is, or nothing when the library does not cover the spot.
- Pure domain (`src/domain/spot.ts`) plus tests. No UI in this slice.

### v8.1: Spot coverage map

- Show which standard spots the library covers and which it is missing, as a position-by-situation grid.
- A missing cell links into range creation with that spot's metadata pre-filled.
- Surfaces the real gap in a study library ("you have no BB defend vs CO") without the user having to audit it by hand.

### v8.2: The spot drill

- A practice mode that deals a random covered spot and a random hand, states the situation in plain words ("6-max, 100bb. Folded to you on the button."), and asks for the decision.
- Answers come from the matched range: its per-hand action when it has one, otherwise raise/fold membership.
- Attempts fold into the matched range's existing stats, so the spot drill feeds the same per-hand accuracy, leak report, and scheduling as every other mode.

### v8.3: Chained spots

- A spot can have a second decision: hero opens, villain 3-bets, and the same hand now faces the 3-bet.
- Continue the hand into the follow-up spot when the library covers it, and stop when it does not.
- Pure domain: given a spot and hero's action, what spot comes next.

### v8.4: Accuracy by seat and action

- Break practice results down by position and by action type, not only by range.
- Rank the weakest of each so the user learns "you leak from the small blind", which no per-range number shows.
- Cut from the per-range stats already stored (every range declares its seat and action), so the breakdown covers every drill rather than only spot sessions.

### v8.5: Play the spot from Today

- The drill is a daily training action, not a library-management one: offer it on Today whenever the library covers a spot.

### v8.6: Per-spot accuracy

- Record every spot-drill answer against the spot it was dealt from, not only against the range that graded it.
- Rank the recorded spots weakest-first and let the user drill one on its own — the most specific answer the app can give to "what should I work on".

---

## v9: The daily workout

Goal: turn "what should I train today?" into one tap.
Chosen on 2026-07-27 over two alternatives (a polish-and-hardening-only pass, and drafting several candidate scopes first).

The app now knows what is due (spaced repetition), where the user leaks (per-spot and per-hand accuracy), and how much they want to train (the daily goal) - but the user still has to assemble a session from those signals by hand, across three different cards.
v9 composes them: one guided run that reviews what is due, drills the worst spots, and finishes on fresh material, sized to the daily goal.

Every slice builds only on data the app already stores, stays local-first, and ships on web and mobile together.

### v9.0: The workout plan

- Pure domain (`src/domain/dailyWorkout.ts`): compose today's plan from the stored signals - a review segment (due ranges), a weak-spot segment (the worst recorded spots the current library still covers), and a fresh-play segment (the spot drill over the rest of the library).
- Each segment carries a plain-language reason ("3 ranges due", "42% in BB vs a CO open") so the plan reads like a coach's note, not a config dump.
- Cap the segments (and skip empty ones) so a workout stays close to the daily goal's size, and estimate its length.
- No UI in this slice; tests for the composition rules, the caps, and the empty cases.

### v9.1: The workout runner

- Today gets a "Daily workout" card as the primary action, summarizing the plan in one line.
- The run plays the segments back-to-back in the practice overlay with a "Part 2 of 3 - Weakest spots" hand-off between them; each segment records through its drill's existing recorder, so stats, schedules, and per-spot accuracy advance exactly as if the drills were run by hand.
- One combined summary ends the run: hands answered, accuracy, and what each segment contributed.

### v9.2: Workout completion

- Remember the last completed workout day; the Today card flips to a done state for the rest of the day instead of re-offering the same plan.
- The summary and the done state report daily-goal progress, so finishing the workout visibly meets the goal.
- The individual cards (review, play the spot) stay - the workout is the default path, not the only one.

---

# Suggested implementation sequence

## Phase 1: Foundation

1. Create app shell.
2. Build 13x13 hand grid.
3. Implement hand selection logic.
4. Add local range save/edit/delete.
5. Add simple practice mode.
6. Add basic stats.

Ship v1.

## Phase 2: Range creation power tools

1. Add drag-select.
2. Add range shortcuts.
3. Add range percentage and combo counts.
4. Add notation export.
5. Add notation import/parser.

Ship v1.2.

## Phase 3: Study organization

1. Add metadata.
2. Add range library.
3. Add filtering/search.
4. Add favorites/archive.
5. Add duplicate range.

Ship v1.4.

## Phase 4: Better training

1. Add multiple practice modes.
2. Add mistake tracking.
3. Add review page.
4. Add weakness-focused drills.
5. Add spaced repetition.

Ship v2.2.

## Phase 5: Strategy depth

1. Add multi-action hand states.
2. Add action-based practice.
3. Add action-specific analytics.
4. Add mixed frequencies.
5. Add combo-level precision.

Ship v4.2.

## Phase 6: Platform features

1. Add accounts.
2. Add backend persistence.
3. Add cloud sync.
4. Add mobile-first PWA support.
5. Add import/export.
6. Add shareable links and range packs.

Ship v3.2 to v5.

## Phase 7: Advanced study platform

1. Add postflop scenarios.
2. Add board-aware ranges.
3. Add solver-style imports.
4. Add range comparison.
5. Add coaching/group features.
6. Polish onboarding and analytics.

Ship v6.

---

# Recommended v1 tech approach

## Frontend

Good options:

- React + TypeScript + Vite
- Next.js + TypeScript
- SvelteKit + TypeScript

For a focused trainer, React + TypeScript + Vite is likely enough unless server rendering, accounts, or public share pages are needed immediately.

## Styling

Good options:

- Tailwind CSS
- CSS modules
- Plain CSS with design tokens

The 13x13 grid should be implemented carefully with reusable components and clear state logic.

## Persistence

Start simple:

- v1: localStorage or IndexedDB.
- v3: backend database and accounts.

For v1, localStorage is acceptable. If range data becomes larger or more structured, IndexedDB is better.

## Testing

Minimum useful tests:

- Hand grid generation.
- Poker hand ordering.
- Combo count logic.
- Range percentage calculation.
- Range notation parser.
- Practice answer correctness.
- Range save/edit/delete behavior.

---

# Suggested v1 file structure

```txt
src/
  app/
    App.tsx
  components/
    HandGrid.tsx
    HandCell.tsx
    RangeEditor.tsx
    RangeLibrary.tsx
    PracticeSession.tsx
  domain/
    pokerHands.ts
    rangeMath.ts
    rangeNotation.ts
    practice.ts
  storage/
    rangeStorage.ts
  types/
    range.ts
  tests/
    pokerHands.test.ts
    rangeMath.test.ts
    practice.test.ts
```

---

# Important implementation notes

## Hand ordering

Use standard matrix ordering:

```txt
AA AKs AQs AJs ATs A9s A8s A7s A6s A5s A4s A3s A2s
AKo KK  KQs KJs KTs K9s K8s K7s K6s K5s K4s K3s K2s
AQo KQo QQ  QJs QTs Q9s Q8s Q7s Q6s Q5s Q4s Q3s Q2s
AJo KJo QJo JJ  JTs J9s J8s J7s J6s J5s J4s J3s J2s
ATo KTo QTo JTo TT  T9s T8s T7s T6s T5s T4s T3s T2s
A9o K9o Q9o J9o T9o 99  98s 97s 96s 95s 94s 93s 92s
A8o K8o Q8o J8o T8o 98o 88  87s 86s 85s 84s 83s 82s
A7o K7o Q7o J7o T7o 97o 87o 77  76s 75s 74s 73s 72s
A6o K6o Q6o J6o T6o 96o 86o 76o 66  65s 64s 63s 62s
A5o K5o Q5o J5o T5o 95o 85o 75o 65o 55  54s 53s 52s
A4o K4o Q4o J4o T4o 94o 84o 74o 64o 54o 44  43s 42s
A3o K3o Q3o J3o T3o 93o 83o 73o 63o 53o 43o 33  32s
A2o K2o Q2o J2o T2o 92o 82o 72o 62o 52o 42o 32o 22
```

## Combo counts

- Pair: 6 combos
- Suited non-pair: 4 combos
- Offsuit non-pair: 12 combos
- Total Hold’em starting hand combos: 1,326

## Range percentage

```txt
rangePercentage = selectedCombos / 1326 * 100
```

## v1 should avoid

Do not include these in the first version unless there is extra time:

- Accounts
- Cloud sync
- Solver imports
- Postflop boards
- Mixed frequencies
- Combo-level blockers
- Payments
- Public community features
- AI range generation

These are valuable later, but they slow down the first useful version.

---

# Definition of done for v1

The first version is complete when:

- User can create a named range.
- User can select hands on a standard 13x13 grid.
- User can save the range locally.
- User can view saved ranges.
- User can edit a saved range.
- User can delete a saved range.
- User can start a practice session from a saved range.
- User can answer whether a random hand is inside or outside the range.
- User receives immediate feedback.
- User sees basic accuracy stats.
- App is responsive enough to use on desktop and reasonably usable on mobile.
- Core range and practice logic has tests.

---

# Possible future monetization

Only consider this after the core product is genuinely useful.

Potential options:

- Free local trainer.
- Paid cloud sync.
- Paid advanced analytics.
- Paid solver-import tools.
- Paid range packs.
- Coach/team accounts.
- Premium mobile offline mode.

Avoid monetization before the app has strong daily-use value.

---

# Suggested first build prompt

Use this when starting implementation with an AI coding agent:

```txt
Create a poker range trainer web app.

Build the v1 only.

Requirements:
- Use TypeScript.
- Create a standard 13x13 Texas Hold’em starting hand grid.
- Let the user click hands to toggle whether they are in the range.
- Let the user name and save ranges locally.
- Let the user view, edit, and delete saved ranges.
- Add a practice mode where the user selects a saved range and is shown random starting hands.
- For each hand, the user chooses whether it is in range or out of range.
- Show immediate feedback.
- Track total questions, correct answers, and accuracy for the current session.
- Add tests for hand grid generation, combo counting, range percentage calculation, save/edit/delete behavior, and practice answer correctness.
- Keep the implementation small, clean, and easy to extend.
- Do not add accounts, backend, solver import, postflop logic, payments, or AI features.
```
