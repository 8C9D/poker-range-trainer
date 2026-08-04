import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Exercises the hand-written PWA service worker's fetch strategy.
 *
 * It is plain JavaScript in `public/`, outside the module graph and never
 * imported, so nothing else covers it — yet it decides what the app sees when
 * the network is gone, which is exactly when a bug in it is hardest to notice.
 *
 * The file is read from disk and evaluated against a stub worker scope, so this
 * runs the shipped source rather than a copy of it. That is also why this file
 * is typechecked by tsconfig.node.json instead of the browser-only app config
 * (it needs `node:fs`).
 */

const ORIGIN = 'https://trainer.test'

interface FakeRequest {
  method: string
  url: string
  mode: string
}

function request(url: string, mode = 'no-cors', method = 'GET'): FakeRequest {
  return { method, url, mode }
}

/**
 * Evaluate the worker source against a stub scope and return the handlers it
 * registered, plus the cache it was given.
 */
function loadWorker(options: { cached?: string[]; offline?: boolean }) {
  const source = readFileSync(join(process.cwd(), 'public', 'service-worker.js'), 'utf8')
  const cached = new Set(options.cached ?? [])
  const put: string[] = []

  const listeners: Record<string, (event: unknown) => void> = {}
  const scope = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn
    },
    location: { origin: ORIGIN },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
  }

  const keyOf = (input: FakeRequest | string) =>
    typeof input === 'string' ? new URL(input, ORIGIN).pathname : new URL(input.url).pathname

  const caches = {
    open: () =>
      Promise.resolve({
        addAll: () => Promise.resolve(),
        put: (input: FakeRequest | string) => {
          put.push(keyOf(input))
          return Promise.resolve()
        },
      }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    match: (input: FakeRequest | string) => {
      const key = keyOf(input)
      return Promise.resolve(cached.has(key) ? { body: key, ok: true, type: 'basic' } : undefined)
    },
  }

  const networkError = { networkError: true }
  const fetchStub = (input: FakeRequest) =>
    options.offline
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve({
          body: keyOf(input),
          ok: true,
          type: 'basic',
          clone: () => ({ body: keyOf(input) }),
        })

  // The worker registers its handlers against globals it does not import, so it
  // is run as a function body with those globals passed in as parameters.
  new Function('self', 'caches', 'fetch', 'Response', source)(
    scope,
    caches,
    fetchStub,
    { error: () => networkError },
  )

  /** Run the fetch handler and return what it answered, or 'passthrough'. */
  async function respond(req: FakeRequest): Promise<unknown> {
    let answered: Promise<unknown> | null = null
    listeners.fetch?.({ request: req, respondWith: (value: Promise<unknown>) => (answered = value) })
    return answered === null ? 'passthrough' : await answered
  }

  return { respond, networkError, put }
}

describe('service worker fetch strategy', () => {
  it('serves the app shell from cache for an offline navigation', async () => {
    const worker = loadWorker({ offline: true, cached: ['/index.html'] })

    expect(await worker.respond(request(`${ORIGIN}/some/deep/link`, 'navigate'))).toMatchObject({
      body: '/index.html',
    })
  })

  it('fails an uncached asset offline instead of answering it with the shell', async () => {
    const worker = loadWorker({ offline: true, cached: ['/index.html'] })

    // The regression: handing index.html to a script request makes the browser
    // reject an HTML body where it asked for a module, and the lazily-loaded
    // practice subtree took the whole app down with it.
    const answer = await worker.respond(request(`${ORIGIN}/assets/PracticeHost-abc123.js`))
    expect(answer).toBe(worker.networkError)
  })

  it('still serves an asset it did cache before going offline', async () => {
    const worker = loadWorker({
      offline: true,
      cached: ['/index.html', '/assets/PracticeHost-abc123.js'],
    })

    expect(await worker.respond(request(`${ORIGIN}/assets/PracticeHost-abc123.js`))).toMatchObject({
      body: '/assets/PracticeHost-abc123.js',
    })
  })

  it('fails a navigation too when even the shell was never cached', async () => {
    const worker = loadWorker({ offline: true })

    expect(await worker.respond(request(`${ORIGIN}/`, 'navigate'))).toBe(worker.networkError)
  })

  it('goes to the network first and caches what it gets', async () => {
    const worker = loadWorker({})

    expect(await worker.respond(request(`${ORIGIN}/assets/index-abc123.js`))).toMatchObject({
      body: '/assets/index-abc123.js',
    })
    expect(worker.put).toContain('/assets/index-abc123.js')
  })

  it('leaves cross-origin and non-GET requests alone', async () => {
    const worker = loadWorker({ offline: true, cached: ['/index.html'] })

    expect(await worker.respond(request('https://supabase.test/rest/v1/ranges'))).toBe(
      'passthrough',
    )
    expect(await worker.respond(request(`${ORIGIN}/api`, 'no-cors', 'POST'))).toBe('passthrough')
  })
})
