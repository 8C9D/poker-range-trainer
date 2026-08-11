import type { ReactNode } from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import { PRACTICE_STATS_STORAGE_KEY } from '@core/storage/practiceStatsStorage';
import { STORAGE_KEY } from '@core/storage/rangeStorage';

import { StorageLossNotice, describeLostSlices } from '../components/StorageLossNotice';
import { acknowledgeStorageLoss, checkForLostKeys, noteStoredKeys } from '../platform/storeIntegrity';

jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

/** Put the app in the state a partial recovery leaves it in. */
function loseKeys(kept: string[], lost: string[]): void {
  noteStoredKeys([...kept, ...lost]);
  checkForLostKeys(kept);
}

describe('StorageLossNotice', () => {
  beforeEach(() => {
    acknowledgeStorageLoss();
  });

  it('renders nothing at all when no data has gone missing', async () => {
    const { queryByTestId } = await render(<StorageLossNotice />);

    expect(queryByTestId('storage-loss-notice')).toBeNull();
  });

  /**
   * The whole point of N-2: without this the app renders whatever survived as
   * though it were the entire library, and the user has no way to know that the
   * one remedy — a backup file — is worth reaching for right now.
   */
  it('tells the user what is missing and that a backup is the only way back', async () => {
    loseKeys([PRACTICE_STATS_STORAGE_KEY], [STORAGE_KEY]);

    const { getByTestId } = await render(<StorageLossNotice />);

    expect(getByTestId('storage-loss-notice')).toBeTruthy();
    expect(getByTestId('storage-loss-notice')).toHaveTextContent(/your saved ranges/);
    expect(getByTestId('storage-loss-notice')).toHaveTextContent(/Restoring a backup file/);
    expect(getByTestId('storage-loss-restore')).toBeTruthy();
  });

  it('stays gone once dismissed', async () => {
    loseKeys([], [STORAGE_KEY]);
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<StorageLossNotice />);

    await user.press(getByTestId('storage-loss-dismiss'));

    await waitFor(() => expect(queryByTestId('storage-loss-notice')).toBeNull());
    // Cleared in the store too, not just in this component's state, or it would
    // be back on the next launch after the user said they had seen it.
    const { queryByTestId: queryAfterRelaunch } = await render(<StorageLossNotice />);
    expect(queryAfterRelaunch('storage-loss-notice')).toBeNull();
  });

  describe('describeLostSlices', () => {
    it('names one slice, and joins several readably', () => {
      expect(describeLostSlices([STORAGE_KEY])).toBe('your saved ranges');
      expect(describeLostSlices([STORAGE_KEY, PRACTICE_STATS_STORAGE_KEY])).toBe(
        'your saved ranges and your practice stats',
      );
    });

    it('falls back rather than naming a key it does not recognise', () => {
      expect(describeLostSlices(['poker-range-trainer.something-new.v1'])).toBe(
        'some of your saved data',
      );
    });
  });
});
