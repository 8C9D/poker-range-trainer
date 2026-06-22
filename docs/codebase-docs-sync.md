# Codebase Docs Sync

## Date

2026-06-13

## Summary

Synced documentation with the current codebase. The repository now implements the
**full v1–v6 roadmap** (roadmap-progress is at slice 146). The top-level `README.md`
was already refreshed to the complete v1–v6 feature set (commit `e202059`) and is
accurate, so it was left unchanged. The main drift was in
`docs/manual-testing-guide.md`, which still declared itself "through v2.3" and whose
"What does NOT exist yet" section listed v3–v5.1 features (cloud sync, PWA, JSON/CSV/
SVG export, share links, range packs, postflop, combo precision, mixed frequencies,
range diff, source/reference, per-hand notes) as **not built** — all of which now
ship. That guide was updated to match reality and this report (the prior copy was
dated 2026-06-06 / "through v2.3") was rewritten.

## Repository state reviewed

- Current branch: `main`
- Important source areas reviewed:
  - `src/App.tsx` (top-level wiring: editor controls, practice-mode picker,
    library-launched views, cloud sync + sharing handlers)
  - `src/components/` (UI, incl. `RangeLibrary` per-card actions, the practice
    components, editors, postflop/board, combo, mixed-frequency, diff, auth, share
    pages, getting-started, library analytics)
  - `src/domain/` (pure poker logic: hands, range math, notation, practice, spaced
    repetition, action ranges, board texture, combos, mixed strategy, range diff,
    transfer, library analytics)
  - `src/storage/` (localStorage persistence + `backup.ts`)
  - `src/cloud/` (env-gated Supabase: config, client, auth, hook, ranges/backup/
    shared-range/shared-pack repos)
  - `src/types/` (`range.ts`, `practice.ts`)
  - `package.json`, `.env.example`, `supabase/migrations/`
- Important docs reviewed:
  - `README.md`
  - `CLAUDE.md`
  - `docs/roadmap.md`
  - `docs/roadmap-progress.md`
  - `docs/manual-testing-guide.md`
  - `docs/manual-testing-checklist.md`
  - `docs/v1-acceptance-review.md`, `docs/v1.2-acceptance-review.md`
  - `docs/codebase-docs-sync.md` (prior report)
  - `prompts/001-repo-inspection.md`

## Documentation updates made

