# ADR 0002: Vite + React single-page app served by Express

- Status: Accepted
- Date: 2026-09-05

## Context

The product needs a browser client for an API that already owns every rule worth
enforcing. Express is the single authority for authentication, authorization,
validation, and persistence, so the client's whole job is routing, rendering, and
calling `/api/v1`. Every page loads its data in the browser; none of the eleven
routes needs data resolved before the response is sent, and the two static pages
are a marketing landing page and a redirect.

That leaves a choice between a full-stack React framework with its own server
runtime and a plain single-page bundle. A second server runtime is a second
process to configure, deploy, and defend: its own build and lint toolchain
distinct from the rest of the monorepo (which already runs on Vite through
Vitest), a proxy hop between the browser and the API in production, and a
Content-Security-Policy loose enough to admit the framework's own inline
bootstrap.

## Decision

`apps/web` is a Vite-built React 19 single-page app. Routing is an explicit
route table in `src/routes.tsx` on React Router 7 in declarative mode; the app
uses no loaders or actions because its data loading stays in effects, as the
project rules require. Fonts are self-hosted through the `@fontsource-variable`
packages; page titles come from a small `useDocumentTitle` hook.

In production the Express API serves the bundle. With `WEB_DIST_DIR` set, the
API serves the files under `dist/` (hashed assets with a year-long immutable
cache, everything else revalidated on each load) and answers any other `GET`
outside `/api` and `/assets` with `index.html`. The static and fallback handlers
mount after the API routers, so an unknown `/api` path still returns the
RFC 9457 problem+json 404 and a missing hashed asset is a 404, never HTML. The
production security headers live in the API's helmet configuration and apply
to every response. The policy is strict because the Vite output has no inline
scripts (`script-src 'self'`, `script-src-attr 'none'`); `style-src` keeps
`'unsafe-inline'` for the percentage bars the views size through the `style`
attribute.

In development the Vite dev server proxies `/api` to Express, reading
`API_PROXY_TARGET`.

## Consequences

- The stack description is the code: React in the browser, Express and
  PostgreSQL behind one origin. One runtime to track and defend, and an
  API-first architecture with a thin client.
- The browser and the API share a host in production without a proxy, so the
  host-only session and CSRF cookies, the double-submit check, and the CORS
  allowlist all operate on one origin.
- The route table and the titles are ordinary code with ordinary tests; the set
  of URLs is asserted.
- Traded away: there is no path to server rendering or streaming without
  introducing a framework. Nothing in the product needs it; the marketing page
  is static JSX.
- The `/app` index redirect is a client-side replace rather than an HTTP 307.
- A deploy ships two artefacts from one build, `apps/web/dist` and
  `apps/api/dist`. The API runtime smoke fails the build if the bundle is
  missing or not served.
