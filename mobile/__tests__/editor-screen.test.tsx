import { Alert } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { loadSavedRanges } from '@core/storage/rangeStorage';

import { RangeEditor } from '../components/RangeEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native modules: in-memory MMKV + deterministic crypto + stubbed clipboard, plus a
// minimal expo-router stub (no id param -> a new range; Stack.Screen renders nothing).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  // Link renders its children so the wrapped Pressable (e.g. "Edit actions") survives.
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

describe('EditorScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  // userEvent (async) is used instead of fireEvent so the multiple interactions in
  // this heavy screen don't trip RNTL v14's overlapping-act warnings / lost updates.
  it('creates, live-saves, and clears a range', async () => {
    const user = userEvent.setup();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    const { getByTestId } = await render(<RangeEditor />);

    await user.type(getByTestId('range-name-input'), 'UTG Open');
    await user.press(getByTestId('hand-cell-AA'));

    await waitFor(() => {
      const ranges = loadSavedRanges();
      expect(ranges).toHaveLength(1);
      expect(ranges[0].name).toBe('UTG Open');
      expect(ranges[0].hands).toEqual(['AA']);
    });

    // Clear range (the Alert mock auto-accepts the destructive confirm).
    await user.press(getByTestId('clear-range'));
    await waitFor(() => expect(loadSavedRanges()[0]?.hands ?? []).toEqual([]));

    alertSpy.mockRestore();
  });

  it('undoes and redoes a live-saved hand selection', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor />);

    await user.press(getByTestId('hand-cell-AA'));
    await waitFor(() => expect(loadSavedRanges()[0]?.hands).toEqual(['AA']));

    await user.press(getByTestId('undo-selection'));
    await waitFor(() => expect(loadSavedRanges()[0]?.hands ?? []).toEqual([]));

    await user.press(getByTestId('redo-selection'));
    await waitFor(() => expect(loadSavedRanges()[0]?.hands).toEqual(['AA']));
  });
});
