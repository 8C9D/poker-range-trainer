---
name: build-ios-app
description: Implement EVERY remaining slice of the iOS app roadmap (docs/ios-roadmap.md) in one run by looping a per-slice procedure — one validated, committed, pushed, reversible slice at a time — until the roadmap is exhausted, a user-action checkpoint is reached (Apple account / signing / store submission), or a slice fails. This builds a React Native + Expo iOS equivalent of the existing web app under mobile/, reusing the existing src/ domain/types/cloud core. Invoking this skill IS the explicit authorization for the iOS app build (a large new scope beyond the web app), per CLAUDE.md.
---

# build-ios-app

Drive the **iOS app roadmap** to completion without stopping between slices. This
is an auto-loop, modeled on the web roadmap's `finish-roadmap`/`roadmap-slice`
discipline: run a per-slice procedure repeatedly — slice after slice — until **no
next slice remains**, a **user-action checkpoint** is hit, or a slice cannot be
completed cleanly.

The batching is only in the *invocation*. Each individual slice stays atomic:
small, focused, validated (mobile `lint` + `typecheck` + `test:run` +
`bundle-check`, plus the web trio when shared `src/` is touched — all green),
committed on its own, and pushed. A long run is therefore reversible
slice-by-slice, and stopping partway always leaves a clean, pushed state.

## What this builds

A **React Native + Expo** iOS app under `mobile/` that is a feature-equivalent of
the existing web app, by **reusing the existing TypeScript core** (`src/domain`,
`src/types`, `src/cloud`, and `src/storage` behind a shim) and re-authoring only
the UI. See [`docs/ios-roadmap.md`](../../../docs/ios-roadmap.md) for the full
strategy, the two platform seams (storage shim, cloud env), the monorepo layout,
and the milestone/slice breakdown.

### Authorization note (important)

`CLAUDE.md` scopes the default project to the web v1 trainer and says larger scope
must not be built without an explicit user request. **Invoking `build-ios-app` is
that explicit request** for the entire iOS app: a new `mobile/` Expo project, React
Native dependencies, native adapters, and reuse of the already-built cloud
features. The loop may proceed across all milestones M0–M8. This does **not** waive
the **user-action** and **design-decision** stops below — Apple accounts, bundle
identifiers, signing, and store submission are exactly where you must stop and hand
off rather than guess or fake.

## Key files

- `docs/ios-roadmap-progress.md` — **state file.** Holds the baseline, the
  completed-slice log, and the full prompt for the next slice. Read it first;
  rewrite it as part of each successful slice. Separate from the web
  `roadmap-progress.md` — never touch that one here.
- `docs/ios-roadmap.md` — source roadmap; defines milestones, slice scope, the
  reuse seams, and the validation/user-action split.
- `CLAUDE.md` — project rules (commit style, push policy, separation of concerns,
  honest reporting) that still apply.
- `mobile/` — the Expo app (created by slice 1; does not exist before then).

## Procedure

1. **Load context.** Read `CLAUDE.md`, `docs/ios-roadmap.md`, and
   `docs/ios-roadmap-progress.md`. If the state file is missing, bootstrap it (see
   Bootstrap) before continuing.

2. **Pre-flight (once).** `git status` and `git branch --show-current`. Must be on
   `main` with a clean working tree (per `CLAUDE.md`). If not, stop and report — do
   not start the loop on top of unrelated changes.

