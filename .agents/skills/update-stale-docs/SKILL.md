---
name: update-stale-docs
description: Audit the project's living docs (README, the manual-testing guide) for drift against the actual code, fix the stale ones with minimal verified edits, validate, and commit and push a focused docs change. Leaves point-in-time records (acceptance reviews, the superseded checklist) and machine-owned state (roadmap-progress.md) untouched. Use when documentation has fallen behind the code and needs refreshing.
---

# update-stale-docs

The full procedure lives in `.claude/skills/update-stale-docs/SKILL.md`.
Read that file and follow it as written. It is the single source of truth for this
skill; this file only makes the skill discoverable to Codex.

Project rules referenced there as `CLAUDE.md` are the same rules `AGENTS.md` points to.
