# iOS roadmap slice progress

State file for the [`build-ios-app`](../.claude/skills/build-ios-app/SKILL.md)
skill. The skill reads this file on every invocation to find the next slice to
build, and rewrites it as part of each committed slice. You can hand-edit the
**Next slice** prompt below to steer what gets built next — the skill uses
whatever is here.

- Scope and ordering come from [`ios-roadmap.md`](./ios-roadmap.md).
- Project rules (validation, commit style, separation of concerns) come from
  [`../CLAUDE.md`](../CLAUDE.md).
- This is a **separate track** from the web roadmap's
  [`roadmap-progress.md`](./roadmap-progress.md); the two never collide.
- The full text of any past slice prompt is recoverable from this file's git
  history (each slice commit rewrites the **Next slice** section).

## Slice model

- A **slice** is one small, focused, reversible, commit-sized unit of work taken
  in milestone order — never a whole milestone at once.
- Each slice produces exactly one commit and advances the **Next slice** pointer.
- Slice numbers are sequential integers, assigned by the skill, never reused.

## Baseline

Nothing built yet. The web app (`src/`) is complete through web-roadmap v6 and is
the source of the reusable `@core` logic. The iOS app does not exist; `mobile/`
has not been created.

The first target is **M0 — Foundation: Expo app + shared-core reuse**.

## Completed slices

| # | Slice | Milestone | Date |
|---|-------|-----------|------|
| 1 | Scaffold Expo app in `mobile/` with isolated toolchain | M0 | 2026-06-13 |
| 2 | Wire `@core/*` alias + bundle-check; prove shared-core reuse bundles | M0 | 2026-06-13 |
| 3 | Synchronous `localStorage` shim over MMKV (+ `@core/storage` round-trip test) | M1 | 2026-06-13 |
| 4 | Hermes `crypto.randomUUID` polyfill for identity, installed at entry | M1 | 2026-06-13 |
| 5 | Storage parity test: web keys + full backup round-trip through the shim | M1 | 2026-06-13 |
| 6 | Dark theme tokens + themed navigation shell | M2 | 2026-06-14 |
| 7 | 13×13 tap-to-toggle `HandGrid`/`HandCell` reusing the core matrix | M2 | 2026-06-14 |
| 8 | Drag-paint `HandGrid` via gesture handler (+ fix react/renderer version skew) | M2 | 2026-06-14 |
| 9 | Range editor screen: name + grid + live save via `@core` storage | M2 | 2026-06-14 |
| 10 | Range library screen: list / open / edit / delete (home screen) | M2 | 2026-06-14 |
| 11 | Recognition practice screen + session stats (completes M2) | M2 | 2026-06-14 |
| 12 | Live hand/combo/percentage stats bar in the range editor | M3 | 2026-06-14 |
| 13 | Range shortcut buttons (pairs / broadways) in the editor | M3 | 2026-06-14 |

## Next slice

**Slice 14 — Notation import/export (clipboard) + clear-range in the editor (closes M3)**

Milestone: M3 — Range power tools (web v1.1–v1.2). **Last M3 slice**; slice 15 opens M4.

Context: the editor has the grid, live stats, shortcuts, and live save. This slice
adds range-notation interchange (copy/paste) and a clear-range action, reusing the
tested notation domain. After this, M3 is done.

Reuse (verified, import — never copy) from `@core/domain/rangeNotation`:
`formatRangeNotation(hands: PokerHand[]): string` (selection → canonical notation)
and `parseRangeNotation(input: string): PokerHand[]` (notation → hands; **throws**
on invalid input — empty string parses to `[]`). The web panel
(`src/components/RangeNotation.tsx`) mirrors the live selection read-only and
"Apply" REPLACES the whole selection (`onReplaceHands`), surfacing the parser's
error message on failure and leaving the selection untouched.

New dependency: `npx expo install expo-clipboard` (native module; JS bundles via
`expo export`). API: `import * as Clipboard from 'expo-clipboard'` →
`await Clipboard.setStringAsync(text)`, `await Clipboard.getStringAsync()`.

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Create `mobile/components/RangeNotation.tsx`:
  - Props: `selectedHands: PokerHand[]`, `onReplaceHands: (hands: PokerHand[]) =>
    void`.
  - Read-only current notation (`formatRangeNotation(selectedHands)`,
    `testID="notation-current"`) + a "Copy" button
    (`Clipboard.setStringAsync(currentNotation)`, `testID="notation-copy"`).
  - A `TextInput` (`testID="notation-input"`) + "Paste" button
    (`testID="notation-paste"`, fills input via `Clipboard.getStringAsync()`) +
    "Apply" button (`testID="notation-apply"`): on Apply, `try
    parseRangeNotation(input)` → `onReplaceHands(...)` and clear any error; on throw,
    show the message (`testID="notation-error"`) and leave the selection untouched.
- Wire into `mobile/app/editor.tsx`: `onReplaceHands = (hands) => setSelected(new
  Set(hands))`; render `<RangeNotation selectedHands={[...selected]}
  onReplaceHands={onReplaceHands} />`. Add a **Clear range** button
  (`testID="clear-range"`) that calls `setSelected(new Set())` (confirm via
  `Alert.alert` if the selection is non-empty — optional but nicer). Live save
  persists all of these.
