import { Alert } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import { STARTER_RANGE_TEMPLATES } from '@core/domain/starterRanges';
import { loadPracticeStats, recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import { loadTrainingGoal, saveTrainingGoal } from '@core/storage/trainingGoalStorage';

import { StarterRangesPanel } from '../components/StarterRangesPanel';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');

describe('StarterRangesPanel', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('adds the pack alongside the ranges already saved', async () => {
    saveSavedRange({
      id: 'mine',
      name: 'My own chart',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const { getByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('add-starter-ranges'));

    await waitFor(() =>
      expect(getByTestId('starter-status')).toHaveTextContent(
        `Added ${STARTER_RANGE_TEMPLATES.length} starter charts.`,
      ),
    );
    const names = loadSavedRanges().map((range) => range.name);
    expect(names).toHaveLength(STARTER_RANGE_TEMPLATES.length + 1);
    expect(names[0]).toBe('My own chart');
  });

  it('adds nothing a second time instead of duplicating the pack', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('add-starter-ranges'));
    await waitFor(() => expect(getByTestId('starter-status')).toHaveTextContent(/Added/));
    await user.press(getByTestId('add-starter-ranges'));

    await waitFor(() =>
      expect(getByTestId('starter-status')).toHaveTextContent(/already in your library/),
    );
    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length);
  });
});

describe('StarterRangesPanel reset', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    jest.restoreAllMocks();
  });

  /** A practiced library: a chart, a goal, and a recorded session. */
  function seedPracticed(): void {
    saveSavedRange({
      id: 'r1',
      name: 'UTG open',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    saveTrainingGoal(40);
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 8 });
  }

  /** Press the Alert's destructive button, as a user confirming would. */
  function confirmAlert(): void {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  }

  it('clears the records but keeps the charts and the goal', async () => {
    seedPracticed();
    confirmAlert();
    const user = userEvent.setup();
    const { getByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('reset-practice-stats'));

    await waitFor(() =>
      expect(getByTestId('starter-status')).toHaveTextContent(/your ranges are untouched/),
    );
    expect(loadPracticeStats()).toEqual({});
    // Clearing app data is the only other clean slate, and it takes these with it.
    expect(loadSavedRanges()).toHaveLength(1);
    expect(loadTrainingGoal()).toBe(40);
  });

  it('keeps everything when the reset is not confirmed', async () => {
    seedPracticed();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('reset-practice-stats'));

    expect(loadPracticeStats().r1.totalAttempts).toBe(10);
    expect(queryByTestId('starter-status')).toBeNull();
  });
});
