import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import LibraryScreen from '../app/index';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. useFocusEffect is a no-op here; the
// list's initial load comes from useState (seeded before render), and delete calls
// reload directly, so focus is not needed to drive the test.
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

function seed(id: string, name: string): void {
  const range: SavedRange = {
    id,
    name,
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  saveSavedRange(range);
}

describe('LibraryScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('lists saved ranges', async () => {
    seed('r1', 'UTG Open');
    seed('r2', 'BTN Open');

    const { getByText } = await render(<LibraryScreen />);

    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('deletes a range after confirmation', async () => {
    seed('r1', 'UTG Open');
    seed('r2', 'BTN Open');
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.style === 'destructive')?.onPress?.();
      });

    const { getByTestId, queryByText } = await render(<LibraryScreen />);
    fireEvent.press(getByTestId('delete-r1'));

    await waitFor(() => {
      expect(queryByText('UTG Open')).toBeNull();
    });
    expect(loadSavedRanges().map((r) => r.id)).toEqual(['r2']);

    alertSpy.mockRestore();
  });

  it('shows an empty state when there are no ranges', async () => {
    const { getByTestId } = await render(<LibraryScreen />);

    expect(getByTestId('empty-new-range')).toBeTruthy();
  });

  it('filters the list by the search query', async () => {
    seed('r1', 'UTG Open');
    seed('r2', 'BTN Open');

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();

    fireEvent.changeText(getByTestId('library-search'), 'btn');

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });
});
