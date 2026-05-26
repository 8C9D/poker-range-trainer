---
name: finish-v2
description: Implement every remaining poker-range-trainer v2.x slice (v2, v2.1, v2.2, v2.3) in one run by looping the roadmap-slice procedure — one validated, committed, pushed, reversible slice at a time — until the queued slice crosses into v3 or a slice fails. Use when the user wants to finish all of v2 at once instead of advancing one slice per invocation.
---

# finish-v2

Drive the roadmap to the **end of the v2.x family** without stopping between slices.
This is an auto-loop around [`roadmap-slice`](../roadmap-slice/SKILL.md): it runs that
exact per-slice procedure repeatedly, slice after slice, until the next queued slice
leaves v2.x (i.e. becomes v3 or later) or a slice cannot be completed cleanly.

The batching is only in the *invocation*. Each individual slice stays atomic: small,
focused, validated (`lint` + `test:run` + `build` all green), committed on its own, and
pushed — exactly as `roadmap-slice` does one at a time. A long run therefore remains
reversible slice-by-slice, and stopping partway always leaves a clean, pushed state.

## Scope boundary (where this stops)

In scope — keep looping while the **Next slice → Roadmap target** in
`docs/roadmap-progress.md` is any of:

- **v2** — Improved practice modes (modes 3 "build from memory", 5 "timed drill",
  6 "weakness-focused drill"; mode 2 stays deferred to v2.3's multi-action model)
- **v2.1** — Mistake tracking and review
- **v2.2** — Spaced repetition system
- **v2.3** — Multi-action ranges (one action per hand — this is *not* the prohibited
  "mixed frequencies", which is v4.2). This version reshapes the core range model, so
  the small-slice discipline matters most here; let `roadmap-slice` carve it into many
  tiny commits rather than one large change.

Out of scope — **stop the loop** (do not implement) the moment the next queued slice's
roadmap target is **v3 or later**, or the roadmap is exhausted. Leave that v3 slice
queued in the state file for the user to decide on separately. Per `CLAUDE.md`, v3+
(accounts, backend, cloud sync) is not authorized here.

## Procedure

1. **Load context.** Read `CLAUDE.md`, `docs/roadmap.md`, `docs/roadmap-progress.md`,
   and the `roadmap-slice` SKILL. If the state file is missing, hand off to
   `roadmap-slice` to bootstrap it first.

2. **Pre-flight (once).** `git status` and `git branch --show-current`. Must be on
   `main` with a clean working tree (per `CLAUDE.md`). If not, stop and report — do not
   start the loop on top of unrelated changes.

3. **Loop.** Repeat until a stop condition fires:

   a. **Scope check.** Read the **Next slice** block in `docs/roadmap-progress.md` and
      its **Roadmap target**. If it is v3 or later, or there is no next slice → the
      loop is **done**; go to step 4. Otherwise it is in v2.x → continue.

   b. **Run one slice.** Execute the full `roadmap-slice` per-slice procedure for this
      one slice — its steps 3–8: re-check the plan against the current code, implement
      the minimal change (domain in `src/domain/`, storage in `src/storage/`, types in
      `src/types/`, UI in `src/components/`, with tests for core logic), **validate**
      (`npm run lint`, `npm run test:run`, `npm run build` — all must pass), update the
      state file (log the completed slice + generate the next slice's prompt), then
      **commit and push** as one slice commit.

   c. **Gate before continuing.** Only proceed to the next iteration if that slice
      fully succeeded: all three validation commands passed, the commit was created,
      and the push succeeded. Record the slice (number, title, commit hash) for the
      final report. Confirm the **Next slice** number actually advanced, then loop to
      (a). If it did not advance, treat it as a fault and stop (see Stop conditions).

4. **Final report.** Summarize the whole run: every slice built (number, title, commit
   hash), the honest validation status, how many commits were pushed, where the loop
   stopped and why (v3 boundary reached, or a fault), and the number + title of the
   slice now queued. If v2.x completed, say so plainly.

## Stop conditions

Stop the loop immediately — leaving the repo in its last good, pushed state — when any
of these occur. Do **not** roll forward into the next slice to "make up" for a problem.

- **Scope boundary reached:** the next queued slice is v3+ (this is the *success*
  exit — v2.x is complete).
- **Validation fails and cannot be fixed:** if `lint` / `test:run` / `build` stay red
  after a genuine root-cause fix attempt, stop with the work uncommitted and report
  what failed. Never commit broken work; never claim a command passed unless it ran and
  passed.
- **Blocked or ambiguous slice:** if a slice needs a design decision, drifts outside
  `CLAUDE.md` scope, or is otherwise unclear, stop and ask rather than guessing.
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
- **Respect `CLAUDE.md` scope every slice.** Within v2.x this is fine (v2.3 multi-action
  is allowed; "mixed frequencies" is the later, prohibited v4.2). If a generated slice
  proposes backend, accounts, solver imports, postflop, mixed frequencies, or AI, stop
  and ask.
- **Report honestly throughout.** Partial completion is a valid, useful outcome — say
  exactly how far it got.
- This skill does the work itself in the loop; it does not invoke `roadmap-slice` as a
  separate command — it follows that skill's procedure inline, once per slice.
