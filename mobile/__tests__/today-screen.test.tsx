import { render, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { saveReviewState } from '@core/storage/reviewStateStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { STARTER_RANGE_TEMPLATES } from '@core/domain/starterRanges';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import { loadTrainingGoal, saveTrainingGoal } from '@core/storage/trainingGoalStorage';
import { recordWorkoutCompletion } from '@core/storage/workoutStorage';
import type { SavedRange } from '@core/types/range';

import TodayScreen from '../app/(tabs)/index';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. Data is seeded before render and read
// by the screen's initial useState (useFocusEffect is a no-op here).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  Link: ({ children }: { children: ReactNode }) => children,
}));

function seed(id: string, name: string): void {
  const range: SavedRange = {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  saveSavedRange(range);
}

describe('TodayScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('shows the onboarding card when there are no ranges', async () => {
    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-onboarding')).toBeTruthy();
    expect(queryByTestId('start-review')).toBeNull();
  });

  it('fills an empty library with the starter pack and drops straight into training', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    await user.press(getByTestId('add-starter-ranges'));

    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length);
    // The welcome card gives way to the real dashboard without leaving the tab.
    expect(queryByTestId('today-onboarding')).toBeNull();
    expect(getByTestId('start-review')).toBeTruthy();
  });

  it('reports a failed starter save instead of leaving the button dead', async () => {
    const user = userEvent.setup();
    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    const { getByTestId } = await render(<TodayScreen />);

    await user.press(getByTestId('add-starter-ranges'));

    expect(getByTestId('starter-error')).toHaveTextContent(/storage is full or unavailable/);
    expect(getByTestId('today-onboarding')).toBeTruthy();
    failing.mockRestore();
  });

  it('surfaces the due queue and start-review CTA for never-practiced ranges', async () => {
    seed('r1', 'UTG Open');
    seed('r2', 'BTN Open');

    const { getByTestId } = await render(<TodayScreen />);

    // Never-reviewed ranges count as due.
    expect(getByTestId('start-review')).toBeTruthy();
    expect(getByTestId('due-row-r1')).toBeTruthy();
    expect(getByTestId('due-row-r2')).toBeTruthy();
  });

  it('shows the all-caught-up card when nothing is due', async () => {
    seed('r1', 'UTG Open');
    saveReviewState({
      rangeId: 'r1',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-caught-up')).toBeTruthy();
    expect(queryByTestId('start-review')).toBeNull();
  });

  it('shows a streak chip from recent session history', async () => {
    seed('r1', 'UTG Open');
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    recordPracticeSessionHistory('r1', { totalQuestions: 1, correctAnswers: 1 }, today.toISOString());
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 1, correctAnswers: 1 },
      yesterday.toISOString(),
    );

    const { getByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-streak')).toBeTruthy();
  });

  it('shows this-week hands answered in the tiles', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 });
    recordPracticeSessionHistory('r1', { totalQuestions: 10, correctAnswers: 8 }, new Date().toISOString());

    const { getByTestId } = await render(<TodayScreen />);

    expect(getByTestId('week-hands')).toHaveTextContent('10');
    expect(getByTestId('week-accuracy')).toHaveTextContent('80%');
  });

  it('does not let a deleted range replace the sharpest live range', async () => {
    seed('live', 'UTG Open');
    recordPracticeSessionHistory(
      'live',
      { totalQuestions: 10, correctAnswers: 8 },
      new Date().toISOString(),
    );
    recordPracticeSessionHistory(
      'deleted',
      { totalQuestions: 10, correctAnswers: 10 },
      new Date().toISOString(),
    );

    const { getByTestId } = await render(<TodayScreen />);

    expect(getByTestId('week-sharpest')).toHaveTextContent('UTG Open');
  });
  it('tracks the daily goal and persists a change to it', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 12, correctAnswers: 9 },
      new Date().toISOString(),
    );
    saveTrainingGoal(20);

    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('goal-line')).toHaveTextContent('12 of 20 hands — 8 to go.');
    expect(getByTestId('goal-bar')).toBeTruthy();

    await user.press(getByTestId('goal-10'));
    expect(getByTestId('goal-line')).toHaveTextContent('Goal met — 12 hands today.');
    expect(loadTrainingGoal()).toBe(10);

    await user.press(getByTestId('goal-0'));
    expect(getByTestId('goal-line')).toHaveTextContent('No daily goal set.');
    expect(queryByTestId('goal-bar')).toBeNull();
    expect(loadTrainingGoal()).toBe(0);
  });
});

describe('TodayScreen spot drill entry', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('is hidden while no range describes a situation', async () => {
    seed('r1', 'Unlabelled');
    const { queryByTestId } = await render(<TodayScreen />);

    expect(queryByTestId('today-spots')).toBeNull();
  });

  it('offers the drill once a range covers a spot', async () => {
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    const { getByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-spots')).toHaveTextContent(/1 of 65 spots covered/);
    expect(getByTestId('play-spots')).toBeTruthy();
  });
});

describe('TodayScreen daily workout', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('offers the composed workout as the primary action', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-workout')).toHaveTextContent(/\d+ hands · 1 review · ~\d+ min/);
    expect(getByTestId('start-workout')).toBeTruthy();
  });

  it('is hidden when there is nothing to plan', async () => {
    seed('r1', 'Unlabelled');
    saveReviewState({
      rangeId: 'r1',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });

    const { queryByTestId } = await render(<TodayScreen />);

    expect(queryByTestId('today-workout')).toBeNull();
  });
});

describe('TodayScreen workout done state', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('flips the card to done for the rest of the day', async () => {
    seed('r1', 'UTG Open');
    saveTrainingGoal(20);
    recordWorkoutCompletion(new Date().toISOString());

    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-workout-done')).toHaveTextContent(/Done for today\. 0 of 20 hands/);
    expect(queryByTestId('start-workout')).toBeNull();
  });

  it('re-offers the plan when the completion is from an earlier day', async () => {
    seed('r1', 'UTG Open');
    recordWorkoutCompletion('2026-01-05T09:00:00.000Z');

    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('start-workout')).toBeTruthy();
    expect(queryByTestId('today-workout-done')).toBeNull();
  });
});
