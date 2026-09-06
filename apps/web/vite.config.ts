import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const directory = path.dirname(fileURLToPath(import.meta.url))
const developmentApiTarget = 'http://localhost:3001'

/**
 * The dev server proxies same-origin `/api` calls to Express so the session
 * cookies never cross an origin; in production Express serves the built bundle
 * itself and no proxy exists. The target is validated the same way the Next
 * rewrite used to validate it: an origin-only http(s) URL without credentials.
 */
function apiProxyTarget(): string {
  const value = process.env.API_PROXY_TARGET ?? developmentApiTarget
  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error('API_PROXY_TARGET must be an absolute http(s) URL.')
  }
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('API_PROXY_TARGET must be an origin-only http(s) URL without credentials.')
  }
  return target.origin
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.join(directory, 'src') } },
  server: { proxy: { '/api': { target: apiProxyTarget() } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
})
