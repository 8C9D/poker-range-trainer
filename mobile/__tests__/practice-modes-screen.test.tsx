import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import PracticeModesScreen from '../app/practice-modes';

// expo-router stub: Link renders its children (so the inner Pressable/testID survive),
// useLocalSearchParams supplies the range id, Stack.Screen renders nothing.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

describe('PracticeModesScreen', () => {
  it('offers every practice mode including postflop, blocker, and frequency quiz', async () => {
    const { getByTestId, getByText } = await render(<PracticeModesScreen />);

    expect(getByTestId('mode-recognition')).toBeTruthy();
    expect(getByTestId('mode-build')).toBeTruthy();
    expect(getByTestId('mode-timed')).toBeTruthy();
    expect(getByTestId('mode-action-quiz')).toBeTruthy();
    expect(getByTestId('mode-postflop')).toBeTruthy();
    expect(getByTestId('mode-blocker-drill')).toBeTruthy();
    expect(getByTestId('mode-mixed-quiz')).toBeTruthy();
    expect(getByText('Recognition')).toBeTruthy();
    expect(getByText('Build from memory')).toBeTruthy();
    expect(getByText('Timed drill')).toBeTruthy();
    expect(getByText('Action quiz')).toBeTruthy();
    expect(getByText('Postflop spot')).toBeTruthy();
    expect(getByText('Blocker drill')).toBeTruthy();
    expect(getByText('Frequency quiz')).toBeTruthy();
  });
});
