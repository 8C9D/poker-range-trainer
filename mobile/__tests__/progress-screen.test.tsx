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
    expect(getByText('10')).toBeTruthy();
    // Weak hand AA is listed with a Drill-these shortcut.
    expect(getByText('AA')).toBeTruthy();
    expect(getByTestId('drill-weak-hands')).toBeTruthy();
  });

  it('leaves deleted ranges out of library analytics', async () => {
    seed('live', 'UTG Open');
    recordPracticeSession('live', { totalQuestions: 10, correctAnswers: 8 });
    recordPracticeSession('deleted', { totalQuestions: 20, correctAnswers: 20 });

    const { getByText, queryByText } = await render(<ProgressScreen />);

    expect(getByText('10')).toBeTruthy();
    expect(queryByText('30')).toBeNull();
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
    expect(card).toHaveTextContent('Where you leakBy seatBB30%BTN90%By actionDefend30%Open90%');
    expect(getByTestId('seat-row-bb')).toHaveTextContent('BB30%');
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
