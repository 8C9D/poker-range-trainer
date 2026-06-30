import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
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

    // Every hand is in range: "in" is correct, "out" is wrong. Await each press to
    // settle before the next — back-to-back un-awaited presses overlap act() scopes
    // and can corrupt React's scheduler for later tests in this file.
    fireEvent.press(getByTestId('answer-in'));
    await waitFor(() => expect(getByTestId('stat-total')).toHaveTextContent('Total: 1'));
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

  it('folds each answered hand into cumulative per-hand accuracy', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    // Every hand is in range, so answering "out" is a false negative for that hand.
    const shownHand = getByTestId('practice-hand').props.children as PokerHand;
    fireEvent.press(getByTestId('answer-out'));
    await waitFor(() => expect(getByTestId('stat-total')).toHaveTextContent('Total: 1'));

    const stat = loadHandAccuracy().r1[shownHand];
    expect(stat.attempts).toBe(1);
    expect(stat.correct).toBe(0);
    expect(stat.falseNegatives).toBe(1);
  });

  it('records no per-hand accuracy before any question is answered', async () => {
    seedAllHandsRange();
    await render(<PracticeScreen />);

    expect(loadHandAccuracy().r1).toBeUndefined();
  });

  it('lists the range weakest hands after a wrong answer', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    // Every hand is in range, so answering "out" gives the shown hand 0% accuracy.
    const shownHand = getByTestId('practice-hand').props.children as PokerHand;
    fireEvent.press(getByTestId('answer-out'));
    await waitFor(() => expect(getByTestId('stat-total')).toHaveTextContent('Total: 1'));

    // Only the one answered hand has attempts, so it is the sole weakest chip at 0%.
    expect(getByTestId('weakest-hands')).toHaveTextContent(`${shownHand} 0%`);
  });

  it('shows no weakest-hands section before any question is answered', async () => {
    seedAllHandsRange();
    const { queryByTestId } = await render(<PracticeScreen />);

    expect(queryByTestId('weakest-hands')).toBeNull();
  });

  it('restricts prompts to the mistakes pool when Mistakes only is enabled', async () => {
    seedAllHandsRange();
    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    // No mistakes yet → no toggle.
    expect(queryByTestId('toggle-mistakes-only')).toBeNull();

    // Answer the shown hand wrong so it becomes the sole mistake in the pool.
    const missed = getByTestId('practice-hand').props.children as PokerHand;
    fireEvent.press(getByTestId('answer-out'));
    await waitFor(() => expect(getByTestId('toggle-mistakes-only')).toBeTruthy());

    // Enabling the drill redraws from the single-hand pool, so that hand is prompted.
    fireEvent.press(getByTestId('toggle-mistakes-only'));
    await waitFor(() => expect(getByTestId('practice-hand')).toHaveTextContent(missed));
  });

  it('shows the accuracy heatmap once a hand has been answered', async () => {
    seedAllHandsRange();
    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    // No accuracy yet → no heatmap.
    expect(queryByTestId('accuracy-heatmap')).toBeNull();

    fireEvent.press(getByTestId('answer-out'));
    await waitFor(() => expect(getByTestId('accuracy-heatmap')).toBeTruthy());
  });
});