- Tests:
  - `mobile/__tests__/range-notation.test.tsx`: mock `expo-clipboard`
    (`setStringAsync`/`getStringAsync` as `jest.fn()`s; manual mock or inline). (a)
    Render with `selectedHands=['AA','KK']`; assert `notation-current` shows
    `formatRangeNotation(['AA','KK'])`. (b) Press Copy; assert `setStringAsync`
    called with that string. (c) Type valid notation (`fireEvent.changeText`) and
    press Apply; assert `onReplaceHands` called with `parseRangeNotation(input)`. (d)
    Type invalid notation, press Apply; assert `notation-error` appears and
    `onReplaceHands` was NOT called.
  - Optionally extend `editor-screen.test.tsx` for clear-range (press clear → saved
    range hands become empty).

Files: create `mobile/components/RangeNotation.tsx`,
`mobile/__tests__/range-notation.test.tsx`; modify `mobile/app/editor.tsx`,
`mobile/package.json` + `mobile/package-lock.json` (expo-clipboard). No `src/` edits.

Validation (mobile only): run `npm install` first (new dep), then `npm run lint`,
`npm run typecheck`, `npm run test:run`, `npm run bundle-check` — all must pass
(confirm expo-clipboard is in the iOS bundle graph).

Constraints: reuse `@core/domain/rangeNotation` for ALL parse/format (no hand-rolled
notation); UI in `mobile/components/`; editor stays controlled. If the slice is too
big, land notation copy/paste/apply first and clear-range as a tiny follow-up — but
prefer both. Do not edit `src/`.

Suggested commit message:
`feat(ios): add range notation import/export and clear to the editor`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

Milestone: M2 — Core trainer MVP (parity with web v1). This is the **last M2
slice**: with it the full v1 loop (create → save → edit → delete → practice) runs on
device. The next slice (12) opens M3.

Context: the library (`mobile/app/index.tsx`) lists ranges and opens the editor.
This slice adds recognition practice for one saved range, reusing the tested
practice domain — no scoring logic is reimplemented.

Reuse (verified, import — never copy):
- `@core/storage/rangeStorage`: `findSavedRangeById(id)`.
- `@core/domain/practice`:
  - `getRandomPracticeHand(random?: () => number): PokerHand` — the next prompt.
  - `createPracticeAttempt(hand, rangeHands, userAnsweredInRange, timestamp?):
    PracticeAttempt` — scores one answer (`{ hand, expectedInRange,
    userAnsweredInRange, correct, timestamp }`).
  - `summarizePracticeAttempts(attempts): PracticeSessionSummary` —
    `{ totalQuestions, correctAnswers, accuracyPercentage }`.
- Types in `@core/types/practice` (`PracticeAttempt`, `PracticeSessionSummary`).

Task (mobile-only; reuse `@core`, do not edit `src/`):
- Add `mobile/app/practice.tsx` (Expo Router screen):
  - Read `id` via `useLocalSearchParams`; load the range with `findSavedRangeById`.
    If missing, render a themed "Range not found" state.
  - State: the current prompt hand (init via `getRandomPracticeHand()`), the
    `PracticeAttempt[]` for the session. Show the current hand large
    (`testID="practice-hand"`), and two buttons: "In range" (`testID="answer-in"`)
    and "Out of range" (`testID="answer-out"`).
  - On answer: `createPracticeAttempt(hand, range.hands, answeredInRange)`, append to
    attempts, show **immediate feedback** (correct vs. the expected membership,
    `testID="feedback"`), then advance to the next `getRandomPracticeHand()`.
  - Session stats from `summarizePracticeAttempts(attempts)`: show total, correct,
    accuracy % (`testID`s e.g. `stat-total`, `stat-correct`, `stat-accuracy`).
  - Header title via `<Stack.Screen options={{ title: 'Practice' }}>`; themed.
- Entry point: on each library row (`mobile/app/index.tsx`) add a "Practice" action
  (`Link`/`router.push` to `/practice?id=<id>`, `testID="practice-<id>"`) alongside
  the existing edit/delete. Update `library-screen.test.tsx` if its row assertions
  change.
- Test `mobile/__tests__/practice-screen.test.tsx`: install the storage shim (MMKV
  mock); mock `expo-router` (`useLocalSearchParams` → `{ id: 'r1' }`, `Stack.Screen`
  → null). Seed a range whose hands are **all 169** (so every prompt is in range —
  deterministic without controlling random): e.g. `saveSavedRange({ id:'r1', …,
  hands: generateHandMatrix().flat() })`. Render, press "In range", and assert the
  feedback shows correct and `summarizePracticeAttempts`-backed stats read total 1 /
  correct 1 / accuracy 100%. Then press "Out of range" and assert that answer is
  marked incorrect and totals advance. (RNTL v14 — `await render`; use `waitFor` for
  post-press assertions.)

Files: create `mobile/app/practice.tsx`, `mobile/__tests__/practice-screen.test.tsx`;
modify `mobile/app/index.tsx` (per-row Practice link) and possibly
`mobile/__tests__/library-screen.test.tsx`. No `src/` edits, no new dependency.

Validation (mobile only): `npm run lint`, `npm run typecheck`, `npm run test:run`,
`npm run bundle-check` — all must pass.

Constraints: reuse `@core/domain/practice` for ALL scoring/draw logic (no
reimplementation); screens in `mobile/app/`. Keep session stats in component state
(persisted per-range history is a later M-slice). Do not edit `src/`.

Suggested commit message:
`feat(ios): add recognition practice screen reusing @core practice domain`

(End with the standard `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)
