# Roadmap slice progress

State file for the `roadmap-slice` skill. The skill reads this file on every
invocation to find the next slice to build, and rewrites it as part of each
committed slice. You can hand-edit the **Next slice** prompt below to steer what
gets built next — the skill uses whatever is here.

- Scope and ordering come from [`roadmap.md`](./roadmap.md).
- Project rules (validation, commit style, what's out of scope) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken in
  roadmap order — never a whole version at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline (built before this skill existed)

As of commit `f8f4e83`, these roadmap versions are complete:

- **v1** — 13×13 grid, click-to-toggle, named ranges, local save/view/edit/delete,
  practice mode, session stats.
- **v1.1** — drag-select painting, range shortcut buttons, live range percentage and
  combo counts.
- **v1.2** — range notation parser/exporter (import, export, copy, dash ranges).
- **v1.3** — optional scenario metadata and the metadata editor fields.

The next roadmap target is **v1.4 — Range library and filtering**.

## Completed slices

| # | Slice | Roadmap | Date |
|---|-------|---------|------|
| 1 | Search saved ranges by name | v1.4 — Range library and filtering | 2026-06-03 |
| 2 | Filter saved ranges by position | v1.4 — Range library and filtering | 2026-06-03 |
| 3 | Filter saved ranges by action type | v1.4 — Range library and filtering | 2026-06-03 |
| 4 | Filter saved ranges by stack depth | v1.4 — Range library and filtering | 2026-06-03 |
| 5 | Filter saved ranges by game type | v1.4 — Range library and filtering | 2026-06-03 |
| 6 | Sort saved ranges by name | v1.4 — Range library and filtering | 2026-06-05 |
| 7 | Sort saved ranges by recently edited | v1.4 — Range library and filtering | 2026-06-05 |
| 8 | Duplicate a saved range | v1.4 — Range library and filtering | 2026-06-05 |
| 9 | Archive / unarchive a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |
| 10 | Hide archived ranges by default behind a "Show archived" toggle | v1.4 — Range library and filtering | 2026-06-05 |
| 11 | Favorite / unfavorite a saved range (persisted flag) | v1.4 — Range library and filtering | 2026-06-05 |
| 12 | Filter to favorited ranges only behind a "Favorites only" toggle | v1.4 — Range library and filtering | 2026-06-05 |
| 13 | Persist per-range practice stats (type + storage foundation) | v1.4 — Range library and filtering | 2026-06-05 |
| 14 | Record finished practice sessions into per-range stats | v1.4 — Range library and filtering | 2026-06-05 |
| 15 | Show per-range practice stats (last practiced + accuracy) on library cards | v1.4 — Range library and filtering | 2026-06-05 |
| 16 | Sort saved ranges by recently practiced | v1.4 — Range library and filtering | 2026-06-05 |
| 17 | Sort saved ranges by accuracy | v1.4 — Range library and filtering | 2026-06-05 |

With slice 17 the **v1.4 — Range library and filtering** version is fully
implemented (name search; position/action/stack/game filters; name / recently
edited / recently practiced / accuracy sorts; duplicate, archive, and favorite;
and range cards summarizing name, scenario, percent, last-practiced, and
accuracy). The next roadmap target is **v2 — Improved practice modes**.

## Next slice

- **Number:** 18
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Missing-hands review at the end of a practice session

### Prompt

You are implementing roadmap slice 18, the first slice of **v2 — Improved practice
modes**. v1.4 is complete, so this slice opens v2.

Sequencing note (why this mode first): v2 lists six practice modes. Mode 1
("In-range or out-of-range") is the existing v1 mode. Mode 2 ("Pick the correct
action") needs a multi-action range data model that does not exist yet and is a
much later roadmap item (v2.3), so it is intentionally deferred — do NOT build
multi-action ranges in this slice. This slice instead delivers mode 4 ("Missing
hands review"): a purely additive end-of-session recap over the attempts the
existing binary in/out-of-range session already produces. It needs no new data
model, no timer, and no new grid flow, making it the smallest safe first step into
v2. (Modes 3 "Build from memory" and 5 "Timed drill" are good later slices.)

What "missing hands review" means here: when the user ends a practice session, before
returning to the library, show the hands they got wrong, split into two groups —
hands they **forgot** (the hand was in range but they answered "out of range") and
hands they **wrongly included** (the hand was out of range but they answered "in
range"). When there were no mistakes (all correct, or no hands answered), show a
positive "no mistakes" message instead. The final session summary is still reported
to the parent for persistence, unchanged — only now it fires when the user dismisses
the review rather than the instant they click "End Practice".

Context (read these before starting):
- `src/domain/practice.ts` holds the pure practice logic: `isHandInRange`,
  `createPracticeAttempt`, `summarizePracticeAttempts`, `getRandomPracticeHand`. The
  new helper belongs here, beside `summarizePracticeAttempts`, since it is another
  pure reduction over `PracticeAttempt[]`. It uses only built-ins — no React, no
  Date, no random.
- `src/types/practice.ts` — `PracticeAttempt` carries `hand`, `expectedInRange`,
  `userAnsweredInRange`, `correct`, `timestamp`. A "forgot" mistake is
  `expectedInRange === true && userAnsweredInRange === false`; a "wrongly included"
  mistake is `expectedInRange === false && userAnsweredInRange === true`. Every
  incorrect binary answer is exactly one of these two; correct attempts belong to
  neither. `hand` is a `PokerHand` (from `src/domain/pokerHands.ts`).
- `src/components/PracticeSession.tsx` owns session state: `currentHand`,
  `currentAttempt`, and `attempts: PracticeAttempt[]`. "End Practice" currently calls
  `onExit(summary)` directly. The `random` prop is injectable, so component tests can
  force a deterministic sequence of prompt hands (see the existing
  `PracticeSession.test.tsx` patterns) — use that to drive specific hands and answers
  through the review.
- `src/domain/practice.test.ts` and `src/components/PracticeSession.test.tsx` show the
  established test patterns to mirror (deterministic `random`, scoring assertions,
  the `onExit` summary contract).

Task — add the domain reducer, then surface a review step at session end:
- In `src/domain/practice.ts`, add
  `reviewSessionMistakes(attempts: PracticeAttempt[]): { missed: PokerHand[]; wronglyIncluded: PokerHand[] }`.
  `missed` = the hands of attempts where `expectedInRange && !userAnsweredInRange`;
  `wronglyIncluded` = the hands of attempts where `!expectedInRange && userAnsweredInRange`.
  De-duplicate each list by hand, preserving first-occurrence order (a hand can be
  drawn and answered more than once in a session, but should appear at most once in
  each review list). Correct attempts contribute to neither list; an empty input
  yields `{ missed: [], wronglyIncluded: [] }`. Pure — no Date, no random. Add a doc
  comment in the same style as `summarizePracticeAttempts`.
- In `src/components/PracticeSession.tsx`, add a `reviewing` boolean state (default
  false). Change "End Practice" to set `reviewing` true instead of calling `onExit`
  immediately. When `reviewing` is true, render a review view (a new top-level render
  branch within the session) that:
  - shows the session summary (reuse the existing total / correct / accuracy display),
  - lists the `missed` hands and the `wronglyIncluded` hands from
    `reviewSessionMistakes(attempts)` under clear headings, and
  - when both lists are empty, shows a positive "No mistakes — nice!" style message
    instead of empty lists,
  - has a button (e.g. "Back to library" / "Finish") that calls `onExit(summary)`.
  Keep all scoring/summary logic in the domain module; the component only renders the
  reducer's output. Update the component doc comment to describe the new review step.

Tests to add/update:
- `src/domain/practice.test.ts`: cover `reviewSessionMistakes` — puts a forgot hand
  (in range, answered out) in `missed`; puts a wrongly-included hand (out of range,
  answered in) in `wronglyIncluded`; excludes correct attempts from both; de-duplicates
  a repeated mistaken hand while preserving first-occurrence order; and returns two
  empty arrays for an empty input. Build `PracticeAttempt` objects directly (or via
  `createPracticeAttempt`) as the existing tests do.
- `src/components/PracticeSession.test.tsx`: drive a short session with an injected
  `random` so specific hands are prompted, answer some incorrectly, click "End
  Practice", and assert the review view lists the expected missed / wrongly-included
  hands; then assert the dismiss button calls `onExit` with the summary. Add a second
  case where every answer is correct (or there are no mistakes) and assert the
  "no mistakes" message shows and no hand is listed. Mirror the existing
  deterministic-`random` and `onExit` assertions.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: only the `reviewSessionMistakes` reducer and the end-of-session
  review view (plus tests). Do NOT add a practice-mode selector, multi-action ranges,
  timers, cumulative cross-session per-hand stats, or a separate review page — those are
  later slices/versions.
- Do NOT change the `onExit(summary)` persistence contract beyond delaying the call to the
  review's dismiss button; the reported summary stays the same.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep poker/practice logic in `src/domain/`, not in the component; keep the change small
  and reversible.

Suggested commit message:
- `feat: review missed hands at end of practice session`
