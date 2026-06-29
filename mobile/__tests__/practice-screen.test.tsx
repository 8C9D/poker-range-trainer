import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';

import PracticeScreen from '../app/practice';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

// Seed a range containing ALL 169 hands so every random prompt is in range — makes
// the scoring deterministic without controlling getRandomPracticeHand's randomness.
function seedAllHandsRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'Everything',
    hands: generateHandMatrix().flat(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('PracticeScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('scores an in-range answer as correct and updates session stats', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-in'));

    await waitFor(() => {
      expect(getByTestId('feedback')).toHaveTextContent(/^Correct —/);
      expect(getByTestId('stat-total')).toHaveTextContent('Total: 1');
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 1');
      expect(getByTestId('stat-accuracy')).toHaveTextContent('Accuracy: 100%');
    });
  });

  it('scores an out-of-range answer as incorrect when the hand is in range', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-out'));

    await waitFor(() => {
      expect(getByTestId('feedback')).toHaveTextContent(/^Incorrect —/);
      expect(getByTestId('stat-total')).toHaveTextContent('Total: 1');
      expect(getByTestId('stat-correct')).toHaveTextContent('Correct: 0');
    });
  });

  it('lists a forgotten hand in the session review after answering out of range', async () => {
    seedAllHandsRange();
    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    // No mistakes yet, so the review section is not rendered.
    expect(queryByTestId('review-missed')).toBeNull();

    // Every hand is in range, so answering "out" makes the shown hand a missed
    // mistake. Read the hand before answering — answering re-randomizes it.
    const shownHand = getByTestId('practice-hand').props.children as string;
    fireEvent.press(getByTestId('answer-out'));

    await waitFor(() => {
      expect(getByTestId('review-missed')).toHaveTextContent(shownHand);
    });
  });

  it('folds each answered hand into the range cumulative practice stats', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    // Every hand is in range: "in" is correct, "out" is wrong.
    fireEvent.press(getByTestId('answer-in'));
    fireEvent.press(getByTestId('answer-out'));
    await waitFor(() => expect(getByTestId('stat-total')).toHaveTextContent('Total: 2'));

    const stats = loadPracticeStats().r1;
    expect(stats.totalAttempts).toBe(2);
    expect(stats.correctAttempts).toBe(1);
  });

  it('records nothing before any question is answered', async () => {
    seedAllHandsRange();
    await render(<PracticeScreen />);

    expect(loadPracticeStats().r1).toBeUndefined();
  });
});
