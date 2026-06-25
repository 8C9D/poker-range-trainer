import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { loadSavedRanges } from '@core/storage/rangeStorage';

import EditorScreen from '../app/editor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native modules: in-memory MMKV + deterministic crypto, plus a minimal expo-router
// stub (no id param -> a new range; Stack.Screen renders nothing in tests).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

describe('EditorScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('creates and live-saves a new range as you edit', async () => {
    const { getByTestId } = await render(<EditorScreen />);

    fireEvent.changeText(getByTestId('range-name-input'), 'UTG Open');
    fireEvent.press(getByTestId('hand-cell-AA'));

    await waitFor(() => {
      const ranges = loadSavedRanges();
      expect(ranges).toHaveLength(1);
      expect(ranges[0].name).toBe('UTG Open');
      expect(ranges[0].hands).toEqual(['AA']);
    });
  });
});
