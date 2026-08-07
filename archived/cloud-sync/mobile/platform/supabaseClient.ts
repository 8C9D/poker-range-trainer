/**
 * Native Supabase client factory (M7). The reused `@core/cloud/supabaseClient` `getSupabaseClient`
 * already injects `config` + `create` and memoizes a single client (returning `null` when cloud is
 * unconfigured). Here we inject the slice-53 mobile config and a `create` that builds the client
 * with RN-appropriate auth options — session persistence through the MMKV-backed `localStorage`
 * shim (installed at app entry), and no browser-URL session detection. No `src/` edit.
 *
 * Local-first: with the Expo Supabase vars absent, `getMobileSupabaseClient()` resolves to `null`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { CloudConfig } from '@core/cloud/cloudConfig';
import { getSupabaseClient, resetSupabaseClient } from '@core/cloud/supabaseClient';

import { getMobileCloudConfig } from './cloudEnv';
import { localStorageShim } from './localStorageShim';

interface MobileSupabaseDeps {
  /** Override the resolved cloud config (tests). */
  config?: CloudConfig | null;
  /** Override the Supabase client constructor (tests, to avoid a real client/network). */
  create?: typeof createClient;
}

// Build the client with RN auth options: persist the session through the MMKV-backed localStorage
// shim and never look for a session in a (nonexistent) browser URL.
const rnCreate = ((url: string, key: string) =>
  createClient(url, key, {
    auth: {
      storage: localStorageShim,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })) as typeof createClient;

/** The native Supabase client, or `null` when cloud is unconfigured. Memoized by the core. */
export function getMobileSupabaseClient(
  deps: MobileSupabaseDeps = {},
): Promise<SupabaseClient | null> {
  const config = deps.config ?? getMobileCloudConfig();
  // Short-circuit when unconfigured: the core `getSupabaseClient` does `deps.config ?? getCloudConfig()`,
  // so passing `config: null` would make it fall back to the core's Vite `import.meta.env` default
  // (undefined on device → crash). Resolving to null here keeps the app local-first.
  if (!config) return Promise.resolve(null);
  return getSupabaseClient({ config, create: deps.create ?? rnCreate });
}

export { resetSupabaseClient };
