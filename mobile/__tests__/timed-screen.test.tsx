import { act, fireEvent, render } from '@testing-library/react-native';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';

import TimedScreen from '../app/timed';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

// Seed a range containing all 169 hands so every prompt is in range — "in" is always
// the correct answer, making scoring deterministic without controlling the RNG.
function seedAllHandsRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'Everything',
    hands: generateHandMatrix().flat(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('TimedScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    // Fake timers + a controlled clock: the screen reads Date.now() for the countdown,
    // and the 250ms interval is driven by advancing the timers explicitly. Each
    // interaction is wrapped in `await act(async () => …)` so the state update flushes
    // (under fake timers, a bare fireEvent.press does not commit on its own).
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs the countdown, scores answers, and ends when time is up', async () => {
    seedAllHandsRange();
    const { getByTestId, queryByTestId } = await render(<TimedScreen />);

    // Default duration is 60s. Start the drill → countdown + answer loop appear.
    await act(async () => {
      fireEvent.press(getByTestId('timed-start'));
    });
    expect(getByTestId('timed-remaining')).toBeTruthy();

    // Answer one hand correctly (every hand is in range → "in" is correct).
    await act(async () => {
      fireEvent.press(getByTestId('answer-in'));
    });
    expect(getByTestId('stat-total')).toHaveTextContent('Total: 1');

    // Advance past the 60s drill; the interval tick flips the screen to "over".
    await act(async () => {
      jest.setSystemTime(61_000);
      jest.advanceTimersByTime(300);
    });

    expect(getByTestId('timed-over')).toBeTruthy();
    expect(queryByTestId('answer-in')).toBeNull();
    // The single answer was recorded into the range's cumulative stats.
    expect(loadPracticeStats().r1.totalAttempts).toBe(1);
  });

  it('ignores answers once the drill is over', async () => {
    seedAllHandsRange();
    const { getByTestId, queryByTestId } = await render(<TimedScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('timed-start'));
    });

    // Let the clock expire before answering anything.
    await act(async () => {
      jest.setSystemTime(61_000);
      jest.advanceTimersByTime(300);
    });

    expect(getByTestId('timed-over')).toBeTruthy();
    // The answer buttons are gone and nothing was recorded.
    expect(queryByTestId('answer-in')).toBeNull();
    expect(loadPracticeStats().r1).toBeUndefined();
  });
});
