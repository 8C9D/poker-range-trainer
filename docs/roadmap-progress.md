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
| 19 | Range-comparison helper for "build from memory" practice (domain foundation) | v2 — Improved practice modes | 2026-06-06 |

With slice 17 the **v1.4 — Range library and filtering** version is fully
implemented (name search; position/action/stack/game filters; name / recently
edited / recently practiced / accuracy sorts; duplicate, archive, and favorite;
and range cards summarizing name, scenario, percent, last-practiced, and
accuracy).

**v2 — Improved practice modes** is now underway. Slice 18 added practice mode 4
("Missing hands review"): ending a session opens a review step that recaps the
session stats and lists the mistakes — hands missed (in range, answered out) and
hands wrongly included (out of range, answered in) — before the final summary is
persisted on dismiss. Slice 19 began mode 3 ("Build from memory") with its pure
domain foundation: `compareBuiltRange(target, built)` normalizes both inputs and
splits them into `correct` / `missed` / `extra` lists in canonical order. Still to
come in v2: the rest of mode 3 (the build-from-memory UI that uses
`compareBuiltRange`), mode 5 ("Timed drill"), and mode 6 ("Weakness-focused
drill"). Mode 2 ("Pick the correct action") stays deferred until the multi-action
range model arrives in v2.3. The next slice builds the build-from-memory practice
UI component on top of `compareBuiltRange`.

## Next slice

- **Number:** 20
- **Roadmap target:** v2 — Improved practice modes
- **Working title:** Build-from-memory practice component (mode 3 UI)

### Prompt

You are implementing roadmap slice 20, continuing **v2 — Improved practice modes**.
Slice 19 delivered the pure domain foundation for mode 3 ("Build from memory"):
`compareBuiltRange(target, built)` in `src/domain/practice.ts`, which normalizes both
inputs and returns `{ correct, missed, extra }` lists in canonical order. This slice
builds the build-from-memory practice **UI component** on top of that helper.

Scope of THIS slice: a new self-contained `BuildFromMemoryPractice` component that
shows a saved range's name, lets the user recreate that range on a blank 13×13 grid
from memory, and — on submit — uses `compareBuiltRange` to show what they got right,
missed, and added by mistake. Do NOT wire it into `App` and do NOT add a
practice-mode selector in this slice — routing the user to this component via a
practice-mode picker is the NEXT slice (21). Keeping the component standalone and
fully tested first (its test file imports and exercises it, so it is not dead code)
makes the wiring slice small and low-risk, mirroring how slices 13/18/19 landed
foundations before the UI that consumes them.

Context (read these before starting):
- `src/domain/practice.ts` — `compareBuiltRange(target: PokerHand[], built:
  PokerHand[]): { correct: PokerHand[]; missed: PokerHand[]; extra: PokerHand[] }`.
  Call it as `compareBuiltRange(range.hands, builtHands)`. It normalizes/validates
  internally, so just pass the saved range's hands and the user's selection.
- `src/components/HandGrid.tsx` — a CONTROLLED 13×13 grid:
  `<HandGrid selected={Set<PokerHand>} onSetSelected={(hand, shouldSelect) => …} />`.
  It always renders all 169 hand labels but pre-selects nothing, so a fresh empty
  `Set` is a blank grid — the saved range's membership is NOT revealed. Reuse it for
  the build surface; do not build a second grid.
- `src/components/PracticeSession.tsx` and `.css` — the existing mode-1 practice
  component; mirror its structure (a `<section className="practice-session">`, a
  header with the range name, an `onExit` prop, result lists rendered as `<ul>`s with
  `aria-label`s). Reuse `PracticeSession.css` class names where they fit (e.g.
  `practice-session`, `practice-header`, `practice-review`, `practice-review-group`,
  `practice-review-heading`, `practice-review-hands`, `practice-review-actions`) and
  add a small dedicated CSS file only if you need new classes.
- `src/components/HandGrid.test.tsx` and `src/components/PracticeSession.test.tsx` —
  the established React Testing Library patterns to mirror (cells are buttons whose
  accessible name is the hand, e.g. `getByRole('button', { name: 'AA' })`, with
  `aria-pressed` reflecting membership; `userEvent.setup()` + `user.click`; a local
  stateful `Harness` is NOT needed here because the component owns its own selection
  state).
- `src/types/range.ts` — `SavedRange` (has `id`, `name`, `hands`, timestamps, optional
  `metadata`).

Task — add one component (and its test + styles):
- Create `src/components/BuildFromMemoryPractice.tsx` exporting
  `BuildFromMemoryPractice({ range, onExit }: { range: SavedRange; onExit: () => void })`.
  Behavior:
  - Owns a `selected` state of type `Set<PokerHand>`, starting empty, updated through an
    idempotent `setHandSelected(hand, shouldSelect)` exactly like `App`'s handler
    (return the previous set when membership is unchanged).
  - Owns a `checked` boolean (false until the user submits). While `checked` is false,
    render: a header `Build from memory: {range.name}`, a short instruction (e.g.
    "Recreate this range on the grid from memory, then check your answer."), the
    `HandGrid` bound to `selected`, a live `{n} hands selected` count, a primary
    "Check my range" button that sets `checked` to true, and a "Back to library" button
    that calls `onExit`.
  - When `checked` is true, compute `const { correct, missed, extra } =
    compareBuiltRange(range.hands, Array.from(selected))` and render a results view:
    a score line (e.g. `You got {correct.length} of {range.hands deduped length}
    correct` — derive the target size from `correct.length + missed.length` so it is
    always consistent with the comparison), then up to three labelled lists — Correct
    (`correct`), Missed (`missed`), Added by mistake (`extra`) — each rendered only when
    non-empty as a `<ul>` with a clear `aria-label`. If `missed` and `extra` are both
    empty, show a success message (e.g. "Perfect — you rebuilt the range exactly!").
    Provide a "Try again" button (clear `selected`, set `checked` back to false) and a
    "Back to library" button (calls `onExit`).
  - Keep all comparison logic in `compareBuiltRange`; the component must not re-derive
    correct/missed/extra by hand. No randomness, no persistence, no timers.
- Add `src/components/BuildFromMemoryPractice.css` only if you introduce new classes;
  otherwise import `./PracticeSession.css`. Keep styling minimal and consistent.

Tests to add (`src/components/BuildFromMemoryPractice.test.tsx`, RTL, mirror the
existing component tests):
- renders the range name and the blank grid, and does NOT pre-select any hand (no cell
  has `aria-pressed="true"` before the user clicks);
- clicking grid cells updates the `{n} hands selected` count;
- after building an EXACT match of a small known range and clicking "Check my range",
  the success message shows and there are no Missed / Added-by-mistake lists;
- after building a partial/incorrect range, "Check my range" shows the right hands under
  Missed (in range, not built) and Added by mistake (built, not in range);
- "Try again" returns to the build view with a cleared grid;
- "Back to library" calls the `onExit` prop.

Validation (all must pass before committing):
- `npm run lint`
- `npm run test:run`
- `npm run build`

Constraints:
- Stay within this slice: ONLY the `BuildFromMemoryPractice` component, its CSS (if
  needed), and its test. Do NOT modify `App.tsx`, do NOT add a practice-mode selector,
  and do NOT add timers or weakness tracking — those are later slices (21+).
- UI in `src/components/`; reuse the existing `HandGrid` and the `compareBuiltRange`
  domain helper — do not duplicate grid or comparison logic.
- No backend, accounts, solver imports, postflop, mixed frequencies, or AI.
- Keep the change small and reversible.

Suggested commit message:
- `feat: add build-from-memory practice component`
