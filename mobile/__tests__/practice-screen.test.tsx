import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
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
function seedAllHandsRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'Everything',
    hands: generateHandMatrix().flat(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('PracticeScreen (overlay host)', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    mockParams.mockReturnValue({ id: 'r1', mode: 'recognize' });
  });

  it('runs the recognition drill and scores an in-range answer as correct', async () => {
    seedAllHandsRange();
    const { getByTestId, findByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('playing-cards')).toBeTruthy();
    fireEvent.press(getByTestId('answer-yes'));

    expect(await findByTestId('drill-feedback')).toHaveTextContent(/^Correct —/);
  });

  it('opens the mode picker when no preset mode is given', async () => {
    seedAllHandsRange();
    mockParams.mockReturnValue({ id: 'r1' });

    const { getByTestId } = await render(<PracticeScreen />);

    expect(getByTestId('mode-recognize')).toBeTruthy();
    expect(getByTestId('mode-timed')).toBeTruthy();
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
