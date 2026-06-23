import { render } from '@testing-library/react-native';

import HomeScreen, { APP_TITLE } from '../app/index';

// Trivial smoke test so `test:run` is meaningful: the scaffold's home screen
// renders its title. Reused-core tests arrive in later slices.
// Note: @testing-library/react-native v14's `render` is async (React 19), so it
// must be awaited.
describe('HomeScreen', () => {
  it('renders the app title', async () => {
    const { getByText } = await render(<HomeScreen />);
    expect(getByText(APP_TITLE)).toBeTruthy();
  });
});
