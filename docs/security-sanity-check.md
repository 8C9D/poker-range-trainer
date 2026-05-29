# Security Sanity Check Report

_Date: 2026-06-08 · Branch: main_

This is a practical security hygiene review, not a formal penetration test or full audit.

## 1. Scope

Local inspection of the tracked source tree of the `poker-range-trainer` repository: source, configuration, dependency manifests, `.gitignore`, and documentation. No exploitation, no external service testing.

## 2. Project Overview

- **Type:** Client-side single-page web app.
- **Stack:** React + TypeScript + Vite. Tests via Vitest.
- **Backend:** None. No server, no API calls, no authentication, no payments.
- **Storage:** Browser `localStorage` only (poker ranges and session stats).
- **Env vars:** None used (`import.meta.env` / `process.env` not referenced in `src/`).
- **Deployment:** Static build (`dist/`), which is gitignored.

## 3. Executive Summary

**Overall risk: Low**

This is a self-contained, frontend-only application with no secrets, no backend, no authentication, and no network I/O. No real security vulnerabilities were found. The attack surface is limited to the user's own browser and their own locally stored data. One minor hygiene improvement was applied (ignore coverage output).

## 4. Findings

### Finding 1 — Coverage output directory not gitignored
- **Severity:** Info
- **Location:** `.gitignore`
- **Evidence:** Vitest can emit a `coverage/` directory; it was not listed in `.gitignore`.
- **Why it matters:** Prevents accidental commit of generated artifacts. No security impact.
- **Recommended fix:** Add `coverage` to `.gitignore`.
- **Auto-fix status:** Fixed.
- **Secret redacted:** No.
- **Confidence:** High.

## 5. Secrets and Sensitive Files Review

No secrets found. Searches for `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`, `PRIVATE_KEY`, key headers, and `DATABASE_URL` returned no matches in tracked files (excluding the dependency lockfile). No `.env` files are tracked. `.claude/settings.local.json` is present locally but not tracked, and contains only tool permission entries (no secrets).

## 6. `.gitignore` and Publish Safety Review

`.gitignore` already covers `node_modules`, `dist`, `*.local`, logs, `.env` / `.env.*`, editor files, and `.DS_Store`. `dist/` confirmed ignored via `git check-ignore`. Added `coverage` for completeness. No `.env.example` is needed because the app uses no environment variables.

## 7. Authentication and Authorization Review

Not applicable. The app has no authentication, authorization, sessions, cookies, or user accounts.

## 8. Input Validation and Unsafe Operation Review

No unsafe rendering or code-execution sinks found: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, or `new Function` in `src/`. No SQL, no shell execution, no file-path handling, no deserialization of untrusted input. User input is poker hand selections and range names persisted to `localStorage`.

## 9. Dependency and Tooling Review

`npm audit --audit-level=moderate` reported **0 vulnerabilities**. No unusual or risky dependencies observed. No suspicious lifecycle scripts.

## 10. CI/CD and Deployment Review

No CI/CD pipeline configuration found in the repository. Build is a standard static Vite build with output gitignored. No deployment secrets present.

## 11. Auto-Fixes Applied

### Fix 1 — Add `coverage` to `.gitignore`
- **Files changed:** `.gitignore`
- **What changed:** Added a "Test coverage output" section ignoring `coverage`.
- **Why it is safe:** Only affects which untracked generated files git ignores; no app behavior change.
- **Validation run:** `npm run lint`, `npm run test:run`, `npm run build` (see section 13).
- **Commit hash:** see git log for `chore: improve security hygiene`.
- **Push result:** see section 14.

## 12. Recommended Manual Fix Order

None required. No manual security actions outstanding.

## 13. Commands Run

```
pwd; git status --short; git branch --show-current; git remote -v; ls
git ls-files
find . -maxdepth 2 -type f (excluding node_modules/.git)
git grep -n -I "API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|BEGIN RSA|BEGIN OPENSSH|DATABASE_URL"
git grep -n "dangerouslySetInnerHTML|innerHTML|eval(|document.write|new Function" -- src/
git grep -n "import.meta.env|process.env" -- src/ vite.config.ts
git check-ignore dist
npm audit --audit-level=moderate
git diff --check
```

## 14. Final Notes

The repository is in good security hygiene. Risk is Low. Since all data stays in the user's browser via `localStorage` and there is no backend, the realistic threat model is limited to client-side concerns, none of which are currently triggered by unsafe patterns.
