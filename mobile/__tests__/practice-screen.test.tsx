import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { ReactNode } from 'react';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { loadActionAccuracy } from '@core/storage/actionAccuracyStorage';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { loadSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';

import PracticeScreen from '../app/practice';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub. useLocalSearchParams is a jest.fn so each test can
// set the practice request (single range / mode / missing range).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockParams = require('expo-router').useLocalSearchParams as jest.Mock;

// A range containing ALL 169 hands so every random prompt is in range — makes scoring
// deterministic without controlling the RNG.
function seedAllHandsRange(id = 'r1', name = 'Everything'): void {
  saveSavedRange({
    id,
    name,
    hands: generateHandMatrix().flat(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

/** Seed a previous recognition session so the summary has something to compare against. */
function seedPriorSession(totalQuestions: number, correctAnswers: number): void {
  localStorage.setItem(
    'poker-range-trainer.session-history.v1',
    JSON.stringify({
      r1: [{ rangeId: 'r1', playedAt: '2026-07-10T10:00:00.000Z', totalQuestions, correctAnswers }],
    }),
  );
}

describe('PracticeScreen (overlay host)', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    mockParams.mockReturnValue({ id: 'r1', mode: 'recognize' });
    // Snap the summary ring to its final value instead of animating so no
    // Animated timers outlive the test.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it('runs the recognition drill and scores an in-range answer as correct', async () => {
    seedAllHandsRange();
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('playing-cards')).toBeTruthy();
    fireEvent.press(getByTestId('answer-yes'));

    expect(await findByTestId('drill-feedback')).toHaveTextContent(/^Correct —/);
  });

  it('drops invalid hands from a deep-linked practice pool', async () => {
    seedAllHandsRange();
    mockParams.mockReturnValue({ id: 'r1', mode: 'recognize', pool: 'not-a-hand,AA' });

    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('drill-hand')).toHaveTextContent('AA');
  });

  it('uses the first value from repeated deep-link parameters', async () => {
    seedAllHandsRange();
    mockParams.mockReturnValue({
      id: ['r1', 'missing'],
      mode: ['recognize', 'spots'],
      pool: ['AA', 'not-a-hand'],
    });

    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('drill-hand')).toHaveTextContent('AA');
  });

  it('explains a missed hand and stays quiet after a hit', async () => {
    // Every hand is in range, so answering "fold" is always a miss.
    seedAllHandsRange();
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-no'));

    expect(await findByTestId('drill-why')).toHaveTextContent(/this range plays \d+ of \d+/);
  });

  it('hands back the user’s own note on a missed hand', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Pairs',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handNotes: { AA: 'Only 4-bet vs a nit.' },
    });
    // Deal only AA, which the chart plays, so folding it is a miss.
    mockParams.mockReturnValue({ id: 'r1', mode: 'recognize', pool: 'AA' });
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-no'));

    expect(await findByTestId('drill-note')).toHaveTextContent('Your note: Only 4-bet vs a nit.');
  });

  it('says nothing about a missed hand the user never noted', async () => {
    seedAllHandsRange();
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-no'));
    await findByTestId('drill-why');

    expect(queryByTestId('drill-note')).toBeNull();
  });

  it('holds a missed hand until the user taps Next', async () => {
    // Every hand is in range, so answering "fold" is always a miss.
    seedAllHandsRange();
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-no'));
    await findByTestId('drill-next');

    // Well past any dwell the drill used to auto-advance on.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(queryByTestId('drill-why')).not.toBeNull();

    fireEvent.press(getByTestId('drill-next'));

    await waitFor(() => expect(queryByTestId('drill-why')).toBeNull());
    expect(getByTestId('answer-no')).toBeTruthy();
  });

  it('does not explain a hand the user got right', async () => {
    seedAllHandsRange();
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-yes'));

    expect(await findByTestId('drill-feedback')).toHaveTextContent(/^Correct —/);
    expect(queryByTestId('drill-why')).toBeNull();
  });

  it('opens the mode picker when no preset mode is given', async () => {
    seedAllHandsRange();
    mockParams.mockReturnValue({ id: 'r1' });

    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('mode-recognize')).toBeTruthy();
    expect(getByTestId('mode-timed')).toBeTruthy();
    // A plain range has no action chart or mixed strategies, so those quizzes stay hidden.
    expect(queryByTestId('mode-action')).toBeNull();
    expect(queryByTestId('mode-mixed')).toBeNull();
  });

  it('offers an edge drill that prompts only from the range boundary', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Tight',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockParams.mockReturnValue({ id: 'r1' });

    const { getByTestId, findByTestId } = await render(<PracticeScreen />);
    fireEvent.press(getByTestId('mode-edges'));

    const edge = ['AA', 'AKs', 'AKo', 'KK', 'KQs', 'AQo', 'KQo'];
    expect(edge).toContain((await findByTestId('drill-hand')).props.children);
  });

  it('hides the edge drill for a range with no boundary', async () => {
    // Every hand is in range, so there is no boundary at all.
    seedAllHandsRange();
    mockParams.mockReturnValue({ id: 'r1' });

    const { queryByTestId } = await render(<PracticeScreen />);

    expect(queryByTestId('mode-edges')).toBeNull();
  });

  it('offers the action and frequency quizzes when the range has the data', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Charted',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handActions: { AA: 'raise' },
      mixedStrategies: { KK: [{ action: 'raise', frequency: 100 }] },
    });
    mockParams.mockReturnValue({ id: 'r1' });

    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('mode-action')).toBeTruthy();
    expect(getByTestId('mode-mixed')).toBeTruthy();
  });

  it('ends the action quiz on a summary recapping the action each hand wanted', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Charted',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handActions: { AA: 'raise' },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'action' });
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    // Only AA is assigned, so calling it is a miss the recap has to explain.
    fireEvent.press(getByTestId('quiz-action-call'));
    await findByTestId('quiz-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    await findByTestId('summary-done');
    expect(getByTestId('summary-misses')).toHaveTextContent(/Raise these: AA/);
    // The drill records each answer itself; the summary must not double-count.
    expect(loadActionAccuracy().r1).toEqual({
      raise: { action: 'raise', attempts: 1, correct: 0 },
    });
  });

  it('counts the action quiz as a session so the day and the schedule move', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Charted',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handActions: { AA: 'raise' },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'action' });
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('quiz-action-raise'));
    await findByTestId('quiz-feedback');
    fireEvent.press(getByTestId('overlay-close'));
    await findByTestId('summary-done');

    // Answering hands and then being told you have practiced nothing today is the
    // app contradicting itself, so an action quiz counts like any session.
    expect(loadPracticeStats().r1.totalAttempts).toBe(1);
    expect(loadSessionHistory().r1).toHaveLength(1);
    expect(loadReviewStates().r1.dueAt).not.toBe('');
    // The in/out record stays untouched: the quiz never asked that question.
    expect(loadHandAccuracy().r1).toBeUndefined();
  });

  it('counts a checked build from memory as a session', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Pairs',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'build' });
    const user = userEvent.setup();
    const { getByTestId } = await render(<PracticeScreen />);

    // Rebuild AA only: one right, one forgotten. The grid cells sit inside a
    // gesture detector, so they need a full press, not a bare press event.
    await user.press(getByTestId('hand-cell-AA'));
    await user.press(getByTestId('build-check'));

    expect(loadPracticeStats().r1).toMatchObject({ totalAttempts: 2, correctAttempts: 1 });
    expect(loadSessionHistory().r1).toHaveLength(1);
    expect(loadReviewStates().r1.dueAt).not.toBe('');
    // The in/out record stays untouched: a build never answered hand by hand.
    expect(loadHandAccuracy().r1).toBeUndefined();
  });

  it('re-quizzes only the hands whose action went wrong', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Charted',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handActions: { AA: 'raise', KK: 'call' },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'action' });
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    // Folding is wrong for both assigned hands, so whichever was prompted misses.
    const missed = getByTestId('quiz-hand').props.children;
    fireEvent.press(getByTestId('quiz-action-fold'));
    await findByTestId('quiz-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    fireEvent.press(await findByTestId('summary-drill-misses'));

    // Back in the quiz over a pool of one, so the next question repeats the hand.
    await waitFor(() => expect(queryByTestId('summary-done')).toBeNull());
    expect(getByTestId('quiz-hand')).toHaveTextContent(missed);
    fireEvent.press(getByTestId('quiz-action-fold'));
    await findByTestId('quiz-feedback');
    expect(getByTestId('quiz-hand')).toHaveTextContent(missed);
  });

  it('abandons the action quiz when closed before any answer', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Charted',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handActions: { AA: 'raise' },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'action' });
    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('overlay-close'));

    await waitFor(() => expect(queryByTestId('summary-done')).toBeNull());
  });

  it('ends the frequency quiz on a summary recapping the primary action', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Mixed',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mixedStrategies: {
        AA: [
          { action: 'raise', frequency: 70 },
          { action: 'call', frequency: 30 },
        ],
      },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'mixed' });
    const { getByTestId, getByText, findByTestId } = await render(<PracticeScreen />);

    // Calling AA is wrong: raise is the more frequent (primary) action.
    fireEvent.press(getByTestId('mixed-action-call'));
    await findByTestId('quiz-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    await findByTestId('summary-done');
    expect(getByText('0 of 1 correct')).toBeTruthy();
    expect(getByTestId('summary-misses')).toHaveTextContent(/Raise these: AA/);
    // The session counts like any other; its answers are about frequencies, so
    // neither the action store nor the in/out record may absorb them.
    expect(loadSessionHistory().r1).toHaveLength(1);
    expect(loadPracticeStats().r1.totalAttempts).toBe(1);
    expect(loadActionAccuracy().r1).toBeUndefined();
    expect(loadHandAccuracy().r1).toBeUndefined();
  });

  it('re-quizzes only the hands whose primary action went wrong', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Mixed',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mixedStrategies: {
        AA: [
          { action: 'raise', frequency: 70 },
          { action: 'call', frequency: 30 },
        ],
        KK: [
          { action: 'raise', frequency: 60 },
          { action: 'call', frequency: 40 },
        ],
      },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'mixed' });
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    // Folding is never primary here, so whichever hand was prompted misses.
    const missed = getByTestId('quiz-hand').props.children;
    fireEvent.press(getByTestId('mixed-action-fold'));
    await findByTestId('quiz-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    fireEvent.press(await findByTestId('summary-drill-misses'));

    // Back in the quiz over a pool of one, so the next question repeats the hand.
    await waitFor(() => expect(queryByTestId('summary-done')).toBeNull());
    expect(getByTestId('quiz-hand')).toHaveTextContent(missed);
    fireEvent.press(getByTestId('mixed-action-fold'));
    fireEvent.press(await findByTestId('mixed-next'));
    expect(getByTestId('quiz-hand')).toHaveTextContent(missed);
  });

  it('abandons the frequency quiz when closed before any answer', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Mixed',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mixedStrategies: { AA: [{ action: 'raise', frequency: 100 }] },
    });
    mockParams.mockReturnValue({ id: 'r1', mode: 'mixed' });
    const { getByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('overlay-close'));

    await waitFor(() => expect(queryByTestId('summary-done')).toBeNull());
  });

  it('finishes a session into the summary and records every store', async () => {
    seedAllHandsRange();
    const { getByTestId, getByText, findByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    await findByTestId('summary-done');
    expect(getByText('1 of 1 correct')).toBeTruthy();
    expect(getByText('First session logged — that’s your baseline.')).toBeTruthy();

    // The shared recorder persisted all four stores plus the review schedule.
    expect(loadPracticeStats().r1).toMatchObject({ totalAttempts: 1, correctAttempts: 1 });
    expect(Object.keys(loadHandAccuracy().r1 ?? {})).toHaveLength(1);
    expect(loadSessionHistory().r1).toHaveLength(1);
    expect(loadReviewStates().r1).toBeDefined();
  });

  it('still shows the summary when the session cannot be saved', async () => {
    seedAllHandsRange();
    const { getByTestId, getByText, findByTestId } = await render(<PracticeScreen />);

    // A full device store from here on: the run is lost, but the numbers are in
    // memory, so the user must still see how they did and why nothing saved.
    const failing = jest.spyOn(localStorageShim, 'setItem').mockImplementation(() => {
      throw new Error('mmkv: no space left on device');
    });
    try {
      fireEvent.press(getByTestId('answer-yes'));
      await findByTestId('drill-feedback');
      fireEvent.press(getByTestId('overlay-close'));

      await findByTestId('summary-done');
      expect(getByText('1 of 1 correct')).toBeTruthy();
      expect(getByTestId('summary-save-error')).toHaveTextContent(
        /storage is full or unavailable/,
      );
    } finally {
      failing.mockRestore();
    }
  });

  it('frames an improved session as points up from the last one', async () => {
    seedAllHandsRange();
    seedPriorSession(10, 5);
    const { getByTestId, findByTestId, findByText } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    expect(await findByText('Up 50 points from your last session.')).toBeTruthy();
  });

  it('reports holding steady when accuracy matches the previous session', async () => {
    seedAllHandsRange();
    seedPriorSession(10, 10);
    const { getByTestId, findByTestId, findByText } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    expect(await findByText('Held steady at 100%.')).toBeTruthy();
  });

  it('frames a weaker session around the queued misses', async () => {
    seedAllHandsRange();
    seedPriorSession(10, 10);
    const { getByTestId, findByTestId, findByText } = await render(<PracticeScreen />);

    // Every hand is in range, so answering Fold is a miss.
    fireEvent.press(getByTestId('answer-no'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    expect(
      await findByText('1 miss queued for review — they’ll show up more until they stick.'),
    ).toBeTruthy();
  });

  it('advances the review queue and records each range', async () => {
    seedAllHandsRange('r1', 'First range');
    seedAllHandsRange('r2', 'Second range');
    mockParams.mockReturnValue({ queue: 'r1,r2', mode: 'recognize' });

    const { getByTestId, getByText, findByTestId, queryByTestId } = await render(
      <PracticeScreen />,
    );

    expect(getByText(/1\/2/)).toBeTruthy();
    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));
    fireEvent.press(await findByTestId('summary-next'));

    expect(await findByTestId('playing-cards')).toBeTruthy();
    expect(getByText(/2\/2/)).toBeTruthy();
    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    // Last range in the queue: only Done remains, and both sessions were recorded.
    await findByTestId('summary-done');
    expect(queryByTestId('summary-next')).toBeNull();
    expect(loadSessionHistory().r1).toHaveLength(1);
    expect(loadSessionHistory().r2).toHaveLength(1);
  });

  it('records nothing when the drill is closed before any answer', async () => {
    seedAllHandsRange();
    const { getByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('overlay-close'));

    await waitFor(() => expect(loadSessionHistory().r1).toBeUndefined());
  });

  it('shows a not-found message when the range is missing', async () => {
    mockParams.mockReturnValue({ id: 'missing' });

    const { getByText } = await render(<PracticeScreen />);

    expect(getByText('Range not found.')).toBeTruthy();
  });
});

