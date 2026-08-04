import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { recordSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import ProgressScreen from '../app/(tabs)/progress';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  // Every Link here is `asChild`, so it renders its one child. The href is copied
  // onto that child so tests can assert where a shortcut actually goes, not just
  // that it rendered.
  Link: ({ href, children }: { href: unknown; children: ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').cloneElement(children, { href }),
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

describe('ProgressScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('shows the overview tiles and empty weak-hands state', async () => {
    const { getByText } = await render(<ProgressScreen />);

    expect(getByText('Progress')).toBeTruthy();
    expect(getByText('30-day accuracy')).toBeTruthy();
    expect(getByText(/No recorded misses yet/)).toBeTruthy();
  });

  it('surfaces all-time hands and a Drill-these action for weak hands', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 6 });
    recordPracticeSessionHistory('r1', { totalQuestions: 10, correctAnswers: 6 }, new Date().toISOString());
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 5, correct: 1, falsePositives: 0, falseNegatives: 4 },
    ]);

    const { getByText, getByTestId } = await render(<ProgressScreen />);

    // All-time hands tile reflects the recorded attempts.
    expect(getByTestId('hands-all-time')).toHaveTextContent('10');
    // …and so does today's bar on the weekly chart.
    expect(getByTestId('chart-value-6')).toHaveTextContent('10');
    // Days with nothing recorded stay unlabelled rather than showing a row of zeros.
    expect(getByTestId('chart-value-0')).toHaveTextContent('');
    // Weak hand AA is listed with a Drill-these shortcut.
    expect(getByText('AA')).toBeTruthy();
    expect(getByTestId('drill-weak-hands')).toBeTruthy();
  });

  it('keeps a live leak in the table when orphaned records outrank it', async () => {
    seed('r1', 'UTG Open');
    // Ten weaker records for a range that is gone — enough to fill the report's
    // cap on their own. Scoped after ranking, they would take every slot and the
    // live leak below would vanish behind the "no recorded misses" empty state.
    recordHandAccuracy(
      'deleted',
      ['22', '32s', '42s', '52s', '62s', '72s', '82s', '92s', 'T2s', 'J2s'].map((hand) => ({
        hand,
        attempts: 6,
        correct: 0,
        falsePositives: 0,
        falseNegatives: 6,
      })),
    );
    recordHandAccuracy('r1', [
      { hand: 'AA', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
    ]);

    const { getByText, queryByText } = await render(<ProgressScreen />);

    expect(queryByText(/No recorded misses yet/)).toBeNull();
    expect(getByText('AA')).toBeTruthy();
    expect(queryByText('32s')).toBeNull();
  });

  it('charts accuracy by week once there is practice to chart', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 10, correctAnswers: 7 },
      new Date().toISOString(),
    );

    const { getByTestId, getByText } = await render(<ProgressScreen />);

    expect(getByText('Accuracy by week')).toBeTruthy();
    expect(getByTestId('trend-value-7')).toHaveTextContent('70%');
    // A week with no practice keeps its slot but carries no percentage.
    expect(getByTestId('trend-value-0')).toHaveTextContent('');
  });

  it('counts a single hand in the singular on both charts', async () => {
    seed('r1', 'UTG Open');
    recordPracticeSessionHistory(
      'r1',
      { totalQuestions: 1, correctAnswers: 0 },
      new Date().toISOString(),
    );

    const { getByLabelText } = await render(<ProgressScreen />);

    // The columns carry no text of their own, so these labels are the whole
    // chart to VoiceOver — "1 hands" is the only wording it gets.
    expect(getByLabelText(/: 1 hand$/)).toBeTruthy();
    expect(getByLabelText(/over 1 hand$/)).toBeTruthy();
  });

  it('explains the library summary instead of reporting a row of zeros', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId, queryByText } = await render(<ProgressScreen />);

    expect(getByTestId('analytics-empty')).toBeTruthy();
    expect(queryByText(/0 ranges practiced/)).toBeNull();
  });

  it('explains the weekly chart instead of drawing an empty one', async () => {
    seed('r1', 'UTG Open');

    const { getByTestId, queryByTestId } = await render(<ProgressScreen />);

    // Seven zero-height bars are decoration; every sibling card explains itself
    // when it has nothing to show, and this one now does too.
    expect(getByTestId('week-empty')).toBeTruthy();
    expect(queryByTestId('chart-value-6')).toBeNull();
  });

  it('explains the accuracy trend before there is any practice', async () => {
    const { getByText, queryByTestId } = await render(<ProgressScreen />);

    expect(getByText(/your accuracy trend will show up here/)).toBeTruthy();
    expect(queryByTestId('trend-value-7')).toBeNull();
  });

  it('leaves deleted ranges out of library analytics', async () => {
    seed('live', 'UTG Open');
    recordPracticeSession('live', { totalQuestions: 10, correctAnswers: 8 });
    recordPracticeSession('deleted', { totalQuestions: 20, correctAnswers: 20 });

    const { getByText, queryByText } = await render(<ProgressScreen />);

    expect(getByText('10')).toBeTruthy();
    expect(queryByText('30')).toBeNull();
  });

  it('leaves a deleted range out of the volume and accuracy figures too', async () => {
    // The all-time tile was already scoped to the live library while the charts
    // were not, so one screen could report 40 hands this week next to 0 all-time.
    seed('live', 'UTG Open');
    recordPracticeSession('live', { totalQuestions: 10, correctAnswers: 8 });
    recordPracticeSessionHistory('live', { totalQuestions: 10, correctAnswers: 8 });
    recordPracticeSessionHistory('deleted', { totalQuestions: 30, correctAnswers: 3 });

    const { queryByText, getByTestId } = await render(<ProgressScreen />);

    expect(getByTestId('hands-all-time')).toHaveTextContent('10');
    expect(getByTestId('chart-value-6')).toHaveTextContent('10');
    expect(getByTestId('trend-value-7')).toHaveTextContent('80%');
    // Counting both would read 11 of 40 — a 30-day accuracy of 28%.
    expect(queryByText('28%')).toBeNull();
  });

  it('groups misses into hand-type leaks, each drillable', async () => {
    seed('r1', 'UTG Open');
    recordHandAccuracy('r1', [
      { hand: '98s', attempts: 4, correct: 1, falsePositives: 0, falseNegatives: 3 },
      { hand: '76s', attempts: 2, correct: 0, falsePositives: 0, falseNegatives: 2 },
    ]);

    const { getByTestId, getByText } = await render(<ProgressScreen />);

    expect(getByText('Suited connectors')).toBeTruthy();
    expect(getByTestId('leak-suitedConnector')).toHaveTextContent(/1\/6 · 17% · 98s, 76s/);
    expect(getByTestId('drill-suitedConnector')).toBeTruthy();
  });

  it('shows the leak empty state before there is enough data', async () => {
    seed('r1', 'UTG Open');

    const { getByText } = await render(<ProgressScreen />);

    expect(getByText(/hand types you miss most/)).toBeTruthy();
  });

  it('marks its section titles as headings so the VoiceOver rotor can jump', async () => {
    seed('a', 'UTG Open');
    recordPracticeSession('a', { totalQuestions: 10, correctAnswers: 8 }, new Date().toISOString());

    const { getAllByRole } = await render(<ProgressScreen />);

    // Without headers a VoiceOver user has to swipe through every stat on the
    // screen to reach the next section.
    const headings = getAllByRole('header').map((node) => node.props.children);
    expect(headings).toContain('Progress');
    expect(headings).toContain('Hands answered this week');
  });
});

