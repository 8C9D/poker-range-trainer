import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { HandMixedStrategy } from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';
import { saveSavedRange } from '@core/storage/rangeStorage';

import { MixedQuizDrill } from '../components/practice/MixedQuizDrill';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

// Exactly ONE hand carries a strategy, so the draw is deterministic without controlling the RNG.
// AA's primary action is raise (60 > 40).
const ONE_STRATEGY: Record<PokerHand, HandMixedStrategy> = {
  AA: [
    { action: 'raise', frequency: 60 },
    { action: 'call', frequency: 40 },
  ],
};

function seedRange(mixedStrategies?: Record<PokerHand, HandMixedStrategy>): void {
  saveSavedRange({
    id: 'r1',
    name: 'UTG Open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(mixedStrategies ? { mixedStrategies } : {}),
  });
}

describe('MixedQuizScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('scores the primary action as correct', async () => {
    seedRange(ONE_STRATEGY);
    const { getByTestId } = await render(<MixedQuizDrill id="r1" />);

    expect(getByTestId('quiz-hand')).toHaveTextContent('AA');
    fireEvent.press(getByTestId('mixed-action-raise'));

    await waitFor(() => {
      expect(getByTestId('quiz-feedback')).toHaveTextContent('Correct');
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 1');
    });
  });

  it('scores a different action as incorrect', async () => {
    seedRange(ONE_STRATEGY);
    const { getByTestId } = await render(<MixedQuizDrill id="r1" />);

    fireEvent.press(getByTestId('mixed-action-fold'));

    await waitFor(() => {
      expect(getByTestId('quiz-feedback')).toHaveTextContent(/^Incorrect/);
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 0');
    });
  });

  it('shows a message when the range has no mixed frequencies', async () => {
    seedRange();
    const { getByTestId, queryByTestId } = await render(<MixedQuizDrill id="r1" />);

    expect(getByTestId('no-frequencies')).toBeTruthy();
    expect(queryByTestId('quiz-hand')).toBeNull();
  });
});
