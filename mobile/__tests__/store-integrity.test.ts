import { TRAINING_GOAL_STORAGE_KEY, saveTrainingGoal } from '@core/storage/trainingGoalStorage';
import { STORAGE_KEY, saveSavedRange } from '@core/storage/rangeStorage';

import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';
import {
  acknowledgeStorageLoss,
  checkForLostKeys,
  noteStoredKeys,
  pendingStorageLoss,
  setStorageLossReporter,
} from '../platform/storeIntegrity';

jest.mock('react-native-mmkv');

const mmkvMock = jest.requireMock('react-native-mmkv') as {
  __configurationFor(id: string): { id?: string; recoveryStrategy?: string } | undefined;
  createMMKV(config: { id: string }): { set(key: string, value: string): void };
};
// Stands in for `reportStorageLoss`, which is injected rather than imported so
// the shim never drags the Sentry SDK into app startup.
const mockReport = jest.fn();

/**
 * Corruption itself is out of reach here — the mock stores into a Map with no
 * CRC to fail, and the ledger records native recovery as CANNOT ASSESS. What is
 * testable, and what decides whether anyone is ever told, is the bookkeeping:
 * what the app records about its own store, and what it concludes when the store
 * hands back less than the record claims.
 *
 * A dropped key is simulated by calling `checkForLostKeys` with a key list that
 * is missing one. That is exactly the shape the shim passes on device — MMKV
 * drops keys down in native code, so nothing the app can call reproduces it.
 */
describe('store integrity', () => {
  beforeAll(() => {
    installLocalStorage();
    setStorageLossReporter(mockReport);
  });

  beforeEach(() => {
    localStorageShim.clear();
    acknowledgeStorageLoss();
    mockReport.mockClear();
  });

  it('keeps its record in a separate instance, so one corruption cannot take both', () => {
    localStorageShim.setItem('any-key', 'any-value');

    expect(mmkvMock.__configurationFor('poker-range-trainer-integrity')).toEqual({
      id: 'poker-range-trainer-integrity',
      recoveryStrategy: 'recover-on-error',
    });
    // Distinct ids are distinct files. One id would be one file, and the record
    // of what went missing would go missing along with it.
    expect(mmkvMock.__configurationFor('poker-range-trainer-integrity')?.id).not.toBe(
      mmkvMock.__configurationFor('poker-range-trainer')?.id,
    );
  });

  it('says nothing when every recorded key comes back', () => {
    noteStoredKeys([STORAGE_KEY, TRAINING_GOAL_STORAGE_KEY]);

    checkForLostKeys([STORAGE_KEY, TRAINING_GOAL_STORAGE_KEY]);

    expect(pendingStorageLoss()).toEqual([]);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('names the key that did not come back, and tells Sentry', () => {
    noteStoredKeys([STORAGE_KEY, TRAINING_GOAL_STORAGE_KEY]);

    // A partial recovery: the goal survived, the library did not, and nothing
    // anywhere raised an error about it.
    checkForLostKeys([TRAINING_GOAL_STORAGE_KEY]);

    expect(pendingStorageLoss()).toEqual([STORAGE_KEY]);
    expect(mockReport).toHaveBeenCalledWith([STORAGE_KEY]);
  });

  it('reports one corruption once, not at every launch after it', () => {
    noteStoredKeys([STORAGE_KEY, TRAINING_GOAL_STORAGE_KEY]);
    checkForLostKeys([TRAINING_GOAL_STORAGE_KEY]);
    mockReport.mockClear();

    // The next launch opens the same, smaller store. The shortfall was already
    // counted; re-counting it would nag forever over a loss the user has been
    // told about once.
    checkForLostKeys([TRAINING_GOAL_STORAGE_KEY]);

    expect(mockReport).not.toHaveBeenCalled();
  });

  it('holds the notice until it is acknowledged, not until the app restarts', () => {
    noteStoredKeys([STORAGE_KEY]);
    checkForLostKeys([]);
    expect(pendingStorageLoss()).toEqual([STORAGE_KEY]);

    // Being killed before the user reads the notice must not be how they never
    // find out, so nothing but an acknowledgement clears it.
    checkForLostKeys([]);
    expect(pendingStorageLoss()).toEqual([STORAGE_KEY]);

    acknowledgeStorageLoss();
    expect(pendingStorageLoss()).toEqual([]);
  });

  it('treats a first run as a fresh install, not as total loss', () => {
    // No inventory has ever been written, so there is nothing to be missing.
    checkForLostKeys([]);

    expect(pendingStorageLoss()).toEqual([]);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('invents no loss when its own record is the thing that is damaged', () => {
    noteStoredKeys([STORAGE_KEY, TRAINING_GOAL_STORAGE_KEY]);
    mmkvMock.createMMKV({ id: 'poker-range-trainer-integrity' }).set('inventory', 'not json');

    checkForLostKeys([]);

    // This code exists to tell the user something true. Unreadable bookkeeping
    // is "nothing known", never an accusation.
    expect(pendingStorageLoss()).toEqual([]);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('does not read a user-initiated delete as corruption', () => {
    saveTrainingGoal(40);
    saveSavedRange({
      id: 'r1',
      name: 'UTG open',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    // A stats reset removes keys through the shim, which re-records the
    // inventory in the same breath. Deliberate removal is not loss.
    localStorageShim.removeItem(TRAINING_GOAL_STORAGE_KEY);
    checkForLostKeys(localStorageShim.getItem(STORAGE_KEY) === null ? [] : [STORAGE_KEY]);

    expect(pendingStorageLoss()).toEqual([]);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
