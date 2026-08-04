---
name: update-stale-docs
description: Audit the project's living docs (README, the manual-testing guide) for drift against the actual code, fix the stale ones with minimal verified edits, validate, and commit and push a focused docs change. Leaves point-in-time records (acceptance reviews, the superseded checklist) and machine-owned state (roadmap-progress.md) untouched. Use when documentation has fallen behind the code and needs refreshing.
---

# update-stale-docs

Find documentation that has drifted out of sync with the code and bring it back in
line — minimally, accurately, and without falsifying anything. A doc is **stale**
when it makes claims that the current codebase no longer supports: wrong run/build
commands, features described as missing that now exist (or vice versa), references to
files that were renamed or removed, an "as of vX.Y" marker that lags reality, or
boilerplate that was never written for this project at all.

The work is one focused `docs:` commit: detect the drift, fix it against what the
code actually does, verify every changed claim, commit, and push.

The hard part is **not** rewriting things that only look stale. Several docs in this
repo are deliberately frozen — historical snapshots, a superseded checklist, and a
state file owned by another skill. Updating those to "match current" destroys their
purpose. Classifying each doc correctly is the core of this skill.

## Inputs

Optional path(s) in the args naming specific docs to check (e.g.
`/update-stale-docs README.md`, `/update-stale-docs docs/manual-testing-guide.md`).

- No args → audit **all living docs** and fix the ones that have drifted.
- Path(s) given → audit those. If a named path is a **frozen record** (see
  classification), do not "refresh" it to current. Explain why it is frozen and, if
  the user's intent was to capture the change somewhere, point them at the living doc
  that should carry it instead.

## Doc classification (do this first, every run)

Classify by what each file *declares itself to be* (read its header), not by a
hardcoded list — new docs get classified the same way. The current mapping:

**Living docs — keep these tracking the code; fix drift here:**

- `README.md` — should describe *this* app (a React + TypeScript + Vite poker range
  trainer) and how to run, test, and build it. It currently still contains the
  default Vite template text and is the canonical stale doc.
