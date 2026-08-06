import { render, userEvent } from '@testing-library/react-native';

import { saveSavedRange } from '@core/storage/rangeStorage';

import BoardScreen from '../app/board';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// The exact query-function type from a render result, so the helper's getByTestId matches
// what userEvent.press accepts (RNTL v14 uses its own instance type).
type GetByTestId = Awaited<ReturnType<typeof render>>['getByTestId'];

// The board explorer reads saved ranges (for the range-vs-board overlay), so it needs the
// MMKV-backed storage shim; expo-router's Stack.Screen is stubbed.
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

async function enterFlop(
  user: ReturnType<typeof userEvent.setup>,
  getByTestId: GetByTestId,
  cards: [string, string][],
): Promise<void> {
  for (const [rank, suit] of cards) {
    await user.press(getByTestId(`rank-${rank}`));
    await user.press(getByTestId(`suit-${suit}`));
  }
}

describe('BoardScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('tags a two-tone ace-high flop once three cards are entered', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BoardScreen />);

    expect(queryByTestId('board-texture')).toBeNull();

    await enterFlop(user, getByTestId, [
      ['A', 's'],
      ['K', 'd'],
      ['7', 's'],
    ]);

    // As Kd 7s: ace present, two spades (flush draw → wet), distinct unconnected ranks.
    expect(getByTestId('board-texture')).toBeTruthy();
    expect(getByTestId('texture-tag-aceHigh')).toBeTruthy();
    expect(getByTestId('texture-tag-twoTone')).toBeTruthy();
    expect(getByTestId('texture-tag-wet')).toBeTruthy();
    expect(queryByTestId('texture-tag-rainbow')).toBeNull();
    expect(queryByTestId('texture-tag-monotone')).toBeNull();
  });

  it('flags a duplicate card instead of a texture', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BoardScreen />);

    await enterFlop(user, getByTestId, [
      ['A', 's'],
      ['A', 's'],
      ['K', 'd'],
    ]);

    expect(getByTestId('board-error')).toBeTruthy();
    expect(queryByTestId('board-texture')).toBeNull();
  });

  it('overlays how a selected range hits the board', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Strong',
      hands: ['AA', 'KK', 'AKs'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const { getByTestId, getAllByTestId } = await render(<BoardScreen />);

    // Select the range, then enter the flop.
    await user.press(getByTestId('board-range-r1'));
    await enterFlop(user, getByTestId, [
      ['A', 's'],
      ['K', 'd'],
      ['7', 's'],
    ]);

    // The range hits As Kd 7s with sets (AA/KK over the paired board ranks).
    expect(getByTestId('range-vs-board')).toBeTruthy();
    expect(getAllByTestId(/^category-/).length).toBeGreaterThan(0);
    expect(getByTestId('category-set')).toBeTruthy();
  });

  it('shows no range-vs-board overlay before a range is selected', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Strong',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BoardScreen />);

    // Full flop but no range selected → no overlay.
    await enterFlop(user, getByTestId, [
      ['A', 's'],
      ['K', 'd'],
      ['7', 's'],
    ]);

    expect(queryByTestId('range-vs-board')).toBeNull();
  });
});
