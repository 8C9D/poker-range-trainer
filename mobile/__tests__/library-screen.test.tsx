import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { saveReviewState } from '@core/storage/reviewStateStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import LibraryScreen from '../app/(tabs)/library';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. useFocusEffect is a no-op; the list's
// initial load comes from useState (seeded before render). Rows are Links (open the
// range page); management actions now live there, not on the row.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  Link: ({ children }: { children: ReactNode }) => children,
}));

function seed(range: Partial<SavedRange> & { id: string; name: string }): void {
  saveSavedRange({
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...range,
  });
}

describe('LibraryScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('lists saved ranges with thumbnails', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN Open' });

    const { getByText, getAllByTestId } = await render(<LibraryScreen />);

    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();
    expect(getAllByTestId('range-thumbnail')).toHaveLength(2);
  });

  it('shows an empty state when there are no ranges', async () => {
    const { getByTestId } = await render(<LibraryScreen />);

    expect(getByTestId('library-empty')).toBeTruthy();
  });

  it('filters the list by the search query', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN Open' });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.changeText(getByTestId('library-search'), 'btn');

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('filters by a position chip from the collapsed filters', async () => {
    seed({ id: 'r1', name: 'UTG Open', metadata: { position: 'utg' } });
    seed({ id: 'r2', name: 'BTN Open', metadata: { position: 'btn' } });

    const { getByTestId, findByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('filter-position-btn'));

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('reorders by the name sort', async () => {
    seed({ id: 'r2', name: 'Bravo' });
    seed({ id: 'r1', name: 'Alpha' });

    const { getByTestId, findByTestId, getAllByTestId } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('sort-name'));

    await waitFor(() =>
      expect(getAllByTestId(/^range-row-/)[0].props.testID).toBe('range-row-r1'),
    );
  });

  it('filters to favorites only', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN Open', favorite: true });

    const { getByTestId, findByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('filter-favorites'));

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('hides archived ranges until the toggle reveals them', async () => {
    seed({ id: 'r1', name: 'UTG Open', archived: true });

    const { getByTestId, findByTestId, queryByText } = await render(<LibraryScreen />);
    expect(queryByText('UTG Open')).toBeNull();

    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('toggle-archived'));

    await waitFor(() => expect(queryByText('UTG Open')).not.toBeNull());
  });

  it('filters by a tag chip and shows tag chips on rows', async () => {
    seed({ id: 'r1', name: 'UTG Open', tags: ['MTT'] });
    seed({ id: 'r2', name: 'BTN Open', tags: ['Cash'] });
    seed({ id: 'r3', name: 'SB Open' });

    const { getByTestId, findByTestId, getByText, queryByText } = await render(<LibraryScreen />);

    // Each row shows its tag chips.
    expect(getByText('MTT')).toBeTruthy();
    expect(getByText('Cash')).toBeTruthy();

    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('filter-tag-MTT'));

    await waitFor(() => expect(queryByText('BTN Open')).toBeNull());
    expect(queryByText('SB Open')).toBeNull();
    expect(getByText('UTG Open')).toBeTruthy();
  });

  it('offers no tag filter when no range carries a tag', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId, queryByTestId } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('filters-toggle'));

    // The other filter groups appear, but no tag group.
    await findByTestId('filter-position-btn');
    expect(queryByTestId('filter-tag-MTT')).toBeNull();
  });

  it('shows per-range accuracy on the row', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 });

    const { getByTestId } = await render(<LibraryScreen />);

    expect(getByTestId('range-stats-r1')).toHaveTextContent('80%');
  });

  it('badges a due range but not one scheduled in the future', async () => {
    seed({ id: 'r1', name: 'Due Range' });
    seed({ id: 'r2', name: 'Future Range' });
    saveReviewState({
      rangeId: 'r2',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByTestId, queryByTestId } = await render(<LibraryScreen />);

    // r1 was never reviewed -> due; r2 is scheduled far in the future -> not due.
    expect(getByTestId('due-r1')).toBeTruthy();
    expect(queryByTestId('due-r2')).toBeNull();
  });
});
