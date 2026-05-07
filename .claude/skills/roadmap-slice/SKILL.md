---
name: roadmap-slice
description: Implement the next poker-range-trainer roadmap slice (or a specific one via a slice number), validate it, commit and push it, and queue the prompt for the slice after it. Use when the user wants to advance docs/roadmap.md one small, committed slice at a time.
---

# roadmap-slice

Advance the roadmap by exactly one slice: read the queued plan, build it, validate
it, commit and push it, and write the prompt for the next slice so a later invocation
can continue. One slice per invocation.

A **slice** is one small, focused, reversible, commit-sized unit of work taken in
roadmap order — never a whole roadmap version at once. Each slice produces exactly
one commit, pushes it, and advances the pointer to the next slice.

## Inputs

Optional slice number in the args (e.g. `/roadmap-slice`, `/roadmap-slice 3`,
`/roadmap-slice --slice 3`). Parse the first integer in the args as the target
slice number. If there is no integer, the target is the next pending slice recorded
in the state file.

## Key files

- `docs/roadmap-progress.md` — **state file**. Holds the baseline, the completed-
  slice log, and the full prompt for the next slice. Read it first; rewrite it as
  part of a successful slice. This is the file referenced on every invocation. The
  full text of any past slice prompt is recoverable from this file's git history.
- `docs/roadmap.md` — source roadmap; defines slice scope and ordering.
- `CLAUDE.md` — project rules you must obey (validation commands, commit policy,
  separation of concerns, what is out of scope).

## Procedure

Do these in order. If a step cannot complete, stop and report honestly — never fake
progress, never commit broken work, never advance the pointer past a slice that did
not pass validation.

1. **Load context.** Read `CLAUDE.md`, `docs/roadmap.md`, and
   `docs/roadmap-progress.md`. If the state file is missing, bootstrap it (see
   Bootstrap below) before continuing.

2. **Pick the target slice.**
   - No number in args → the **Next slice** recorded in the state file.
   - Number N given:
     - N is the next pending slice → proceed.
     - N is already in the completed log → do not silently rebuild it. Report its
       status and ask the user to confirm a redo before doing anything.
     - N is several slices ahead of the next pending one → warn that slices are
       sequential and dependencies may be missing; ask whether to build the next
       pending slice instead or proceed with N anyway.

3. **Pre-flight.** Run `git status` and `git branch --show-current`.
   - You must be on `main` (per `CLAUDE.md`). If not, stop and report.
   - The working tree must be clean. If there are unrelated uncommitted changes,
     stop and report — do not fold them into the slice commit.

4. **Re-check the plan.** Skim the relevant roadmap section and the current code for
   the target slice. If the codebase already implements it, do not rebuild — mark it
   done in the log, regenerate the Next slice prompt, commit and push that
   bookkeeping, and report. Otherwise turn the queued prompt into a concrete, minimal
   plan: the exact files to create/modify and the tests to add.

5. **Implement the slice.** Keep it small, focused, and reversible — one coherent
   unit, never a whole roadmap version. Follow `CLAUDE.md` structure: poker logic in
   `src/domain/`, storage in `src/storage/`, shared types in `src/types/`, UI in
   `src/components/`. Add or update tests for any core domain logic the slice
   touches. Stay inside the current roadmap scope — do not pull in backend, accounts,
   solver imports, postflop boards, mixed frequencies, or AI features unless the
   slice itself is that roadmap item.

6. **Validate.** Run, in order:
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`

   If any fail, diagnose and fix the root cause, then re-run from the top of this
   step. Continue only once all three pass. If you cannot get them green, stop, leave
   the work uncommitted, and report what failed — do not commit, do not push, and do
   not advance the pointer.

7. **Update the state file** (`docs/roadmap-progress.md`):
   - Move the just-built slice into the **Completed slices** log (number, title,
     roadmap reference, today's date).
   - Generate the **Next slice**: pick the next small unit in roadmap order, give it
     the next sequential number and a working title, and write a complete,
     self-contained implementation prompt for it (context, task, exact files to
     touch, tests to add, the three validation commands, constraints, suggested
     commit message). Match the style of the prompt already in the file.

8. **Commit and push.** Stage the implementation, its tests, and the updated state
   file, and commit them together as one slice commit. Use a conventional message
   (`feat:`, `fix:`, `refactor:`, `docs:` …) describing the slice, ending with:

   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```

   Then push the commit to the tracked remote (`git push`). The user has standing
   authorization to push after every commit, so no extra confirmation is needed. If
   the current branch has no upstream yet, set it (`git push -u origin main`). If the
   push fails (auth, network, or a non-fast-forward), do **not** force it — leave the
   commit in place and report the failure honestly so it can be resolved.

9. **Report.** Summarize: which slice was built, the files changed, the validation
   results (state them honestly), the commit hash, whether the push succeeded, and the
   number + title of the slice now queued for the next invocation.

## Bootstrap (state file missing)

If `docs/roadmap-progress.md` does not exist, create it before implementing:

- Read `docs/roadmap.md`, `CLAUDE.md`, the acceptance reviews in `docs/`, the git
  log, and the codebase to determine how far the roadmap is already implemented.
- Record that as the **Baseline** and identify the next roadmap target.
- Write the first **Next slice** prompt (slice number 1) for the smallest safe next
  unit, then continue the procedure from step 3.

## Guardrails

- One slice = one invocation = one commit. Never batch multiple slices.
- Never claim lint / tests / build passed unless they actually ran and passed.
- Never advance the Next slice pointer past work that did not pass validation.
- Stay on `main`. Push after the slice commit succeeds (standing user authorization);
  never force-push.
- Respect `CLAUDE.md` scope — keep changes small, and do not build out-of-scope
  features early.
- If anything is ambiguous or blocked, stop and ask rather than guessing.
