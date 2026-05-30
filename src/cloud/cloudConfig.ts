/**
 * Cloud (Supabase) configuration, read from Vite env vars.
 *
 * v3 keeps the app local-first: cloud features are only available when BOTH
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present. When they are
 * not, `getCloudConfig` returns `null` and the app stays fully local/anonymous.
 * The env source is injectable so this stays pure and unit-testable.
 */

export interface CloudConfig {
  url: string
  anonKey: string
}

type EnvSource = Record<string, string | undefined>

const defaultEnv = import.meta.env as unknown as EnvSource

/**
 * Resolve the cloud config from env, or `null` when not fully configured
 * (either var missing or blank). Pass an `env` object to test explicitly.
 */
export function getCloudConfig(env: EnvSource = defaultEnv): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/** True when cloud features can be used (both env vars set). */
export function isCloudConfigured(env: EnvSource = defaultEnv): boolean {
  return getCloudConfig(env) !== null
}
