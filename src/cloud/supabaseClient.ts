import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCloudConfig } from './cloudConfig'

/**
 * Lazy, memoized accessor for the single Supabase client.
 *
 * Returns `null` when cloud is not configured (see {@link getCloudConfig}), so
 * callers can keep the local-only path working. The client is created on first
 * use — never at import time — to keep module import side-effect-free.
 *
 * `deps` is injectable so tests can supply a fake `config` and `create` without
 * any network call or live credentials.
 */
let cachedClient: SupabaseClient | null = null

interface SupabaseClientDeps {
  config?: ReturnType<typeof getCloudConfig>
  create?: typeof createClient
}

export function getSupabaseClient(deps: SupabaseClientDeps = {}): SupabaseClient | null {
  if (cachedClient) return cachedClient
  const config = deps.config ?? getCloudConfig()
  if (!config) return null
  const create = deps.create ?? createClient
  cachedClient = create(config.url, config.anonKey)
  return cachedClient
}

/** Reset the memoized client. Intended for tests. */
export function resetSupabaseClient(): void {
  cachedClient = null
}