describe('ProgressScreen leak breakdown', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  function seedWithMetadata(id: string, metadata: SavedRange['metadata']): void {
    saveSavedRange({
      id,
      name: id,
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata,
    });
  }

  it('explains the empty state when no range records a seat or action', async () => {
    seed('r1', 'Unlabelled');
    recordPracticeSession('r1', { totalQuestions: 10, correctAnswers: 5 });
    const { getByText } = await render(<ProgressScreen />);

    expect(getByText(/which seats/)).toBeTruthy();
  });

  it('ranks the weakest seat and action first', async () => {
    seedWithMetadata('btn', { position: 'btn', actionType: 'open' });
    seedWithMetadata('bb', { position: 'bb', actionType: 'defend' });
    recordPracticeSession('btn', { totalQuestions: 10, correctAnswers: 9 });
    recordPracticeSession('bb', { totalQuestions: 10, correctAnswers: 3 });
    const { getByTestId } = await render(<ProgressScreen />);

    const card = getByTestId('seat-leaks');
    expect(card).toHaveTextContent(
      'Where you leakBy seatBB30%DrillBTN90%DrillBy actionDefend30%DrillOpen90%Drill',
    );
    expect(getByTestId('seat-row-bb')).toHaveTextContent('BB30%Drill');
  });

  it('drills the charts behind a weak seat, each in full', async () => {
    seedWithMetadata('bbVsBtn', { position: 'bb', actionType: 'defend' });
    seedWithMetadata('bbVsCo', { position: 'bb', actionType: 'defend' });
    seedWithMetadata('btn', { position: 'btn', actionType: 'open' });
    recordPracticeSession('bbVsBtn', { totalQuestions: 10, correctAnswers: 3 });
    recordPracticeSession('bbVsCo', { totalQuestions: 10, correctAnswers: 4 });
    recordPracticeSession('btn', { totalQuestions: 10, correctAnswers: 9 });
    const { getByTestId } = await render(<ProgressScreen />);

    // No `pools` param: the situation is what is weak, so each chart is whole.
    expect(getByTestId('drill-seat-bb').props.href).toEqual({
      pathname: '/practice',
      params: { queue: 'bbVsBtn,bbVsCo', mode: 'recognize' },
    });
    expect(getByTestId('drill-seat-open').props.href).toEqual({
      pathname: '/practice',
      params: { queue: 'btn', mode: 'recognize' },
    });
  });
});

describe('ProgressScreen weakest spots', () => {
  const BB_VS_CO = 'sixMax|bb|facingOpen|co|100';

  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('is hidden until a spot has enough recorded answers', async () => {
    recordSpotAccuracy([{ spotKey: BB_VS_CO, attempts: 4, correct: 1 }]);
    const { queryByTestId } = await render(<ProgressScreen />);

    expect(queryByTestId('spot-leaks')).toBeNull();
  });

  it('describes the weakest spots, worst first, each drillable', async () => {
    saveSavedRange({
      id: 'bb',
      name: 'BB defend',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'bb', actionType: 'defend', versusPosition: 'co' },
    });
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });
    recordSpotAccuracy([
      { spotKey: BB_VS_CO, attempts: 10, correct: 3 },
      { spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 10, correct: 9 },
    ]);
    const { getByTestId } = await render(<ProgressScreen />);

    expect(getByTestId('spot-leaks')).toHaveTextContent(
      /Weakest spots6-max, 100bb\. You are in the BB facing an open from the CO\.3\/10 · 30%/,
    );
    expect(getByTestId(`drill-spot-${BB_VS_CO}`)).toBeTruthy();
  });

  it('hides a recorded spot after its covering range is deleted', async () => {
    recordSpotAccuracy([{ spotKey: BB_VS_CO, attempts: 10, correct: 2 }]);
    const { queryByTestId } = await render(<ProgressScreen />);

    expect(queryByTestId('spot-leaks')).toBeNull();
  });
});
