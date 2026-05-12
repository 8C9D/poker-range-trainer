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
| 18 | Missing-hands review at the end of a practice session | v2 — Improved practice modes | 2026-06-05 |

With slice 17 the **v1.4 — Range library and filtering** version is fully
implemented (name search; position/action/stack/game filters; name / recently
edited / recently practiced / accuracy sorts; duplicate, archive, and favorite;
and range cards summarizing name, scenario, percent, last-practiced, and
accuracy).

**v2 — Improved practice modes** is now underway. Slice 18 added practice mode 4
("Missing hands review"): ending a session opens a review step that recaps the
session stats and lists the mistakes — hands missed (in range, answered out) and
hands wrongly included (out of range, answered in) — before the final summary is
persisted on dismiss. Still to come in v2: mode 3 ("Build from memory"), mode 5
("Timed drill"), and mode 6 ("Weakness-focused drill"). Mode 2 ("Pick the correct
action") stays deferred until the multi-action range model arrives in v2.3. The
next slice begins mode 3 with its pure range-comparison helper.

## Next slice

- **Number:** 19
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Range-comparison helper for "build from memory" practice (domain foundation)

### Prompt

You are implementing roadmap slice 19, continuing **v2 — Improved practice modes**.
Slice 18 delivered mode 4 (missing-hands review). This slice begins mode 3 ("Build
from memory"), where the user will eventually see a scenario/range name, recreate the
range on the 13×13 grid from memory, and have the app compare their answer to the
saved range.

Scope of THIS slice (foundation only): add the pure domain helper that compares a
user-built set of hands against a target range and reports what they got right, what
they missed, and what they added by mistake. Do NOT build the build-from-memory UI
flow, a grid inside practice mode, or a practice-mode selector in this slice — those
come in the next slice(s). This mirrors how slice 13 landed the per-range-stats
foundation before its UI, and how slice 18 added a pure reducer first. Keeping the
comparison pure and tested first makes the later UI slice small and low-risk.

Context (read these before starting):
- `src/domain/practice.ts` holds the pure practice reducers (`isHandInRange`,
  `createPracticeAttempt`, `summarizePracticeAttempts`, `reviewSessionMistakes`,
  `getRandomPracticeHand`). The new helper belongs here, beside `reviewSessionMistakes`,
  since it is another pure reduction over hands. It already imports `normalizeRangeHands`
  from `./rangeMath` and `type PokerHand` from `./pokerHands` — no new imports needed.
- `src/domain/rangeMath.ts` — `normalizeRangeHands(hands)` validates each hand (throwing
  on an invalid one) and de-duplicates while preserving canonical 13×13 order. Use it to
  normalize BOTH inputs so duplicates and input ordering never affect the comparison and
  invalid hands are rejected the same way the rest of the domain rejects them.
- `src/domain/pokerHands.ts` — `PokerHand` type, `ALL_HANDS` canonical ordering,
  `isValidHand`.
- `src/domain/practice.test.ts` and `src/domain/rangeMath.test.ts` show the established
  pure-domain test patterns to mirror (including the invalid-hand `toThrow` assertions).

Task — add one pure domain function:
- In `src/domain/practice.ts`, add
  `compareBuiltRange(target: PokerHand[], built: PokerHand[]): { correct: PokerHand[]; missed: PokerHand[]; extra: PokerHand[] }`.
  Normalize both `target` and `built` with `normalizeRangeHands` first, then:
  - `correct` = hands in both the normalized target and built sets,
  - `missed` = hands in target but not in built,
  - `extra` = hands in built but not in target.
  Each list is in canonical hand order (a natural consequence of iterating the
  normalized lists) and free of duplicates. Two empty inputs yield three empty arrays;
  an exact match yields every target hand in `correct` with empty `missed`/`extra`.
  Pure — no Date, no random. Add a doc comment in the same style as
  `reviewSessionMistakes`.

Tests to add (in `src/domain/practice.test.ts`):
- a `describe('compareBuiltRange', ...)` block covering:
  - an exact match → all target hands in `correct`, `missed` and `extra` empty;
  - a missed hand (in target, not built) appears only in `missed`;
  - an extra hand (in built, not target) appears only in `extra`;
  - a mix (some correct, some missed, some extra) splits into the right lists;
  - duplicates in either input do not produce duplicate output and do not change the
    result;
  - two empty inputs yield three empty arrays;
  - an invalid hand in either input throws (mirror the `isHandInRange` invalid-hand
    tests).

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY the `compareBuiltRange` reducer and its tests. Do NOT add
  the build-from-memory UI, a practice grid, a mode selector, timers, or weakness
  tracking — those are later slices.
- Keep the helper pure and in `src/domain/`; do not touch components in this slice.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add range-comparison helper for build-from-memory practice`
