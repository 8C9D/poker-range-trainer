import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import LibraryScreen from '../app/index';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. useFocusEffect is a no-op here; the
// list's initial load comes from useState (seeded before render), and delete calls
// reload directly, so focus is not needed to drive the test.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
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

  it('filters the list by a metadata position chip', async () => {
    const ts = '2026-01-01T00:00:00.000Z';
    saveSavedRange({ id: 'r1', name: 'UTG Open', hands: ['AA'], createdAt: ts, updatedAt: ts, metadata: { position: 'utg' } });
    saveSavedRange({ id: 'r2', name: 'BTN Open', hands: ['AA'], createdAt: ts, updatedAt: ts, metadata: { position: 'btn' } });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();

    fireEvent.press(getByTestId('filter-position-btn'));

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('reorders the list by the selected sort', async () => {
    const old = '2026-01-01T00:00:00.000Z';
    const recent = '2026-02-01T00:00:00.000Z';
    saveSavedRange({ id: 'r1', name: 'Alpha', hands: ['AA'], createdAt: old, updatedAt: old });
    saveSavedRange({ id: 'r2', name: 'Bravo', hands: ['AA'], createdAt: old, updatedAt: recent });

    const { getByTestId, getAllByTestId } = await render(<LibraryScreen />);

    // Default sort 'updated' -> most recently edited (Bravo / r2) first.
    expect(getAllByTestId(/^range-row-/)[0].props.testID).toBe('range-row-r2');

    fireEvent.press(getByTestId('sort-name'));

    await waitFor(() =>
      expect(getAllByTestId(/^range-row-/)[0].props.testID).toBe('range-row-r1'),
    );
  });

  it('duplicates a range', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId } = await render(<LibraryScreen />);
    fireEvent.press(getByTestId('duplicate-r1'));

    await waitFor(() => expect(loadSavedRanges()).toHaveLength(2));
    const names = loadSavedRanges().map((r) => r.name);
    expect(names).toContain('UTG Open');
    expect(names).toContain('UTG Open (copy)');
  });

  it('toggles a range favorite', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId } = await render(<LibraryScreen />);
    fireEvent.press(getByTestId('favorite-r1'));

    await waitFor(() => expect(loadSavedRanges()[0].favorite).toBe(true));
  });

  it('filters to favorites only', async () => {
    const ts = '2026-01-01T00:00:00.000Z';
    saveSavedRange({ id: 'r1', name: 'UTG Open', hands: ['AA'], createdAt: ts, updatedAt: ts });
    saveSavedRange({ id: 'r2', name: 'BTN Open', hands: ['AA'], createdAt: ts, updatedAt: ts, favorite: true });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();

    fireEvent.press(getByTestId('filter-favorites'));

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('archives a range (hidden by default) and reveals it with the toggle', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId, queryByText } = await render(<LibraryScreen />);

    fireEvent.press(getByTestId('archive-r1'));
    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(loadSavedRanges()[0].archived).toBe(true);

    fireEvent.press(getByTestId('toggle-archived'));
    await waitFor(() => expect(queryByText('UTG Open')).not.toBeNull());
  });

  it('shows per-range practice stats on the card', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 });

    const { getByTestId } = await render(<LibraryScreen />);

    expect(getByTestId('range-stats-r1')).toHaveTextContent(/10 attempts/);
    expect(getByTestId('range-stats-r1')).toHaveTextContent(/80%/);
  });

  it('shows no stats line for a never-practiced range', async () => {
    seed('r1', 'UTG Open');

    const { queryByTestId } = await render(<LibraryScreen />);

    expect(queryByTestId('range-stats-r1')).toBeNull();
  });
});
