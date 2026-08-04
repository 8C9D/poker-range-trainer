---
name: build-ios-app
description: Implement EVERY remaining slice of the iOS app roadmap (docs/ios-roadmap.md) in one run by looping a per-slice procedure — one validated, committed, pushed, reversible slice at a time — until the roadmap is exhausted, a user-action checkpoint is reached (Apple account / signing / store submission), or a slice fails. This builds a React Native + Expo iOS equivalent of the existing web app under mobile/, reusing the existing src/ domain/types/cloud core. Invoking this skill IS the explicit authorization for the iOS app build (a large new scope beyond the web app), per AGENTS.md.
---

# build-ios-app

The full procedure lives in `.claude/skills/build-ios-app/SKILL.md`.
Read that file and follow it as written. It is the single source of truth for this
skill; this file only makes the skill discoverable to Codex.

Project rules referenced there as `CLAUDE.md` are the same rules `AGENTS.md` points to.
