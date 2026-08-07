/**
 * Cloud env seam for native (M7). The reused `@core/cloud/cloudConfig` reads Vite vars
 * (`VITE_SUPABASE_*`) and defaults its env source to `import.meta.env`, which does not exist on
 * Hermes. Its `getCloudConfig`/`isCloudConfigured` already accept an INJECTED env, so here we
 * build that env from Expo public vars (`EXPO_PUBLIC_SUPABASE_*`) and delegate — no `src/` edit.
 *
 * Local-first: with the vars absent, `getMobileCloudConfig()` is null and the app stays fully
 * offline/anonymous, exactly like the web with no Vite vars set.
 */
import {
  getCloudConfig,
  isCloudConfigured,
  type CloudConfig,
} from '@core/cloud/cloudConfig';

/** Map the Expo public env into the shape `@core/cloud/cloudConfig` expects. */
function mobileCloudEnv(): Record<string, string | undefined> {
  return {
    VITE_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** The resolved cloud config, or `null` when the Expo Supabase vars are not both set. */
export function getMobileCloudConfig(): CloudConfig | null {
  return getCloudConfig(mobileCloudEnv());
}

/** True when cloud features can be used on device (both Expo Supabase vars set). */
export function isMobileCloudConfigured(): boolean {
  return isCloudConfigured(mobileCloudEnv());
}
