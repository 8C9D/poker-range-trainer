import { render, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { saveReviewState } from '@core/storage/reviewStateStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';
import { loadTrainingGoal, saveTrainingGoal } from '@core/storage/trainingGoalStorage';
import type { SavedRange } from '@core/types/range';

import TodayScreen from '../app/(tabs)/index';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + a minimal expo-router stub. Data is seeded before render and read
// by the screen's initial useState (useFocusEffect is a no-op here). The Link stub
// records where each link points, since that is where a card's action actually lives.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
// Named `mock*` so Jest allows the hoisted factory below to close over it.
const mockLinks: unknown[] = [];
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  Link: ({ children, href }: { children: ReactNode; href: unknown }) => {
    mockLinks.push(href);
    return children;
  },
}));

/** The recorded links that point at the practice route. */
function practiceLinks(): { pathname: string; params: Record<string, string> }[] {
  return mockLinks.filter(
    (href): href is { pathname: string; params: Record<string, string> } =>
      typeof href === 'object' && href !== null && 'pathname' in href,
  );
}

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
    mockLinks.length = 0;
  });

  it('shows the onboarding card when there are no ranges', async () => {
    const { getByTestId, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-onboarding')).toBeTruthy();
    expect(queryByTestId('start-review')).toBeNull();
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

  it('offers the next range early when nothing is due and nothing has gone wrong', async () => {
    seed('r1', 'UTG Open');
    saveReviewState({
      rangeId: 'r1',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByTestId, getByText, queryByTestId } = await render(<TodayScreen />);

    expect(getByTestId('today-caught-up')).toBeTruthy();
    expect(queryByTestId('start-review')).toBeNull();
    expect(getByText(/Get ahead: UTG Open comes round next/)).toBeTruthy();
    expect(getByTestId('free-practice')).toBeTruthy();
    expect(practiceLinks()).toContainEqual({
      pathname: '/practice',
      params: { queue: 'r1', mode: 'recognize' },
    });
  });

  it('offers the weak hands when caught up, restricted to the hands that went wrong', async () => {
    seed('r1', 'UTG Open');
    saveReviewState({
      rangeId: 'r1',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ]);

    const { getByText, getByTestId } = await render(<TodayScreen />);

    expect(getByText(/Sharpen the 1 hand you play worst/)).toBeTruthy();
    expect(getByTestId('free-practice')).toBeTruthy();
    expect(practiceLinks()).toContainEqual({
      pathname: '/practice',
      params: { queue: 'r1', mode: 'recognize', pools: JSON.stringify({ r1: ['AA'] }) },
    });
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

  it('reports a goal change the device store refused', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 12, correctAnswers: 9 },
      new Date().toISOString(),
    );
    saveTrainingGoal(20);

    const user = userEvent.setup();
    const { getByTestId } = await render(<TodayScreen />);
    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });

    await user.press(getByTestId('goal-40'));

    expect(getByTestId('goal-error')).toHaveTextContent(/storage is full or unavailable/);
    // The old target stands: the card never claims a goal that was not saved.
    expect(getByTestId('goal-line')).toHaveTextContent('12 of 20 hands — 8 to go.');
    expect(loadTrainingGoal()).toBe(20);
    failing.mockRestore();
  });
});
