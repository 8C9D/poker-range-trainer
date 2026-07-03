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
  it('offers the recognition, build, timed, and action-quiz modes', async () => {
    const { getByTestId, getByText } = await render(<PracticeModesScreen />);

    expect(getByTestId('mode-recognition')).toBeTruthy();
    expect(getByTestId('mode-build')).toBeTruthy();
    expect(getByTestId('mode-timed')).toBeTruthy();
    expect(getByTestId('mode-action-quiz')).toBeTruthy();
    expect(getByText('Recognition')).toBeTruthy();
    expect(getByText('Build from memory')).toBeTruthy();
    expect(getByText('Timed drill')).toBeTruthy();
    expect(getByText('Action quiz')).toBeTruthy();
  });
});
