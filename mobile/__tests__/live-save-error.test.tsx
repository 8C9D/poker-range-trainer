import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { loadSavedRanges } from '@core/storage/rangeStorage';

import { RangeEditor } from '../components/RangeEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

/**
 * The mobile editors live-save from an effect, so an unwritable store throws where React
 * unmounts the whole screen into the root ErrorBoundary — losing the edit in progress.
 * These cover the catch that keeps the editor mounted and names the reason instead.
 */
describe('live-save failures', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('reports a full store instead of tearing the editor down', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor />);

    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    await user.press(getByTestId('hand-cell-AA'));

    await waitFor(() =>
      expect(getByTestId('save-error')).toHaveTextContent(/storage is full or unavailable/),
    );
    // Still mounted with the edit intact, so nothing typed so far is lost.
    expect(getByTestId('hand-cell-AA')).toBeTruthy();
    failing.mockRestore();
  });

  it('clears the warning once a save lands again', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<RangeEditor />);

    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    await user.press(getByTestId('hand-cell-AA'));
    await waitFor(() => expect(getByTestId('save-error')).toBeTruthy());

    failing.mockRestore();
    await user.press(getByTestId('hand-cell-KK'));

    await waitFor(() => expect(queryByTestId('save-error')).toBeNull());
    expect(loadSavedRanges()[0].hands).toEqual(['AA', 'KK']);
  });
});