describe('PracticeScreen spot drill', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    mockParams.mockReturnValue({ mode: 'spots', table: 'sixMax', stack: '100' });
  });

  it('deals from the whole library and records against the grading range', async () => {
    // Every hand is in range, so answering "open" always scores correct.
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: generateHandMatrix().flat(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    const { getByTestId, findByTestId, getByText } = await render(<PracticeScreen />);

    expect(getByTestId('spot-scenario')).toHaveTextContent(
      '6-max, 100bb. Folded to you on the BTN.',
    );
    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    await findByTestId('summary-done');
    expect(getByText('Across 1 range of your library.')).toBeTruthy();
    expect(loadPracticeStats().btn.totalAttempts).toBe(1);
    // The spot itself is recorded too, for the weakest-spots report.
    expect(loadSpotAccuracy()['sixMax|btn|foldedToYou|-|100']).toMatchObject({ attempts: 1 });
  });

  it('re-drills the ranges the run missed, each over its own misses', async () => {
    // Every hand is in range, so folding whatever is dealt is always a miss.
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: generateHandMatrix().flat(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    const missed = getByTestId('drill-hand').props.children;
    fireEvent.press(getByTestId('answer-no'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    fireEvent.press(await findByTestId('summary-drill-misses'));

    // Back in a recognition drill on the range that missed, dealing only that hand.
    await waitFor(() => expect(queryByTestId('summary-done')).toBeNull());
    expect(getByTestId('drill-hand')).toHaveTextContent(missed);
  });

  it('offers no re-drill when the run missed nothing', async () => {
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: generateHandMatrix().flat(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    const { getByTestId, findByTestId, queryByTestId } = await render(<PracticeScreen />);

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    await findByTestId('summary-done');
    expect(queryByTestId('summary-drill-misses')).toBeNull();
  });

  it('falls back to 100bb when a deep link has a non-finite stack', async () => {
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: generateHandMatrix().flat(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    mockParams.mockReturnValue({ mode: 'spots', table: 'sixMax', stack: 'Infinity' });

    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('spot-scenario')).toHaveTextContent(/^6-max, 100bb\./);
  });

  it('explains an uncovered format instead of dealing', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'No scenario',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('spot-drill-empty')).toBeTruthy();
  });
});
