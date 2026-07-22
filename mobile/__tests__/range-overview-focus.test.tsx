import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';

import RangeScreen from '../app/range/[id]';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Unlike the main range-screen test (which stubs useFocusEffect as a no-op), this
// mock runs the focus callback on mount and keeps the latest one so a test can
// simulate the screen regaining focus after the user returns from practice.
let focusCallback: (() => void) | null = null;

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useLocalSearchParams: () => ({ id: 'r1' }),
    useFocusEffect: (cb: () => void) => {
      focusCallback = cb;
      React.useEffect(() => cb(), [cb]);
    },
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    Link: ({ children }: { children: ReactNode }) => children,
    Stack: { Screen: () => null },
  };
});

describe('RangeScreen overview focus refresh', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    focusCallback = null;
  });

  it('shows a session recorded while the screen stayed mounted after re-focus', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByText, queryByText } = await render(<RangeScreen />);
    // No sessions yet, so the overview has no "Recent sessions" section.
    expect(queryByText('Recent sessions')).toBeNull();

    // A practice session is recorded while the overview tab stays mounted.
    recordPracticeSessionHistory('r1', { totalQuestions: 10, correctAnswers: 8 }, '2026-06-01T00:00:00.000Z');

    // Returning to the screen re-focuses it; the overview must pick up the session.
    await act(async () => {
      focusCallback?.();
    });

    expect(getByText('Recent sessions')).toBeTruthy();
    expect(getByText(/8\/10 ·/)).toBeTruthy();
  });
});
