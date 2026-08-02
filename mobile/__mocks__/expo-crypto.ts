// Manual Jest mock for expo-crypto: the real package is a native module
// jest-expo cannot load in Node. randomUUID walks a counter through the RFC-4122
// v4 shape, so ids stay deterministic per test file while still being unique per
// call. A single fixed value would let real id collisions pass unnoticed wherever
// the UI mints several ids in one action.
let issued = 0;

export function randomUUID(): string {
  issued += 1;
  return `00000000-0000-4000-8000-${issued.toString(16).padStart(12, '0')}`;
}
