import { randomUUID } from 'expo-crypto';

import { installCryptoRandomUUID } from '../platform/cryptoShim';

// expo-crypto is a native module jest-expo can't load; use the deterministic
// in-memory manual mock at mobile/__mocks__/expo-crypto.ts.
jest.mock('expo-crypto');

describe('crypto.randomUUID polyfill', () => {
  // Node may supply its own webcrypto global; capture it and restore after each
  // test so this suite's mutation of globalThis.crypto can't leak.
  const original = (globalThis as { crypto?: unknown }).crypto;

  afterEach(() => {
    (globalThis as { crypto?: unknown }).crypto = original;
  });

  it('installs randomUUID when crypto is absent (Hermes-like)', () => {
    (globalThis as { crypto?: unknown }).crypto = undefined;

    installCryptoRandomUUID();

    const { crypto } = globalThis as { crypto: { randomUUID: () => string } };
    expect(typeof crypto.randomUUID).toBe('function');
    // Identity, not value: ids differ per call, so what matters is that the
    // polyfill installed expo-crypto's generator rather than something weaker.
    expect(crypto.randomUUID).toBe(randomUUID);
  });

  it('adds randomUUID to an existing crypto that lacks one', () => {
    (globalThis as { crypto?: unknown }).crypto = {};

    installCryptoRandomUUID();

    const { crypto } = globalThis as { crypto: { randomUUID: () => string } };
    expect(crypto.randomUUID).toBe(randomUUID);
  });

  it('does not overwrite an existing crypto.randomUUID (no-op on web)', () => {
    const existing = (): string => 'pre-existing';
    (globalThis as { crypto?: unknown }).crypto = { randomUUID: existing };

    installCryptoRandomUUID();

    const { crypto } = globalThis as { crypto: { randomUUID: () => string } };
    expect(crypto.randomUUID).toBe(existing);
  });
});