- `docs/manual-testing-guide.md` — self-declares the version it reflects ("through
  v2.x …") and maintains a "What does NOT exist yet" section. Both are explicit
  freshness markers that drift as features land.

**Frozen records — do NOT rewrite to match current code:**

- `docs/archive/` — everything under it is a finished point-in-time report, including
  `v1-acceptance-review.md` and `v1.2-acceptance-review.md`, which are pinned to a
  specific commit and date. They are historical records; editing them to reflect later
  work falsifies the record. Leave them. (Fix only an outright mechanical error like a
  broken relative link, never their findings.)
- `docs/archive/manual-testing-checklist.md` — explicitly **superseded** by the guide
  (covers only v1–v1.3). Do not expand it to current; the guide is where current
  testing lives.
- `docs/roadmap-progress.md` — **machine-owned** state file for the `roadmap-slice` /
  `finish-v2` skills. Those skills rewrite it. This skill does not touch it (but it is
  an excellent *source of truth* for what is actually built — read it).
- `docs/roadmap.md` — forward-looking **plan / source of scope**, not a description of
  current code. Never rewrite it to match what exists. If it contains an outright
  broken reference or typo, fix only that; if its plan seems to contradict reality,
  surface that to the user rather than silently editing.

If a doc's correct nature is genuinely unclear, treat it as frozen and ask.

## Source of truth (what "current" means)

Build the picture of what the code actually does from, in rough priority order:

- `src/` tree — components in `src/components/`, domain logic in `src/domain/`,
  storage in `src/storage/`, types in `src/types/`. The set of files here is the
  ground truth for "what features exist."
- `package.json` `scripts` — the real run/test/build commands any doc should cite.
- `docs/roadmap-progress.md` — the **Completed slices** log and the **Next slice →
  Roadmap target** pointer tell you exactly how far the build has progressed.
- `git log` — recent commits and, per doc, whether `src/` changed after the doc was
  last touched (a strong staleness signal): compare the last commit that edited the
  doc against commits that edited `src/` since.
- `docs/roadmap.md` and `CLAUDE.md` — scope and project rules.

## Procedure

Do these in order. If a step cannot complete, stop and report honestly — never invent
content to make a doc look finished, never edit a frozen record to fake currency.

1. **Load context.** Read `CLAUDE.md`. Assemble the source-of-truth picture above
   (scan `src/`, read `package.json` scripts and `docs/roadmap-progress.md`, skim
   recent `git log`).

2. **Classify and select.** Classify every Markdown doc (living vs frozen) per the
   section above. Pick targets from the args, or all living docs if no args.

3. **Pre-flight.** Run `git status` and `git branch --show-current`. You must be on
   `main` (per `CLAUDE.md`) with a clean working tree. If there are unrelated
   uncommitted changes, stop and report — do not fold them into the docs commit.

4. **Detect drift** in each selected living doc. Check concretely:
   - Run / test / build commands match `package.json` scripts.
   - "What does NOT exist yet" / "not implemented" claims — does any of it now exist
     in `src/`? Promote it to existing, or remove the stale claim.
   - Feature, component, module, and file references resolve to real files in `src/`.
   - The freshness / "as of vX.Y" marker matches the real built state (from
     `roadmap-progress.md` and `git log`).
   - Internal relative links resolve to files that exist.
   - For `README.md` specifically: does it describe this poker app at all, or is it
     still template boilerplate?
   - Counts, percentages, and version numbers still hold.

5. **Fix only what genuinely drifted.** Make the smallest edits that restore accuracy.
   Preserve each doc's existing voice, structure, and formatting — this is
   maintenance, not a rewrite, and not a style pass. Update or add the freshness
   marker so future drift stays detectable. Every claim you add or change must be
   verifiable against the code; if you cannot verify something, leave a clearly marked
   TODO rather than guessing. Under-claiming beats fabricating.

6. **Validate.**
   - **Always:** re-verify every changed claim against the actual code/`package.json`
     — this is the real validation for docs.
   - **If you touched any code, config, or scripts (or are unsure):** run, in order,
     `npm run lint`, `npm run test:run`, `npm run build`. All must pass. Doc-only
     edits do not require the full suite, but if you run it, report results honestly
     and never claim a command passed unless it actually ran and passed.
   - Confirm `git status` shows only the intended doc changes.

7. **Commit and push.** Stage only the doc files you changed. Commit as one focused
   change with a conventional `docs:` message describing what was brought back in
   sync, ending with:

   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```

   Then push to the tracked remote (`git push` → `origin/main`). The user has standing
   authorization to push after every commit, so no extra confirmation is needed. Never
   force-push; if the push fails (auth, network, non-fast-forward), leave the commit in
   place and report the failure honestly.

8. **Report.** Summarize: which docs were audited; which were stale and exactly what
   had drifted; the edits made; which docs were intentionally left untouched and why
   (frozen records / machine-owned state); validation results stated honestly; the
   commit hash; and whether the push succeeded.

## Guardrails

- **Never falsify a frozen record.** Acceptance reviews and the superseded checklist
  are historical; `roadmap-progress.md` belongs to `roadmap-slice` / `finish-v2`;
  `roadmap.md` is the forward plan. Do not rewrite any of them to "match current." If
  asked to, explain why and offer the right living doc instead.
- **Never invent features to make a doc look complete.** Every added or changed claim
  must be verifiable in `src/` / `package.json`. When unsure, mark a TODO; do not
  guess.
- **Stay in scope.** This skill updates documentation only — it does not change code,
  add features, or do stylistic rewrites of docs that are already accurate. Keep the
  diff minimal and focused on real drift.
- **Do not touch `CLAUDE.md`** unless the user explicitly asks — those are authored
  project rules, not drift.
- **Stay on `main`; push after the commit** (standing user authorization); never
  force-push.
- **Report honestly.** "These three docs were already current; only the README drifted"
  is a perfectly good outcome — say exactly what you found and changed.
- If a doc's correct content depends on a design decision, or its frozen-vs-living
  nature is ambiguous, stop and ask rather than guessing.
