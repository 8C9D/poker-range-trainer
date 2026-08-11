import { STORAGE_KEY } from '@core/storage/rangeStorage';

jest.mock('react-native-mmkv');

interface MmkvMock {
  __resetStores(): void;
  createMMKV(config: { id: string }): { set(key: string, value: string): void };
}

/**
 * The one line that makes any of this reach a user: the shim checking the store
 * against the record as it opens it.
 *
 * Everything else about detection is tested by calling `checkForLostKeys`
 * directly, which is honest about the unit but blind to whether anything ever
 * calls it. Delete the call in `getStore` and the whole feature goes quiet on
 * device with every other test still green — so this one opens the store the way
 * the app does, through an ordinary read, and asserts the check happened.
 *
 * Isolated in its own file because it has to simulate a launch: the store is
 * created once per module registry, so seeing it opened means requiring the
 * modules fresh, against a device whose files already exist.
 */
describe('opening the store', () => {
  it('checks what came back against the record, before anything reads through it', () => {
    jest.resetModules();
    const mmkv = jest.requireMock('react-native-mmkv') as MmkvMock;
    mmkv.__resetStores();
    // A device that recorded one key and, after a partial recovery, has none:
    // no error is raised anywhere, the store simply has less in it.
    mmkv
      .createMMKV({ id: 'poker-range-trainer-integrity' })
      .set('inventory', JSON.stringify([STORAGE_KEY]));

    // require, not import: these have to resolve AFTER the reset above, against
    // the seeded device, which is the whole point of the test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shim = require('../platform/localStorageShim') as typeof import('../platform/localStorageShim');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const integrity = require('../platform/storeIntegrity') as typeof import('../platform/storeIntegrity');

    // An ordinary read, which is what opens the store on device.
    shim.localStorageShim.getItem(STORAGE_KEY);

    expect(integrity.pendingStorageLoss()).toEqual([STORAGE_KEY]);
  });
});
