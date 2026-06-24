import { ACTION_ACCURACY_STORAGE_KEY } from '@core/storage/actionAccuracyStorage';
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '@core/storage/backup';
import { HAND_ACCURACY_STORAGE_KEY } from '@core/storage/handAccuracyStorage';
import { PRACTICE_STATS_STORAGE_KEY } from '@core/storage/practiceStatsStorage';
import { loadSavedRanges, saveSavedRange, STORAGE_KEY } from '@core/storage/rangeStorage';
import {
  loadReviewStates,
  REVIEW_STATE_STORAGE_KEY,
  saveReviewState,
} from '@core/storage/reviewStateStorage';
import { SESSION_HISTORY_STORAGE_KEY } from '@core/storage/sessionHistoryStorage';
import type { RangeReviewState } from '@core/types/practice';
import type { SavedRange } from '@core/types/range';

import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// react-native-mmkv is native; use the in-memory manual mock as the other
// shim tests do, so this exercises the real @core/storage code path on device.
jest.mock('react-native-mmkv');

// Fixed ids/timestamps and canonical hand order so assertions are exact.
const range: SavedRange = {
  id: 'fixed-test-id',
  name: 'UTG Open',
  hands: ['AA', 'AKs', 'AQs'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const reviewState: RangeReviewState = {
  rangeId: 'fixed-test-id',
  ease: 2.5,
  intervalDays: 3,
  dueAt: '2026-01-04T00:00:00.000Z',
  lastReviewedAt: '2026-01-01T00:00:00.000Z',
};

describe('@core storage parity through the MMKV shim', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('reuses the web app storage keys verbatim (on-disk layout parity)', () => {
    // These exact strings are the web app's on-disk contract; the reused
    // modules must never drift from them or backups stop being interchangeable.
    expect(STORAGE_KEY).toBe('poker-range-trainer.saved-ranges.v1');
    expect(PRACTICE_STATS_STORAGE_KEY).toBe('poker-range-trainer.practice-stats.v1');
    expect(HAND_ACCURACY_STORAGE_KEY).toBe('poker-range-trainer.hand-accuracy.v1');
    expect(ACTION_ACCURACY_STORAGE_KEY).toBe('poker-range-trainer.action-accuracy.v1');
    expect(SESSION_HISTORY_STORAGE_KEY).toBe('poker-range-trainer.session-history.v1');
    expect(REVIEW_STATE_STORAGE_KEY).toBe('poker-range-trainer.review-state.v1');
  });

  it('round-trips a full backup (build → serialize → parse → restore) through the shim', () => {
    saveSavedRange(range);
    saveReviewState(reviewState);

    const json = serializeBackup(buildBackup('2026-01-05T00:00:00.000Z'));

    // Wipe all local state, confirm it is gone, then restore from the backup.
    localStorageShim.clear();
    expect(loadSavedRanges()).toEqual([]);
    expect(loadReviewStates()).toEqual({});

    restoreBackup(parseBackup(json));

    expect(loadSavedRanges()).toEqual([range]);
    expect(loadReviewStates()).toEqual({ 'fixed-test-id': reviewState });
  });

  it('restores each slice under its own web key as JSON', () => {
    saveSavedRange(range);

    const json = serializeBackup(buildBackup('2026-01-05T00:00:00.000Z'));
    localStorageShim.clear();
    restoreBackup(parseBackup(json));

    // The reused backup writer persists under the web keys, as plain JSON, so a
    // backup written on device is byte-compatible with the web app / cloud.
    const rawRanges = localStorageShim.getItem(STORAGE_KEY);
    expect(rawRanges).not.toBeNull();
    expect(JSON.parse(rawRanges as string)).toEqual([range]);
    expect(localStorageShim.getItem(PRACTICE_STATS_STORAGE_KEY)).toBe('{}');
  });
});