- File: `docs/manual-testing-guide.md`
  - Change: Updated the version framing from "through v2.3" to the full v1–v6
    roadmap; revised §1 to describe the app as local-first with an optional,
    env-gated Supabase cloud and an installable PWA (rather than "client-only … no
    network dependency"); corrected the automated-suite figure from "671 tests across
    38 files" to "1007 tests across 80 files".
  - Change: §2 — expanded the `saved-ranges.v1` row to note the new per-range data it
    holds (actions, combo selections, mixed strategies, per-hand notes, source) and
    added a cloud note (a server-side copy exists when signed in and is not cleared by
    clearing `localStorage`).
  - Change: §3 — added the frequency quiz as practice mode 6; added feature
    subsections for import/export & backup, sharing, optional cloud accounts & sync,
    mobile & PWA, postflop & board-aware views, combo-level precision,
    mixed-frequency strategies, range comparison & provenance, and onboarding &
    analytics; added a "Frequency quiz" row to the "what records what" table and noted
    that the self-graded postflop/combo drills record nothing.
  - Change: §4 — rewrote "What does NOT exist yet". Removed the now-false claims that
    v3–v5.1 features are unbuilt; it now lists only the genuinely deferred items (the
    heavy v5.1 community features, automated solver/OCR import, approximate-frequency
    grading, Supabase account self-deletion) and the small in-scope gaps (no
    undo/redo, no bulk delete).
  - Change: §5 — added checklist sections 5.18–5.27 for the v3–v6 features and
    renumbered the persistence section to 5.28.
  - Change: §6 — replaced "there is no sync or backup yet" with local-first guidance
    pointing at backup export and cloud push.
  - Reason: The guide is the README's linked "current feature list and manual test
    checklist"; a third of it was stale and its §4 actively told testers not to test
    features that exist.
- File: `docs/codebase-docs-sync.md`
  - Change: Rewrote this report for the current state (prior copy was dated
    2026-06-06 and described the repo as "through v2.3").
  - Reason: The report is the skill's required output and was itself stale.

## Confirmed current-state facts

- The full v1–v6 roadmap is implemented.
  - Evidence: `docs/roadmap-progress.md` completed-slices table runs through slice 146
    (v6); `src/App.tsx` wires the v3–v6 views (cloud sync, sharing, postflop, combo,
    mixed-frequency, diff, notes, analytics); `src/types/range.ts` carries
    `handActions`, `comboSelections`, `mixedStrategies`, `handNotes`, `source`.
- The app is local-first; cloud is optional and env-gated.
  - Evidence: `src/cloud/cloudConfig.ts` returns `null` unless both `VITE_SUPABASE_*`
    vars are set; the cloud-sync controls in `App.tsx` render only when signed in;
    `.env.example` documents the two public vars.
- localStorage still uses exactly six keys (new per-range data lives inside
  `saved-ranges.v1`).
  - Evidence: `grep` over `src/storage` finds only `saved-ranges.v1`,
    `practice-stats.v1`, `hand-accuracy.v1`, `action-accuracy.v1`,
    `session-history.v1`, `review-state.v1`.
- Practice-mode recording: recognize/timed/weakness record per-range + per-hand
  accuracy + history + spaced-rep; the action quiz records per-action accuracy;
  build-from-memory and the frequency quiz record nothing; the postflop and combo
  drills are self-graded standalone views that record nothing.
  - Evidence: `App.tsx` routes recognize/timed/weakness → `handleEndPractice`,
    `action` → `handleEndActionQuiz`, and `build`/`mixed` → `exitPractice`.
- Test suite: 1007 tests across 80 files, all passing.
  - Evidence: `npm run test:run` → "Test Files 80 passed (80) / Tests 1007 passed
    (1007)".
- Scripts unchanged: `dev`, `build` (`tsc -b && vite build`), `lint` (`eslint .`),
  `test` (`vitest`), `test:run` (`vitest run`), `preview`.
  - Evidence: `package.json` `scripts`.

## Items needing confirmation

- None. All documented changes were verified directly against the source, the test
  output, `package.json`, or `roadmap-progress.md`.

## Docs intentionally left unchanged

- File: `README.md`
  - Reason: Already refreshed to the complete v1–v6 feature set (commit `e202059`) and
    verified accurate against the code (features, optional cloud, persistence keys,
    project structure, deferred v5.1 list).
- File: `docs/roadmap.md`
  - Reason: Forward-looking product vision and the scope/ordering source for the
    `roadmap-slice` skill; not a current-state doc.
- File: `docs/roadmap-progress.md`
  - Reason: Machine-owned state file rewritten by the `roadmap-slice` skill on each
    slice; not hand-maintained prose.
- File: `docs/manual-testing-checklist.md`
  - Reason: Older v1–v1.3 checklist explicitly superseded by `manual-testing-guide.md`;
    kept as a point-in-time record.
- Files: `docs/v1-acceptance-review.md`, `docs/v1.2-acceptance-review.md`,
  `docs/refactor-opportunities.md`, `docs/security-sanity-check.md`,
  `docs/test-coverage-improvement.md`
  - Reason: Dated, commit-pinned point-in-time reports — historical records, not living
    docs.
- File: `prompts/001-repo-inspection.md`
  - Reason: Historical kickoff prompt; not current-state documentation.
- File: `CLAUDE.md`
  - Reason: Contributor/agent instructions (workflow rules, validation commands,
    technical conventions) that remain accurate. Its "v1 goal / v1 scope" framing
    reads as the original project intent, and that v1 scope is still implemented;
    changing this file risks altering agent behavior and is out of scope for a docs
    sync.

## Validation performed

- `npm run test:run` → 80 files / 1007 tests passed (also the source of the corrected
  test-count figure).
- `grep` over `src/storage` confirmed the six localStorage keys.
- `git diff` confined to `docs/manual-testing-guide.md` and this report; no source,
  test, or config changes. (No markdown linter is configured in the repo, so the
  docs-only diff scope is the validation.)

## Next recommended docs improvements

- Recommendation: When the deferred v5.1 community features (study groups,
  leaderboards, coach assignments, comments, shared version history) are eventually
  built, move them out of §4 of the manual testing guide and into §3/§5.
  - Why: §4 is the current source of truth for "what's intentionally absent" and will
    drift first when that work lands.
- Recommendation: Consider reducing `docs/manual-testing-checklist.md` to a short
  "superseded — see manual-testing-guide.md" stub.
  - Why: Two testing docs invite confusion; a stub preserves the pointer without
    duplicating now-outdated v1–v1.3 detail.
- Recommendation: Consider revisiting `CLAUDE.md`'s "v1 goal / v1 scope" framing (with
  the user, since it steers agent behavior) now that the product is at v6.
  - Why: A new contributor reading only `CLAUDE.md` would underestimate the app's
    current scope.
