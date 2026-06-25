import { randomUUID } from 'expo-crypto';

import { createRangeId } from '../platform/createRangeId';

// expo-crypto is native; use the deterministic manual mock.
jest.mock('expo-crypto');

describe('createRangeId', () => {
  it('returns a uuid from expo-crypto', () => {
    expect(createRangeId()).toBe(randomUUID());
  });
});
