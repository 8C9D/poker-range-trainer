// Manual Jest mock for expo-crypto: the real package is a native module
// jest-expo cannot load in Node. randomUUID returns a fixed RFC-4122 v4-shaped
// value so the crypto-shim test is deterministic.
export function randomUUID(): string {
  return '00000000-0000-4000-8000-000000000000';
}
