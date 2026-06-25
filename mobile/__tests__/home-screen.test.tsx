import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HomeScreen, { APP_TITLE } from '../app/index';

// The home screen links into the editor; stub expo-router's Link as a passthrough
// so it renders without a navigation context.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

// Smoke test so `test:run` is meaningful: the home screen renders its title.
// Note: @testing-library/react-native v14's `render` is async (React 19), so it
// must be awaited.
describe('HomeScreen', () => {
  it('renders the app title', async () => {
    const { getByText } = await render(<HomeScreen />);
    expect(getByText(APP_TITLE)).toBeTruthy();
  });
});
