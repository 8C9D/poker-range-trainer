# ADR 0002: Vite + React single-page app served by Express, replacing Next.js

- Status: Accepted
- Date: 2026-09-05

## Context

The rebuilt web app (`apps/web`) shipped on Next.js 16 with the App Router. In
practice none of the framework's server features were in use: there were no
route handlers, no middleware, no server actions, and no server-side data
fetching. Ten of the eleven routes rendered a client component that loads its
data from the Express API in an effect; the two server components were a static
landing page and a `redirect()`. What Next contributed was file-system routing,
`next/link`, a dev-time rewrite that proxied `/api` to Express, and a headers
block carrying the production Content-Security-Policy.

It also carried costs: a second server runtime to configure and defend
(`output: 'standalone'`, a CSP that had to allow `'unsafe-inline'` scripts for
the framework's own bootstrap), a proxy hop between the browser and the API in
production, and a build and lint toolchain distinct from the rest of the
monorepo, which already ran on Vite through Vitest.

## Decision

`apps/web` is a Vite-built React 19 single-page app. Routing is an explicit
route table in `src/routes.tsx` on React Router 7 in declarative mode; the app
uses no loaders or actions because its data loading stays in effects, as the
project rules require. Fonts remain self-hosted through the
`@fontsource-variable` packages; page titles come from a small
`useDocumentTitle` hook.

In production the Express API serves the bundle. With `WEB_DIST_DIR` set, the
API serves the files under `dist/` (hashed assets with a year-long immutable
cache, everything else revalidated on each load) and answers any other `GET`
outside `/api` and `/assets` with `index.html`. The static and fallback handlers
mount after the API routers, so an unknown `/api` path still returns the
RFC 9457 problem+json 404 and a missing hashed asset is a 404, never HTML. The
production security headers moved into the API's helmet configuration and apply
to every response. The policy is stricter than before because the Vite output
has no inline scripts (`script-src 'self'`, `script-src-attr 'none'`);
`style-src` keeps `'unsafe-inline'` for the percentage bars the views size
through the `style` attribute.

In development the Vite dev server proxies `/api` to Express, reading the same
`API_PROXY_TARGET` variable the Next rewrite used.

## Consequences

- The stack description is now the code: React in the browser, Express and
  PostgreSQL behind one origin. One framework fewer to track and defend, and an
  API-first architecture with a thin client.
- The browser and the API share a host in production without a proxy, so the
  host-only session and CSRF cookies, the double-submit check, and the CORS
  allowlist keep working unchanged.
- The route table and the titles are ordinary code with ordinary tests; the set
  of URLs is preserved and now asserted.
- Traded away: there is no path to server rendering or streaming without
  reintroducing a framework. Nothing in the product needed it; the marketing
  page is static JSX.
- The `/app` index redirect is a client-side replace rather than an HTTP 307;
  the URL and its destination are unchanged.
- A deploy ships two artefacts from one build, `apps/web/dist` and
  `apps/api/dist`. The API runtime smoke fails the build if the bundle is
  missing or not served.
