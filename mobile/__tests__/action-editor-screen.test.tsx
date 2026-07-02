import { render, userEvent, waitFor } from '@testing-library/react-native';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import ActionEditorScreen from '../app/action-editor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

function seedRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'UTG Open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('ActionEditorScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('live-saves a hand action onto the range', async () => {
    seedRange();
    // userEvent (async) for the two interactions — picking an action then a hand cell.
    const user = userEvent.setup();
    const { getByTestId } = await render(<ActionEditorScreen />);

    await user.press(getByTestId('action-chip-call'));
    await user.press(getByTestId('action-cell-AA'));

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.handActions?.AA).toBe('call');
    });
    // The binary hand selection is preserved alongside the new action overlay.
    expect(findSavedRangeById('r1')?.hands).toEqual(['AA', 'KK']);
  });
});
