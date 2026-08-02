import { createRangeId } from '../platform/createRangeId';

// expo-crypto is native; use the deterministic manual mock.
jest.mock('expo-crypto');

describe('createRangeId', () => {
  it('returns a uuid from expo-crypto', () => {
    expect(createRangeId()).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  });

  it('mints a fresh id every call', () => {
    const ids = Array.from({ length: 5 }, createRangeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
