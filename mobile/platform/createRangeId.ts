import { randomUUID } from 'expo-crypto';

/**
 * Mint a stable id for a newly created range — the mobile UI's equivalent of the
 * web app's `createRangeId`. Backed by expo-crypto so it is type-safe and testable
 * (the global `crypto.randomUUID` polyfill from slice 4 serves the reused @core
 * cloud helpers; UI code uses this directly).
 */
export function createRangeId(): string {
  return randomUUID();
}
