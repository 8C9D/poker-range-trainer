import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from './app.js'
import { loadConfig } from './config.js'

// A build-time check, not production startup (which stays plain Node). It proves
// two things: the compiled ESM loads, and the API serves the web bundle the web
// build just produced, so a deploy that shipped one without the other fails here.
// The listener is ephemeral, on loopback, and closed before the process exits.
const webDistDir = fileURLToPath(new URL('../../web/dist/', import.meta.url))
if (!existsSync(path.join(webDistDir, 'index.html'))) {
  throw new Error(`The web bundle is missing at ${webDistDir}; run the web build first.`)
}

const app = createApp({
  config: loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:5432/smoke',
    API_ORIGINS: 'http://localhost:5173',
    WEB_DIST_DIR: webDistDir,
  }),
  readiness: async () => undefined,
})

const server = createServer(app)
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

try {
  const page = await fetch(`${origin}/app/today`)
  const html = await page.text()
  if (page.status !== 200 || !page.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`The SPA fallback did not answer with HTML: ${page.status}`)
  }
  if (!html.includes('<div id="root"></div>')) {
    throw new Error('The SPA fallback did not return the built index.html.')
  }
  const script = /<script[^>]+src="(\/assets\/[^"]+)"/.exec(html)?.[1]
  if (script === undefined) throw new Error('The built index.html references no bundle script.')
  const asset = await fetch(`${origin}${script}`)
  if (asset.status !== 200 || asset.headers.get('cache-control') !== 'public, max-age=31536000, immutable') {
    throw new Error(`The bundle script ${script} was not served as an immutable asset.`)
  }
  const missing = await fetch(`${origin}/api/v1/absent`)
  if (
    missing.status !== 404 ||
    !missing.headers.get('content-type')?.includes('application/problem+json')
  ) {
    throw new Error('An unknown API path did not keep its problem+json 404.')
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  )
}

console.info('API runtime smoke passed: compiled ESM loads and serves the web bundle.')
