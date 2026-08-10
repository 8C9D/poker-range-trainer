import { loadSavedRanges, saveSavedRange, STORAGE_KEY } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// react-native-mmkv is a native module jest-expo can't load; use the in-memory
// manual mock at mobile/__mocks__/react-native-mmkv.ts.
jest.mock('react-native-mmkv');

// Reached through `requireMock` rather than an import: the real package's types
// have no `__lastConfiguration`, so a bare `import { __lastConfiguration } from
// 'react-native-mmkv'` fails `tsc --noEmit`, and importing the mock by path makes
// Jest hand back an auto-mocked copy instead of the instance the shim uses. This
// returns the exact module registry entry the shim imported.
const mmkvMock = jest.requireMock('react-native-mmkv') as {
  __lastConfiguration(): { id?: string; recoveryStrategy?: string } | undefined;
};

// Hands listed in canonical 13x13 row-major order (AA, AKs, AQs) so the core's
// normalization leaves them unchanged — keeps the round-trip assertion exact.
function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'fixed-test-id',
    name: 'UTG Open',
    hands: ['AA', 'AKs', 'AQs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MMKV-backed localStorage shim', () => {
  beforeAll(() => {
    // On device this happens at app entry via platform/installStorage; the core
    // reads/writes the `localStorage` global at call time, so install it first.
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('round-trips a SavedRange saved through @core/storage', () => {
    const range = makeRange();

    saveSavedRange(range);

    expect(loadSavedRanges()).toEqual([range]);
  });

  it('persists under the web app storage key as JSON (forward-compatible)', () => {
    const range = makeRange({ id: 'another-id', name: 'BTN Open' });

    saveSavedRange(range);

    const raw = localStorageShim.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual([range]);
  });

  it('returns null for a missing key, matching localStorage semantics', () => {
    expect(localStorageShim.getItem('does-not-exist')).toBeNull();
  });

  it('supports removeItem and clear', () => {
    localStorageShim.setItem('k', 'v');
    expect(localStorageShim.getItem('k')).toBe('v');

    localStorageShim.removeItem('k');
    expect(localStorageShim.getItem('k')).toBeNull();

    localStorageShim.setItem('a', '1');
    localStorageShim.setItem('b', '2');
    localStorageShim.clear();
    expect(localStorageShim.length).toBe(0);
  });

  it('does not overwrite an existing localStorage when installed again', () => {
    const existing = (globalThis as { localStorage?: unknown }).localStorage;
    installLocalStorage();
    expect((globalThis as { localStorage?: unknown }).localStorage).toBe(existing);
  });

  // Unset, `recoveryStrategy` reaches MMKV core as `std::nullopt` and falls
  // through to the legacy handler callback, which returns `OnErrorDiscard` when
  // no handler is registered — and react-native-mmkv registers none. One CRC or
  // file-length error would discard every key in the instance, which is all nine
  // storage slices at once. Nothing else in the suite can see this option: the
  // mock stores into a Map that has no CRC to fail, so only the call site is
  // observable, and this asserts it.
  it('opens the store asking MMKV to recover from corruption, not discard it', () => {
    // The instance is created lazily on first access, so touch the store first.
    localStorageShim.setItem('any-key', 'any-value');

    expect(mmkvMock.__lastConfiguration()).toEqual({
      id: 'poker-range-trainer',
      recoveryStrategy: 'recover-on-error',
    });
  });
});