3. **Loop.** Repeat until a stop condition fires:

   a. **Next-slice check.** Read the **Next slice** block in
      `docs/ios-roadmap-progress.md`. If there is no next slice (roadmap
      exhausted) → the loop is **done**; go to step 4. Otherwise → continue.

   b. **User-action / design-decision gate.** If the queued slice requires
      something only the user can do or decide, **stop and hand off** with exact
      instructions — do not fake it, do not mark it done. This includes:
      - Apple Developer Program enrollment; choosing the **bundle identifier**.
      - `eas login`, Apple **signing** credential generation, App Store Connect app
        records, running `eas build` / `eas submit`, TestFlight distribution,
        capturing store screenshots, "Submit for Review".
      - Any non-obvious architectural/product decision the roadmap does not pin
        down (e.g. navigation library if still open, deep-link scheme/domain,
        paid vs free, app display name).

      Well-specified code/config slices proceed without asking.

   c. **Run one slice** (the per-slice procedure, steps i–vi):
      i.   **Re-check the plan** against the current code. If the slice is already
           implemented, do not rebuild — mark it done, regenerate the Next slice,
           commit and push that bookkeeping, and continue. Otherwise turn the
           queued prompt into a concrete, minimal plan (exact files + tests).
      ii.  **Implement** the slice. Keep concerns separated: reused logic comes
           from `@core/*` (→ `src/domain`, `src/types`, `src/cloud`) — **import it,
           never copy it**; native adapters go in `mobile/platform/`; screens in
           `mobile/app/`; RN UI in `mobile/components/`. Prefer adapting via the
           seams (the MMKV `localStorage` shim, the cloud env wrapper, injected
           deps) over editing core modules. If a `src/` core module genuinely must
           change, make it a tiny, behavior-preserving edit. Add or update tests
           for any logic the slice introduces (RN component tests via Jest +
           `@testing-library/react-native`; reused domain tests already exist).
      iii. **Validate (mobile).** In `mobile/`, run the headless toolchain — all
           must pass: `lint`, `typecheck` (`tsc --noEmit`), `test:run` (Jest), and
           `bundle-check` (`expo export --platform ios`, confirming the JS bundles).
           Run `npm install` in `mobile/` first if the slice added dependencies.
      iv.  **Validate (web guard).** If the slice touched anything under shared
           `src/` (including root ESLint/Vitest/tsconfig), additionally run the web
           trio from the repo root — all must pass: `npm run lint`,
           `npm run test:run`, `npm run build`. The web app must stay green.
      v.   If any validation fails, diagnose and fix the **root cause**, then re-run
           from the top of the relevant validate step. Continue only once
           everything is green. If you cannot get it green, **stop** with the work
           uncommitted and report what failed — never commit broken work, never
           claim a command passed unless it actually ran and passed.
      vi.  **Update the state file** (`docs/ios-roadmap-progress.md`): move the
           just-built slice into the **Completed slices** log (number, title,
           milestone, today's date), then generate the next **Next slice** — the
           next small unit in roadmap order, with a complete, self-contained
           implementation prompt (context, task, exact files, tests, the validation
           commands, constraints, suggested commit message). Match the style of the
           prompt already in the file.

   d. **Commit and push.** Stage the implementation, its tests, and the updated
      state file, and commit them together as **one** slice commit with a
      conventional message (`feat(ios): …`, `fix(ios): …`, `chore(ios): …`),
      ending with:

      ```
      Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
      ```

      Then `git push` to the tracked remote (standing user authorization — no extra
      confirmation needed). If the branch has no upstream, set it
      (`git push -u origin main`). If the push fails (auth, network, non-fast-
      forward), do **not** force it — leave the commit and report.

   e. **Gate before continuing.** Proceed to the next iteration only if the slice
      fully succeeded: all required validations passed, the commit was created, and
      the push succeeded. Record the slice (number, title, commit hash) for the
      final report. Confirm the **Next slice** number actually advanced, then loop
      to (a). If it did not advance, treat it as a fault and stop.

4. **Final report.** Summarize the whole run: every slice built (number, title,
   commit hash), the honest validation status, how many commits were pushed, where
   the loop stopped and why (roadmap exhausted, a user-action checkpoint, a design
   pause, or a fault), and the number + title of the slice now queued (if any). If
   the roadmap finished, say so plainly. If it stopped at a user-action checkpoint,
   give the user the exact commands/steps to perform next.

## Bootstrap (state file missing)

If `docs/ios-roadmap-progress.md` does not exist, create it before implementing:
read `docs/ios-roadmap.md`, `CLAUDE.md`, and the codebase to confirm the baseline
(web core present, `mobile/` absent), record it, and write the first **Next slice**
prompt (slice 1 — scaffold the Expo app per M0), then continue from step 2.

## Stop conditions

Stop the loop immediately — leaving the repo in its last good, pushed state — when
any of these occur. Do **not** roll forward into the next slice to "make up" for a
problem.

- **Roadmap exhausted:** no next slice remains (the *success* exit — short of the
  Apple-side steps, the app is built).
- **User-action checkpoint:** the queued slice needs an Apple account, a bundle id,
  signing credentials, an `eas build`/`eas submit`, TestFlight, screenshots, or
  store submission (see step 3b). Stop and hand off with exact instructions.
- **Design decision required:** an architectural/product call the roadmap does not
  specify. Pause and ask.
- **Validation fails and cannot be fixed:** if mobile `lint`/`typecheck`/
  `test:run`/`bundle-check` (or the web trio, when `src/` was touched) stay red
  after a genuine root-cause fix attempt, stop with the work uncommitted and report
  what failed. Never commit broken work; never claim a command passed unless it ran
  and passed.
- **Environment cannot validate:** if the sandbox genuinely cannot install or run
  the mobile toolchain (e.g. `npm install`/`expo export` is blocked), stop and
  report honestly rather than committing unvalidated work or faking a green run.
- **Blocked or ambiguous slice:** if a slice is unclear or self-contradictory, stop
  and ask rather than guessing.
- **Push fails:** auth, network, or non-fast-forward — never force-push. Leave the
  commit and report.
- **No progress:** the Next slice pointer did not advance after an iteration —
  stop and report.
- **Safety checkpoint:** after **20** slices in a single run, pause, report progress,
  and ask the user whether to continue (re-invoking the skill resumes from the
  queued slice).

## Guardrails

- **One slice = one commit, always.** Never squash multiple slices into one commit,
  even though the loop spans many. Per-slice commits keep the run reversible and
  honor `CLAUDE.md`'s "small, focused, reversible" rule.
- **Keep the web app green.** Mobile work is additive. Any change to shared `src/`
  (or root ESLint/Vitest/tsconfig) requires the web trio to pass before committing.
- **Reuse the core, don't copy it.** Domain/types/cloud come from `@core/*`.
  Copy-pasting a domain module into `mobile/` is a regression, not a slice.
- **Separation of concerns** holds on mobile: `@core` for reused logic,
  `mobile/platform/` for native adapters, `mobile/app/` for screens,
  `mobile/components/` for RN UI.
- **Stay on `main`; push after each slice commit** (standing user authorization);
  never force-push.
- **Never advance the pointer past unvalidated work.** A slice that did not go green
  is not "done."
- **Report honestly throughout.** Partial completion is a valid, useful outcome —
  say exactly how far it got and what the user must do next.
- This skill does the work itself in the loop; it follows the per-slice procedure
  inline, once per slice — it does not call another skill to do it.
