import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
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
});
