import { render, userEvent } from '@testing-library/react-native';

import { saveSavedRange } from '@core/storage/rangeStorage';

import DiffScreen from '../app/diff';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub with no id (the user picks both ranges).
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

function seedRanges(): void {
  saveSavedRange({
    id: 'r1',
    name: 'Range One',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  saveSavedRange({
    id: 'r2',
    name: 'Range Two',
    hands: ['KK', 'QQ'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('DiffScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    seedRanges();
  });

  it('shows the membership diff once both ranges are picked', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<DiffScreen />);

    await user.press(getByTestId('diff-a-r1'));
    await user.press(getByTestId('diff-b-r2'));

    // r1 = {AA, KK}, r2 = {KK, QQ} → common KK, only-A AA, only-B QQ.
    expect(getByTestId('diff-summary-common')).toHaveTextContent('Both: 1');
    expect(getByTestId('diff-summary-onlyA')).toHaveTextContent('Only A: 1');
    expect(getByTestId('diff-summary-onlyB')).toHaveTextContent('Only B: 1');
    // The shared hand is bucketed as common; unique hands as only-A / only-B.
    expect(getByTestId('diff-cell-KK').props.accessibilityLabel).toBe('KK common');
    expect(getByTestId('diff-cell-AA').props.accessibilityLabel).toBe('AA onlyA');
    expect(getByTestId('diff-cell-QQ').props.accessibilityLabel).toBe('QQ onlyB');
  });

  it('shows a message when there are fewer than two ranges', async () => {
    localStorageShim.clear();
    saveSavedRange({
      id: 'solo',
      name: 'Solo',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const { getByText, queryByTestId } = await render(<DiffScreen />);

    expect(getByText(/Save at least two ranges/)).toBeTruthy();
    expect(queryByTestId('diff-a-solo')).toBeNull();
  });
});
