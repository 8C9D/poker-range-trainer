import type { SupabaseClient, createClient } from '@supabase/supabase-js'
import { getCloudConfig } from './cloudConfig'

/**
 * Lazy, memoized accessor for the single Supabase client.
 *
 * Returns `null` when cloud is not configured (see {@link getCloudConfig}), so
 * callers can keep the local-only path working. The client and the
 * `@supabase/supabase-js` library are loaded on first use via a dynamic
 * `import()` — keeping Supabase OUT of the initial bundle (it only downloads
 * when a configured user performs a cloud op).
 *
 * `deps` is injectable so tests can supply a fake `config` and `create` without
 * any network call, live credentials, or dynamic import.
 */
let cachedClient: SupabaseClient | null = null

interface SupabaseClientDeps {
  config?: ReturnType<typeof getCloudConfig>
  create?: typeof createClient
}

export async function getSupabaseClient(
  deps: SupabaseClientDeps = {},
): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient
  const config = deps.config ?? getCloudConfig()
  if (!config) return null
  const create = deps.create ?? (await import('@supabase/supabase-js')).createClient
  cachedClient = create(config.url, config.anonKey)
  return cachedClient
}

/** Reset the memoized client. Intended for tests. */
export function resetSupabaseClient(): void {
  cachedClient = null
}
