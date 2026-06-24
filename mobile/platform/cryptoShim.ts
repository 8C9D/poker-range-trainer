import { randomUUID } from 'expo-crypto';

/**
 * Hermes `crypto.randomUUID` polyfill.
 *
 * Hermes (the RN JS engine) provides no `crypto` global, so `crypto.randomUUID`
 * is undefined on device. The shared core's id generators
 * (`@core/cloud/sharedRangesRepo`, `sharedPacksRepo`) guard for this and fall
 * back to a weaker `Date.now()+Math.random()` id — fine for not crashing, but
 * not collision-resistant for cloud-share ids. Installing a real `randomUUID`
 * (backed by expo-crypto) lets the core, and the mobile editor, mint proper
 * RFC-4122 v4 UUIDs on device. It is a strict no-op anywhere `crypto.randomUUID`
 * already exists (web/test), so the core's existing guard simply passes there.
 */

/**
 * Define `globalThis.crypto.randomUUID` from expo-crypto when it is missing.
 * Never clobbers an existing `crypto` or `randomUUID`. Idempotent; importing
 * this module performs no native call (only the installed function does, lazily,
 * when first invoked).
 */
export function installCryptoRandomUUID(): void {
  const scope = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof scope.crypto?.randomUUID === 'function') return;
  if (scope.crypto === undefined) {
    scope.crypto = { randomUUID };
  } else {
    scope.crypto.randomUUID = randomUUID;
  }
}
