import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { saveSavedRange } from '@core/storage/rangeStorage';
import { saveReviewState } from '@core/storage/reviewStateStorage';

import WorkoutScreen from '../app/workout';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-haptics');
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

describe('WorkoutScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('composes the plan from storage and opens on the first hand-off', async () => {
    saveSavedRange({
      id: 'btn',
      name: 'BTN open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      metadata: { position: 'btn', actionType: 'open' },
    });

    const { getByTestId } = await render(<WorkoutScreen />);

    expect(getByTestId('workout-handoff')).toBeTruthy();
    expect(getByTestId('workout-reason')).toHaveTextContent('1 range due for review.');
  });

  it('explains itself when there is nothing to plan', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'Unlabelled',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    saveReviewState({
      rangeId: 'r1',
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2999-01-01T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByTestId } = await render(<WorkoutScreen />);

    expect(getByTestId('workout-empty')).toHaveTextContent('Nothing to train right now.');
  });
});
