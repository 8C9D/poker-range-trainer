import { render, userEvent, waitFor } from '@testing-library/react-native';

import type { DailyWorkout } from '@core/domain/dailyWorkout';
import { ALL_HANDS } from '@core/domain/pokerHands';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { saveTrainingGoal } from '@core/storage/trainingGoalStorage';
import { loadWorkoutCompletion } from '@core/storage/workoutStorage';
import type { SavedRange } from '@core/types/range';

import { WorkoutHost } from '../components/practice/WorkoutHost';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-haptics');

// Playing every hand makes "In range" always correct, so tests can answer
// deterministically without stubbing the random hand draw.
const everyHand: SavedRange = {
  id: 'a',
  name: 'Everything',
  hands: [...ALL_HANDS],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const btnOpen: SavedRange = {
  id: 'b',
  name: 'BTN open',
  hands: [...ALL_HANDS],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  metadata: { position: 'btn', actionType: 'open' },
};

function makeWorkout(overrides: Partial<DailyWorkout> = {}): DailyWorkout {
  return {
    segments: [
      {
        kind: 'review',
        ranges: [everyHand],
        questionsPerRange: 1,
        reason: '1 range due for review.',
      },
      {
        kind: 'freshSpots',
        format: { tableSize: 'sixMax', stackDepthBb: 100 },
        spotKeys: ['sixMax|btn|foldedToYou|-|100'],
        questionCount: 1,
        reason: 'Free play across the 1 spot your library covers.',
      },
    ],
    totalQuestions: 2,
    estimatedMinutes: 1,
    ...overrides,
  };
}

describe('WorkoutHost', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('opens on a hand-off naming the part and its reason', async () => {
    const user = userEvent.setup();
    const { getByTestId, getByText } = await render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={jest.fn()} />,
    );

    expect(getByText('Daily workout · Part 1 of 2')).toBeTruthy();
    expect(getByText('Review')).toBeTruthy();
    expect(getByTestId('workout-reason')).toHaveTextContent('1 range due for review.');

    await user.press(getByTestId('workout-continue'));
    expect(getByTestId('answer-yes')).toHaveTextContent('In range');
  });

  it('abandons without recording when closed before any answer', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={onClose} />,
    );

    await user.press(getByTestId('workout-continue'));
    await user.press(getByTestId('overlay-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(loadPracticeStats()).toEqual({});
    expect(loadReviewStates()).toEqual({});
  });

  it('keeps what was answered and jumps to the summary on an early close', async () => {
    const user = userEvent.setup();
    const { getByTestId, getByText, findByTestId } = await render(
      <WorkoutHost
        workout={makeWorkout({
          segments: [
            {
              kind: 'review',
              ranges: [everyHand],
              questionsPerRange: 5,
              reason: '1 range due for review.',
            },
          ],
        })}
        ranges={[everyHand, btnOpen]}
        onClose={jest.fn()}
      />,
    );

    await user.press(getByTestId('workout-continue'));
    await user.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    await user.press(getByTestId('overlay-close'));

    expect(getByText('1 of 1 correct')).toBeTruthy();
    expect(getByText('Review 1/1')).toBeTruthy();
    expect(loadPracticeStats().a.totalAttempts).toBe(1);
    // An early exit is not a completed workout: the card keeps offering the plan.
    expect(loadWorkoutCompletion()).toBeNull();
  });

  it('runs the segments back-to-back and sums them in one summary', async () => {
    const user = userEvent.setup();
    saveTrainingGoal(20);
    const onClose = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <WorkoutHost workout={makeWorkout()} ranges={[everyHand, btnOpen]} onClose={onClose} />,
    );

    // Part 1: the one-question review session.
    await user.press(getByTestId('workout-continue'));
    await user.press(getByTestId('answer-yes'));

    // The hand-off to part 2 arrives once the feedback dwell elapses.
    await waitFor(() => expect(getByText('Daily workout · Part 2 of 2')).toBeTruthy(), {
      timeout: 3000,
    });
    expect(getByText('Free play')).toBeTruthy();
    await user.press(getByTestId('workout-continue'));

    expect(getByTestId('spot-scenario')).toHaveTextContent(
      '6-max, 100bb. Folded to you in the BTN.',
    );
    await user.press(getByTestId('answer-yes'));

    // One combined summary: both answers, both contributions, both recorded.
    await waitFor(() => expect(getByText('2 of 2 correct')).toBeTruthy(), { timeout: 3000 });
    expect(getByText('Review 1/1 · Free play 1/1')).toBeTruthy();
    expect(loadPracticeStats().a.totalAttempts).toBe(1);
    expect(loadPracticeStats().b.totalAttempts).toBe(1);
    expect(loadSpotAccuracy()['sixMax|btn|foldedToYou|-|100']).toMatchObject({
      attempts: 1,
      correct: 1,
    });
    // A full run completes the workout for the day and reports goal progress.
    expect(loadWorkoutCompletion()).not.toBeNull();
    expect(getByText('2 of 20 hands — 18 to go.')).toBeTruthy();

    await user.press(await findByTestId('summary-done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('drills only the listed spots in a weak-spot segment', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(
      <WorkoutHost
        workout={makeWorkout({
          segments: [
            {
              kind: 'weakSpots',
              leaks: [],
              spotKeys: ['sixMax|btn|foldedToYou|-|100'],
              format: { tableSize: 'sixMax', stackDepthBb: 100 },
              questionCount: 1,
              reason: 'Your weakest spot.',
            },
          ],
        })}
        ranges={[everyHand, btnOpen]}
        onClose={jest.fn()}
      />,
    );

    await user.press(getByTestId('workout-continue'));
    // The BTN-open library covers several spots; the restriction deals just this one.
    expect(getByTestId('spot-scenario')).toHaveTextContent(
      '6-max, 100bb. Folded to you in the BTN.',
    );
  });
});
