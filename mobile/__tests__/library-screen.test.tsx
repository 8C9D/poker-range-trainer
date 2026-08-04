import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ReactNode } from 'react';

import { loadPracticeStats, recordPracticeSession } from '@core/storage/practiceStatsStorage';
import {
  loadSessionHistory,
  recordPracticeSessionHistory,
} from '@core/storage/sessionHistoryStorage';
import { saveReviewState } from '@core/storage/reviewStateStorage';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import { STARTER_RANGE_TEMPLATES } from '@core/domain/starterRanges';
import type { SavedRange } from '@core/types/range';

import LibraryScreen from '../app/(tabs)/library';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. useFocusEffect is a no-op; the list's
// initial load comes from useState (seeded before render). Rows are Links (open the
// range page); management actions now live there, not on the row.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
// Named `mock*` so Jest allows the hoisted factory below to close over it.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ push: mockPush }),
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
    mockPush.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
  });

  it('lists saved ranges with thumbnails', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN Open' });

    const { getByText, getAllByTestId } = await render(<LibraryScreen />);

    expect(getByText('UTG Open')).toBeTruthy();
    expect(getByText('BTN Open')).toBeTruthy();
    expect(getAllByTestId('range-thumbnail')).toHaveLength(2);
  });

  it('announces what a row shows, not just the range name', async () => {
    seed({
      id: 'r1',
      name: 'UTG Open',
      favorite: true,
      tags: ['Starter'],
      metadata: { position: 'utg', actionType: 'open' },
    });

    const { getByTestId } = await render(<LibraryScreen />);

    // A Pressable's own label replaces its children for VoiceOver, so the chips
    // and the practice line have to be said in it or they reach nobody.
    const label = getByTestId('range-row-r1').props.accessibilityLabel;
    expect(label).toContain('Open range UTG Open');
    expect(label).toContain('favorite');
    expect(label).toContain('UTG');
    expect(label).toContain('Open');
    expect(label).toContain('due');
    expect(label).toContain('Starter');
    expect(label).toContain('not practiced');
  });

  it('shows an empty state when there are no ranges', async () => {
    const { getByTestId } = await render(<LibraryScreen />);

    expect(getByTestId('library-empty')).toBeTruthy();
  });

  it('fills an empty library with the starter pack in one action', async () => {
    const { getByTestId, getByText, queryByTestId } = await render(<LibraryScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('add-starter-ranges'));
    });

    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length);
    await waitFor(() => expect(queryByTestId('library-empty')).toBeNull());
    expect(getByText('BTN open (6-max 100bb)')).toBeTruthy();
  });

  it('filters the list by the search query', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN Open' });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.changeText(getByTestId('library-search'), 'btn');

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('searches by two words the name separates, in either order', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    seed({ id: 'r2', name: 'BTN 3-bet vs CO open' });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.changeText(getByTestId('library-search'), 'co btn');

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN 3-bet vs CO open')).toBeTruthy();
  });

  it('searches for the charts that play a hand', async () => {
    seed({ id: 'r1', name: 'UTG Open', hands: ['AA', 'KK'] });
    seed({ id: 'r2', name: 'BTN Open', hands: ['AA', 'KK', 'A5s'] });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    // "How do I play A5s?" — the library is the only screen that can answer it.
    await fireEvent.changeText(getByTestId('library-search'), 'a5s');

    await waitFor(() => expect(queryByText('UTG Open')).toBeNull());
    expect(getByText('BTN Open')).toBeTruthy();
  });

  it('searches by tag, so the box agrees with the tag filter beside it', async () => {
    seed({ id: 'r1', name: 'UTG Open', tags: ['MTT'] });
    seed({ id: 'r2', name: 'BTN Open', tags: ['cash'] });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.changeText(getByTestId('library-search'), 'mtt');

    await waitFor(() => expect(queryByText('BTN Open')).toBeNull());
    expect(getByText('UTG Open')).toBeTruthy();
  });

  it('searches the range’s scenario notes', async () => {
    seed({ id: 'r1', name: 'UTG Open', metadata: { notes: 'Widen vs a nitty BB.' } });
    seed({ id: 'r2', name: 'BTN Open' });

    const { getByTestId, getByText, queryByText } = await render(<LibraryScreen />);
    await fireEvent.changeText(getByTestId('library-search'), 'nitty');

    await waitFor(() => expect(queryByText('BTN Open')).toBeNull());
    expect(getByText('UTG Open')).toBeTruthy();
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

  it('clears search, sort, and metadata filters in one action', async () => {
    seed({ id: 'r1', name: 'Zebra', metadata: { position: 'utg' } });
    seed({ id: 'r2', name: 'Alpha', metadata: { position: 'btn' } });

    const { getByTestId, findByTestId, getByText, queryByText } = await render(
      <LibraryScreen />,
    );
    await fireEvent.changeText(getByTestId('library-search'), 'alpha');
    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(await findByTestId('sort-name'));
    await fireEvent.press(await findByTestId('filter-position-btn'));
    await waitFor(() => expect(queryByText('Zebra')).toBeNull());

    await fireEvent.press(getByTestId('clear-filters'));
    await waitFor(() => expect(getByText('Zebra')).toBeTruthy());
    expect(getByText('Alpha')).toBeTruthy();
    expect(getByTestId('library-search').props.value).toBe('');
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

  it('bulk deletes selected ranges after confirmation', async () => {
    seed({ id: 'r1', name: 'Keep' });
    seed({ id: 'r2', name: 'Delete me' });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });

    const { getByTestId, findByLabelText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select Delete me'));
    await findByLabelText('Deselect Delete me');
    await fireEvent.press(getByTestId('delete-selected'));

    await waitFor(() =>
      expect(loadSavedRanges().map((range) => range.name)).toEqual(['Keep']),
    );
  });

  it('frees the deleted ranges\u2019 recorded stats, not just the range records', async () => {
    seed({ id: 'r1', name: 'Keep' });
    seed({ id: 'r2', name: 'Delete me' });
    for (const id of ['r1', 'r2']) {
      recordPracticeSession(id, { totalQuestions: 10, correctAnswers: 8 });
      recordPracticeSessionHistory(id, { totalQuestions: 10, correctAnswers: 8 });
    }
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });

    const { getByTestId, findByLabelText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select Delete me'));
    await findByLabelText('Deselect Delete me');
    await fireEvent.press(getByTestId('delete-selected'));

    // Left behind, the records outlived the range for good, so freeing space by
    // deleting ranges did not actually free any.
    await waitFor(() => expect(Object.keys(loadPracticeStats())).toEqual(['r1']));
    expect(Object.keys(loadSessionHistory())).toEqual(['r1']);
  });

  it('bulk archives and unarchives selected ranges', async () => {
    seed({ id: 'r1', name: 'Keep' });
    seed({ id: 'r2', name: 'Archive me' });

    const { getByTestId, findByLabelText, findByText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select Archive me'));
    await fireEvent.press(getByTestId('archive-selected'));

    await waitFor(() => expect(loadSavedRanges().find((range) => range.id === 'r2')?.archived).toBe(true));

    await fireEvent.press(getByTestId('filters-toggle'));
    await fireEvent.press(getByTestId('toggle-archived'));
    await fireEvent.press(await findByLabelText('Select Archive me'));
    expect(await findByText('Unarchive')).toBeTruthy();
    await fireEvent.press(getByTestId('archive-selected'));

    await waitFor(() =>
      expect(loadSavedRanges().some((range) => range.archived)).toBe(false),
    );
  });

  it('reports a bulk action that could not be saved and keeps the list honest', async () => {
    seed({ id: 'r1', name: 'Keep' });
    seed({ id: 'r2', name: 'Archive me' });

    const { getByTestId, findByLabelText, findByText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select Archive me'));
    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    try {
      await fireEvent.press(getByTestId('archive-selected'));

      expect(await findByText(/storage is full or unavailable/)).toBeTruthy();
      // The row must not vanish as though it archived: nothing was written.
      expect(loadSavedRanges().some((range) => range.archived)).toBe(false);
      expect(await findByText('Archive me')).toBeTruthy();
    } finally {
      failing.mockRestore();
    }
  });

  it('bulk favorites and unfavorites selected ranges', async () => {
    seed({ id: 'r1', name: 'Keep' });
    seed({ id: 'r2', name: 'Favorite me' });

    const { getByTestId, findByLabelText, findByText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select Favorite me'));
    await fireEvent.press(getByTestId('favorite-selected'));

    await waitFor(() => expect(loadSavedRanges().find((range) => range.id === 'r2')?.favorite).toBe(true));

    await fireEvent.press(await findByLabelText('Select Favorite me'));
    expect(await findByText('Unfavorite')).toBeTruthy();
    await fireEvent.press(getByTestId('favorite-selected'));

    await waitFor(() =>
      expect(loadSavedRanges().some((range) => range.favorite)).toBe(false),
    );
  });

  it('toggles selection for every visible range', async () => {
    seed({ id: 'r1', name: 'One' });
    seed({ id: 'r2', name: 'Two' });

    const { getByTestId, findByText, findByLabelText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(getByTestId('select-visible'));

    expect(await findByText('2 selected')).toBeTruthy();
    await findByLabelText('Deselect One');
    await findByLabelText('Deselect Two');
    expect(await findByText('Deselect visible')).toBeTruthy();

    await fireEvent.press(getByTestId('select-visible'));
    expect(await findByText('0 selected')).toBeTruthy();
    await findByLabelText('Select One');
    await findByLabelText('Select Two');
  });

  it('drills the selected ranges as one queue', async () => {
    seed({ id: 'r1', name: 'BTN 3-bet' });
    seed({ id: 'r2', name: 'Skip me' });
    seed({ id: 'r3', name: 'SB 3-bet' });

    const { getByTestId, findByLabelText } = await render(<LibraryScreen />);
    await fireEvent.press(getByTestId('manage-ranges'));
    await fireEvent.press(await findByLabelText('Select SB 3-bet'));
    await fireEvent.press(await findByLabelText('Select BTN 3-bet'));
    await fireEvent.press(getByTestId('practice-selected'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/practice',
        // The queue follows the list, not the order the boxes were ticked.
        params: { queue: 'r1,r3', mode: 'recognize' },
      }),
    );
  });
});
