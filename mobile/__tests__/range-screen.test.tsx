import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as Linking from 'expo-linking';

import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import RangeScreen from '../app/range/[id]';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub. The id param is fixed to 'r1'; the not-found case
// simply seeds nothing. Links render children; router is a no-op.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `poker-range-trainer://${path}`),
  openURL: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  useFocusEffect: () => {},
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

function seed(range: Partial<SavedRange> & { id: string; name: string }): void {
  saveSavedRange({
    hands: ['AA', 'KK', 'AKs'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...range,
  });
}

describe('RangeScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('shows the range name and overview facts', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByText } = await render(<RangeScreen />);

    expect(getByText('UTG Open')).toBeTruthy();
    // Overview facts: 3 hands, combos, and percentage.
    expect(getByText(/3 hands ·/)).toBeTruthy();
  });

  it('counts a one-hand range in the singular', async () => {
    seed({ id: 'r1', name: 'Aces only', hands: ['AA'] });

    const { getByText } = await render(<RangeScreen />);

    expect(getByText(/1 hand · 6 combos/)).toBeTruthy();
  });

  it('gives the overview chart the hands it draws as its label', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId } = await render(<RangeScreen />);

    expect(getByTestId('range-thumbnail').props.accessibilityLabel).toBe(
      'Range chart: AA, AKs, KK',
    );
  });

  it('renders metadata chips', async () => {
    seed({ id: 'r1', name: 'UTG Open', metadata: { position: 'utg', actionType: 'open' } });

    const { getByText } = await render(<RangeScreen />);

    expect(getByText('UTG')).toBeTruthy();
  });

  it('opens web source references', async () => {
    seed({
      id: 'r1',
      name: 'UTG Open',
      source: { kind: 'solver', reference: 'https://example.com/utg-open' },
    });

    const { getByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('source-reference-link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/utg-open');
  });

  it('leaves source citations as plain text', async () => {
    seed({
      id: 'r1',
      name: 'UTG Open',
      source: { kind: 'solver', reference: 'GTOWizard 6-max' },
    });

    const { getByText, queryByTestId } = await render(<RangeScreen />);
    expect(getByText(/GTOWizard 6-max/)).toBeTruthy();
    expect(queryByTestId('source-reference-link')).toBeNull();
  });

  it('switches to the Edit tab', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-tab-edit'));

    expect(await findByTestId('range-name-input')).toBeTruthy();
  });

  it('shows the actions editor in the Actions tab', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-tab-actions'));

    expect(await findByTestId('action-cell-AA')).toBeTruthy();
  });

  it('shows the combo explorer in the Combos tab', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-tab-combos'));

    expect(await findByTestId('combo-hand-input')).toBeTruthy();
  });

  it('shows the frequencies editor in the Frequencies tab', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-tab-frequencies'));

    expect(await findByTestId('freq-hand-AA')).toBeTruthy();
  });

  it('shows the accuracy heatmap in the Stats tab when there is practice data', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ]);

    const { getByTestId, findByTestId, getByText } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-tab-stats'));

    expect(await findByTestId('heat-cell-AA')).toBeTruthy();
    expect(getByText('Weakest hands')).toBeTruthy();
  });

  it('opens the overflow menu and toggles favorite', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId, queryByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-menu-button'));
    // Export items are present in the menu.
    expect(await findByTestId('menu-copy-notation')).toBeTruthy();
    expect(getByTestId('menu-copy-csv')).toBeTruthy();
    // Cloud is unconfigured in tests (no session), so the publish item is gated out.
    expect(queryByTestId('menu-publish')).toBeNull();
    fireEvent.press(getByTestId('menu-favorite'));

    await waitFor(() => expect(loadSavedRanges()[0].favorite).toBe(true));
  });

  it('reports a menu action the device store refused', async () => {
    seed({ id: 'r1', name: 'UTG Open' });

    const { getByTestId, findByTestId } = await render(<RangeScreen />);
    fireEvent.press(getByTestId('range-menu-button'));
    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    fireEvent.press(await findByTestId('menu-favorite'));

    await waitFor(() =>
      expect(getByTestId('range-action-error')).toHaveTextContent(
        /storage is full or unavailable/,
      ),
    );
    // The favorite never happened, so the stored range must be untouched.
    expect(loadSavedRanges()[0].favorite).toBeUndefined();
    failing.mockRestore();
  });

  it('shows recent sessions in the overview', async () => {
    seed({ id: 'r1', name: 'UTG Open' });
    recordPracticeSessionHistory('r1', { totalQuestions: 10, correctAnswers: 9 }, '2026-06-01T00:00:00.000Z');

    const { getByText } = await render(<RangeScreen />);

    expect(getByText('Recent sessions')).toBeTruthy();
    expect(getByText(/9\/10 ·/)).toBeTruthy();
  });

  it('shows a not-found message when the range is missing', async () => {
    const { getByText } = await render(<RangeScreen />);

    expect(getByText(/This range does not exist/)).toBeTruthy();
  });
});
