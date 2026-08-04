# Security Sanity Check Report

> Historical record: the repository as it stood on 2026-06-13. Kept for history; not a description of the current app.

_Date: 2026-06-13 · Branch: main_

This is a practical security hygiene review, not a formal penetration test or full audit.

## 1. Scope

Local inspection of the tracked source tree of the `poker-range-trainer` repository: application source, the optional Supabase cloud integration (`src/cloud/` and `supabase/migrations/`), configuration, dependency manifests, `.gitignore`, the service worker, and documentation. No exploitation, no external service testing, no live credentials used.

> **Note:** This report supersedes the prior version (2026-06-08), which described the app as having "no backend, no authentication, and no env vars." That is no longer accurate — the app has since grown an optional Supabase backend (auth, cloud sync, and shared range/pack pages). The architecture below is the current state.

## 2. Project Overview

- **Type:** Local-first, client-side single-page web app + installable PWA.
- **Stack:** React 19 + TypeScript + Vite. Tests via Vitest + Testing Library.
- **Backend:** Optional, env-gated [Supabase](https://supabase.com). When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, the app runs fully local/anonymous. The Supabase client and library are dynamically imported only on first cloud use.
- **Auth:** Supabase managed auth (email/password and OAuth) via thin wrappers in `src/cloud/auth.ts`. No custom credential handling or storage.
- **Storage:** Browser `localStorage` for all local data (ranges, stats, accuracy, history, review state). Cloud tables (`ranges`, `backups`, `shared_ranges`, `shared_packs`) hold per-user copies when signed in.
- **Sharing:** A signed-in user can publish a range/pack under an unguessable id, either public or private (guarded by a secret token). Visitors read it through a `SECURITY DEFINER` RPC.
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (both optional; both `VITE_`-prefixed and therefore public by design).
- **Deployment:** Static build (`dist/`, gitignored). No CI/CD config in-repo.

## 3. Executive Summary

**Overall risk: Low**

The application follows a sound, security-conscious design. The cloud layer is correctly opt-in and isolates data per user via Row-Level Security (RLS); visitor reads of shared content go through a hardened `SECURITY DEFINER` function rather than a broad anonymous `SELECT` policy. Auth is delegated to Supabase's managed system, so the app never handles or stores raw passwords. No secrets are committed, no XSS/code-execution sinks exist in the source, and `npm audit` reports zero known vulnerabilities. The only client-side network egress is to Supabase, and the service worker deliberately refuses to cache cross-origin (API) responses.

Findings are limited to documentation/hygiene improvements (applied) and one low-severity code observation left for manual review (a non-cryptographic fallback in share-id/token generation).

## 4. Findings

### Finding 1 — Security report was materially out of date
- **Severity:** Info
- **Location:** `docs/security-sanity-check.md`
- **Evidence:** The prior report (2026-06-08) stated "Backend: None. No server, no API calls, no authentication, no payments" and "Env vars: None used." The repo now contains `src/cloud/` (Supabase auth + repos), `supabase/migrations/` (4 SQL migrations with RLS), and reads `VITE_SUPABASE_*` env vars.
- **Why it matters:** A stale security report gives a false sense of the attack surface and can hide real review gaps (e.g. RLS correctness, env-var exposure) behind a "frontend-only / nothing to see here" framing.
- **Recommended fix:** Rewrite the report to cover the current cloud/auth/sharing surface.
- **Auto-fix status:** Fixed (this document).
- **Secret redacted:** No.
- **Confidence:** High.

### Finding 2 — Cloud env-var contract undocumented; `.gitignore` would block a template
- **Severity:** Low
- **Location:** repository root (`.env.example` absent), `.gitignore`, `README.md`
- **Evidence:** The app requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for cloud features, but there was no `.env.example` documenting them, and `.gitignore`'s `.env.*` rule would have ignored any such template (`git check-ignore .env.example` → matched `.env.*`). The README's setup section covered only local dev.
- **Why it matters:** Without a documented, safe template, a contributor enabling cloud features is more likely to guess at configuration — and, in the worst case, place a privileged secret in a client-side `VITE_` variable (see Finding 3).
- **Recommended fix:** Add a placeholder `.env.example`, allow it past `.gitignore`, and document the contract in the README.
- **Auto-fix status:** Fixed. Added `.env.example` (placeholders only), added `!.env.example` to `.gitignore`, and added a "Cloud sync (optional)" note to the README.
- **Secret redacted:** No (placeholders only; no real values involved).
- **Confidence:** High.

### Finding 3 — `VITE_`-prefixed env vars are bundled into client JS (public by design)
- **Severity:** Info (preventive — code is currently correct)
- **Location:** `src/cloud/cloudConfig.ts`, build via Vite
- **Evidence:** Cloud config reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Vite inlines every `VITE_`-prefixed variable into the shipped bundle. The values used here (project URL + anon/publishable key) are intended to be public and are protected server-side by RLS, so this is correct.
- **Why it matters:** It is a well-known footgun: a future contributor must never put the Supabase `service_role` key (or any real secret) behind a `VITE_` name, because doing so would publish it to every visitor. Data protection here depends on RLS, not on key secrecy.
- **Recommended fix:** Document the "anon key only, never service_role" rule where env vars are configured. (No code change needed — current usage is correct.)
- **Auto-fix status:** Fixed (documented in `.env.example` and README; no code change).
- **Secret redacted:** No.
- **Confidence:** High.

### Finding 4 — Non-cryptographic fallback for share-id / private-share token
- **Severity:** Low
- **Location:** `src/cloud/sharedRangesRepo.ts` and `src/cloud/sharedPacksRepo.ts` — `defaultGenerateId()`
- **Evidence:** Ids and private-share tokens are generated with `crypto.randomUUID()` when available, but fall back to `` `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}` `` otherwise. `Math.random()` is not cryptographically secure and is potentially predictable.
- **Why it matters:** Share ids and private tokens are the only thing guarding access to shared range/pack payloads. In the fallback path, a private link's token would be guessable, weakening "private" sharing. In practice the fallback is essentially never taken — `crypto.randomUUID` is available in all secure-context browsers this PWA targets (service workers and `crypto.subtle` already require a secure context) — so real-world exposure is minimal.
- **Recommended fix:** Replace the fallback with `crypto.getRandomValues()` (also a secure-context API), or hard-fail when no CSPRNG is available, so a weak token can never be issued. Update `defaultGenerateId` tests accordingly.
- **Auto-fix status:** Manual action required — not auto-fixed. This is security-sensitive token-generation logic with test coverage; per skill rules, changes here need human review rather than an automated rewrite.
- **Secret redacted:** No.
- **Confidence:** Medium.

### Finding 5 — Private-share token compared with plain SQL equality
- **Severity:** Info (accepted risk)
- **Location:** `supabase/migrations/0003_shared_ranges.sql`, `0004_shared_packs.sql` — `get_shared_*` functions
- **Evidence:** The token check is `token is not null and token = p_token`, a standard (non-constant-time) SQL string comparison.
- **Why it matters:** In theory a non-constant-time compare is a timing side channel. In practice the tokens are 128-bit-class unguessable values delivered over HTTPS with no precise timing oracle, so a timing attack is not realistic. Noted for completeness; no action recommended.
- **Auto-fix status:** Skipped (no action needed).
- **Secret redacted:** No.
- **Confidence:** High.

## 5. Secrets and Sensitive Files Review

No secrets found in tracked files. Searches for `API_KEY`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, key headers, `DATABASE_URL`, `service_role`, and `Bearer` over the source tree returned no hardcoded credentials. No `.env` files are tracked or present on disk. The new `.env.example` contains placeholders only. `.claude/settings.local.json` may exist locally but is untracked and holds only tool-permission entries. The Supabase anon key, when configured, is supplied at build time via env (not committed) and is public by design (Finding 3).

## 6. `.gitignore` and Publish Safety Review

`.gitignore` covers `node_modules`, `dist`, `*.local`, logs, `coverage`, `.env` / `.env.*`, editor files, and `.DS_Store`. Added `!.env.example` so the documentation template can be committed while every real `.env*` file stays ignored. Verified `.env` and `.env.local` remain ignored after the change. `dist/` (the deployable bundle) is ignored.

## 7. Authentication and Authorization Review

- **Authentication** is delegated entirely to Supabase managed auth (`signUp` / `signInWithPassword` / `signOut` / `getSession` / `onAuthStateChange`) in `src/cloud/auth.ts`. The app never stores, hashes, or logs raw passwords; the `AuthPanel` uses a `type="password"` field with appropriate `autoComplete`, holds the password only in transient component state, and surfaces Supabase's (deliberately generic) error messages.
- **Authorization** is enforced server-side by Postgres Row-Level Security on every cloud table:
  - `ranges` and `backups` (0001/0002): all of SELECT/INSERT/UPDATE/DELETE are gated on `auth.uid() = user_id`.
  - `shared_ranges` / `shared_packs` (0003/0004): owner-only RLS for management; **no** broad anonymous `SELECT` policy. Visitor reads go through `get_shared_range` / `get_shared_pack`, `SECURITY DEFINER` functions that (a) enforce the `is_public OR token matches` check themselves and (b) set `search_path = public`, which is the correct hardening against search-path hijacking of definer functions. Execute is granted to `anon, authenticated`.
- Client repos additionally scope owner-only operations with `.eq('owner_id', userId)` as defense in depth, and require a signed-in session before publishing/unpublishing.

No plaintext password storage, hardcoded users, client-side-only authorization, or overly permissive policies were found.

## 8. Input Validation and Unsafe Operation Review

No unsafe rendering or code-execution sinks in `src/`: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or `document.write`. No raw SQL string construction in the client (queries use the Supabase client builder and a parameterized RPC). No shell execution, file-path handling, unsafe deserialization, or open-redirect patterns (`location.href =`, `location.assign`, `window.open`) were found. User input is poker selections, range names/metadata/notes, and imported range JSON/notation, persisted to `localStorage` or the user's own cloud rows.

## 9. Dependency and Tooling Review

`npm audit --audit-level=moderate` reported **0 vulnerabilities**. Runtime dependencies are minimal and reputable: `react`, `react-dom`, and `@supabase/supabase-js`. No unusual packages and no suspicious `package.json` lifecycle scripts.

## 10. CI/CD and Deployment Review

No CI/CD pipeline configuration is present in the repository. The build is a standard static Vite build (`tsc -b && vite build`) with output (`dist/`) gitignored. No deployment secrets are present. The hand-written service worker (`public/service-worker.js`) caches only same-origin GET responses of type `basic` and explicitly skips cross-origin requests, so Supabase API responses (which can contain user data) are never written to the cache.

## 11. Auto-Fixes Applied

### Fix 1 — Rewrite the security report for the current architecture
- **Files changed:** `docs/security-sanity-check.md`
- **What changed:** Replaced the stale "frontend-only, no backend" report with one covering the Supabase cloud/auth/sharing surface and the findings above.
- **Why it is safe:** Documentation only; no code or behavior change.

### Fix 2 — Add `.env.example` template
- **Files changed:** `.env.example` (new)
- **What changed:** Added placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` plus a comment that only the public anon key (never `service_role`) belongs in a `VITE_` variable.
- **Why it is safe:** Placeholders only, no real values; not imported by app code; documents the existing env contract.

### Fix 3 — Allow the env template past `.gitignore`
- **Files changed:** `.gitignore`
- **What changed:** Added `!.env.example` after `.env.*`.
- **Why it is safe:** Narrowly re-includes only the placeholder template; all real `.env*` files remain ignored (verified).

### Fix 4 — Document the cloud env contract in the README
- **Files changed:** `README.md`
- **What changed:** Added a "Cloud sync (optional)" subsection explaining how to enable cloud features and the "anon key only, protected by RLS, never `service_role`" rule.
- **Why it is safe:** Documentation only.

**Validation:** `npm run lint`, `npm run test:run`, `npm run build`, and `git diff --check` — see section 13.

**Commit / push:** the `chore: improve security hygiene` commit that introduces this report; pushed to `origin/main` (see section 14).

## 12. Recommended Manual Fix Order

1. **Finding 4 (Low):** Replace the `Math.random()` fallback in `defaultGenerateId` (in `sharedRangesRepo.ts` and `sharedPacksRepo.ts`) with `crypto.getRandomValues()`, or hard-fail when no CSPRNG is present, so a weak private-share token can never be issued. Update the related tests.

No other manual security actions are outstanding.

## 13. Commands Run

```
pwd; git status --short; git branch --show-current; git remote -v; ls
git ls-files
git rev-parse --abbrev-ref --symbolic-full-name @{u}
git grep -n "import.meta.env|process.env" -- src/
git grep -n "dangerouslySetInnerHTML|innerHTML|eval(|new Function|document.write" -- src/
git grep -n "location.href =|location.assign|window.open" -- src/
git grep -nI "API_KEY|SECRET|PASSWORD|PRIVATE_KEY|BEGIN RSA|BEGIN OPENSSH|DATABASE_URL|service_role|Bearer " (source tree, excluding tests)
cat supabase/migrations/*.sql            # RLS + SECURITY DEFINER review
cat public/service-worker.js             # cache scope review
git check-ignore -v .env .env.example .env.local
npm audit --audit-level=moderate
git diff --check
```

## 14. Final Notes

The repository is in good security hygiene. The optional cloud layer is opt-in, isolates data per user via RLS, hardens its public read path with a `SECURITY DEFINER` function, and delegates credentials to Supabase managed auth. No committed secrets, no unsafe rendering, and no known-vulnerable dependencies were found. The applied fixes are documentation/hygiene only and preserve app behavior. The single remaining item for human review (Finding 4) is a low-severity, rarely-reached non-cryptographic fallback in share-token generation.
