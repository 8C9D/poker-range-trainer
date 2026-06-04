---
name: finish-roadmap
description: Implement EVERY remaining poker-range-trainer roadmap slice (through v6) in one run by looping the roadmap-slice procedure — one validated, committed, pushed, reversible slice at a time — until the roadmap is exhausted or a slice fails. Use when the user explicitly wants to build out the entire rest of the roadmap, not just the next version. Because this crosses into v3+ (accounts, backend, cloud sync) and beyond, invoking it is the explicit authorization CLAUDE.md requires for that out-of-default-scope work.
---

# finish-roadmap

Drive the roadmap to the **very end** without stopping between slices. This is an
auto-loop around [`roadmap-slice`](../roadmap-slice/SKILL.md): it runs that exact
per-slice procedure repeatedly, slice after slice, until **no next slice remains**
(the roadmap is exhausted) or a slice cannot be completed cleanly.

The batching is only in the *invocation*. Each individual slice stays atomic: small,
focused, validated (`lint` + `test:run` + `build` all green), committed on its own, and
pushed — exactly as `roadmap-slice` does one at a time. A long run therefore remains
reversible slice-by-slice, and stopping partway always leaves a clean, pushed state.

## Scope

In scope — keep looping while a **Next slice** exists in `docs/roadmap-progress.md`,
across **every** roadmap version: v2.x (if not yet done), v3, v3.1, v3.2, v4, v4.1,
v4.2, v5, v5.1, and v6. There is no version ceiling; the loop ends only when the
roadmap runs out of slices or a stop condition fires.

### Authorization note (important)

`CLAUDE.md` says v3+ work — accounts, backend, cloud sync, payments, solver imports,
postflop boards, mixed frequencies, AI features — must not be built **without an
explicit user request**. Invoking `finish-roadmap` **is** that explicit request: the
user is asking for the entire remaining roadmap, which by definition includes those
versions, so the loop may proceed into them. This does **not** waive the design-decision
and ambiguity stops below — large architectural choices (which backend? which auth?
hosting? schema?) are exactly where you must pause and ask rather than guess.

## Procedure

1. **Load context.** Read `CLAUDE.md`, `docs/roadmap.md`, `docs/roadmap-progress.md`,
   and the `roadmap-slice` SKILL. If the state file is missing, hand off to
   `roadmap-slice` to bootstrap it first.

2. **Pre-flight (once).** `git status` and `git branch --show-current`. Must be on
   `main` with a clean working tree (per `CLAUDE.md`). If not, stop and report — do not
   start the loop on top of unrelated changes.

3. **Loop.** Repeat until a stop condition fires:

   a. **Next-slice check.** Read the **Next slice** block in `docs/roadmap-progress.md`.
      If there is no next slice (roadmap exhausted) → the loop is **done**; go to step 4.
      Otherwise → continue.

   b. **Design-decision gate.** If the queued slice requires a non-obvious
      architectural or product decision the roadmap does not pin down (backend choice,
      auth provider, hosting, DB/schema, sync-conflict policy, public-sharing model,
      etc.), **stop and ask** the user before building. These cannot be guessed safely.
      Small, well-specified slices proceed without asking.

   c. **Run one slice.** Execute the full `roadmap-slice` per-slice procedure for this
      one slice — its steps 3–8: re-check the plan against the current code, implement
      the minimal change (domain in `src/domain/`, storage in `src/storage/`, types in
      `src/types/`, UI in `src/components/`, backend code in its own clearly-separated
      location if/when v3 introduces one, with tests for core logic), **validate**
      (`npm run lint`, `npm run test:run`, `npm run build` — all must pass), update the
      state file (log the completed slice + generate the next slice's prompt), then
      **commit and push** as one slice commit.

   d. **Gate before continuing.** Only proceed to the next iteration if that slice
      fully succeeded: all three validation commands passed, the commit was created,
      and the push succeeded. Record the slice (number, title, commit hash) for the
      final report. Confirm the **Next slice** number actually advanced, then loop to
      (a). If it did not advance, treat it as a fault and stop (see Stop conditions).

4. **Final report.** Summarize the whole run: every slice built (number, title, commit
   hash), the honest validation status, how many commits were pushed, where the loop
   stopped and why (roadmap exhausted, a design-decision pause, or a fault), and the
   number + title of the slice now queued (if any). If the roadmap finished, say so
   plainly.

## Stop conditions

Stop the loop immediately — leaving the repo in its last good, pushed state — when any
of these occur. Do **not** roll forward into the next slice to "make up" for a problem.

- **Roadmap exhausted:** no next slice remains (this is the *success* exit — the whole
  roadmap is built).
- **Design decision required:** the queued slice needs an architectural/product call
  the roadmap does not specify (see step 3b). Pause and ask.
- **Validation fails and cannot be fixed:** if `lint` / `test:run` / `build` stay red
  after a genuine root-cause fix attempt, stop with the work uncommitted and report
  what failed. Never commit broken work; never claim a command passed unless it ran and
  passed.
- **Blocked or ambiguous slice:** if a slice is unclear or self-contradictory, stop and
  ask rather than guessing.
- **Push fails:** auth, network, or non-fast-forward — never force-push. Leave the
  commit in place and report.
- **No progress:** the Next slice pointer did not advance after an iteration (possible
  loop / duplicate work) — stop and report.
- **Safety checkpoint:** after **20** slices in a single run, pause, report progress so
  far, and ask the user whether to continue (re-invoking the skill resumes from the
  queued slice). This guards against a runaway autonomous run.

## Guardrails

- **One slice = one commit, always.** Never squash multiple slices into one commit,
  even though the loop spans many. Per-slice commits keep the run reversible and honor
  `CLAUDE.md`'s "small, focused, reversible" rule.
- **Stay on `main`; push after each slice commit** (standing user authorization);
  never force-push.
- **Never advance the pointer past unvalidated work.** A slice that did not go green is
  not "done."
- **Keep concerns separated**, even as scope grows: poker logic in `src/domain/`,
  storage in `src/storage/`, types in `src/types/`, UI in `src/components/`. When v3+
  introduces a backend, keep it cleanly isolated and keep the local-only path working
  (the roadmap requires anonymous/local mode to keep functioning).
- **Pause on big design calls.** Building the entire roadmap is authorized by invoking
  this skill, but specific infrastructure decisions are not pre-decided — ask.
- **Report honestly throughout.** Partial completion is a valid, useful outcome — say
  exactly how far it got.
- This skill does the work itself in the loop; it does not invoke `roadmap-slice` as a
  separate command — it follows that skill's procedure inline, once per slice.
