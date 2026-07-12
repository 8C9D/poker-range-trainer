import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import { loadActionAccuracy } from '@core/storage/actionAccuracyStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { RangeAction } from '@core/types/range';

import { ActionQuizDrill } from '../components/practice/ActionQuizDrill';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

// Every assigned hand maps to Raise, so picking Raise is always correct regardless of which
// hand is drawn — deterministic without controlling the RNG.
const ALL_RAISE = { AA: 'raise', KK: 'raise', QQ: 'raise' } as Record<PokerHand, RangeAction>;

function seedRange(handActions?: Record<PokerHand, RangeAction>): void {
  saveSavedRange({
    id: 'r1',
    name: 'UTG Open',
    hands: ['AA', 'KK', 'QQ'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(handActions ? { handActions } : {}),
  });
}

describe('ActionQuizScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('scores a correct action and records per-action accuracy', async () => {
    seedRange(ALL_RAISE);
    const { getByTestId } = await render(<ActionQuizDrill id="r1" />);

    fireEvent.press(getByTestId('quiz-action-raise'));

    await waitFor(() => {
      expect(getByTestId('quiz-feedback')).toHaveTextContent('Correct');
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 1');
    });
    expect(loadActionAccuracy().r1?.raise?.attempts).toBe(1);
    expect(loadActionAccuracy().r1?.raise?.correct).toBe(1);
  });

  it('scores a wrong action as incorrect', async () => {
    seedRange(ALL_RAISE);
    const { getByTestId } = await render(<ActionQuizDrill id="r1" />);

    fireEvent.press(getByTestId('quiz-action-fold'));

    await waitFor(() => {
      expect(getByTestId('quiz-feedback')).toHaveTextContent(/^Incorrect/);
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 0');
    });
  });

  it('shows a message when the range has no assigned actions', async () => {
    seedRange();
    const { getByTestId, queryByTestId } = await render(<ActionQuizDrill id="r1" />);

    expect(getByTestId('no-actions')).toBeTruthy();
    expect(queryByTestId('quiz-hand')).toBeNull();
  });
});
