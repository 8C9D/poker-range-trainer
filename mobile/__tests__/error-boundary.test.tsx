import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { reportCaughtError } from '../platform/crashReporting';

// The boundary must hand every caught error to the crash-reporting seam; the
// seam's own DSN gating is covered in crash-reporting.test.ts.
jest.mock('../platform/crashReporting', () => ({ reportCaughtError: jest.fn() }));

// A child that throws on render, used to drive the boundary into its fallback.
function Boom({ message = 'Kaboom' }: { message?: string }): never {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // React (and our componentDidCatch) log caught render errors to console.error;
    // silence the expected noise so the test output stays clean.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders its children when nothing throws', async () => {
    await render(
      <ErrorBoundary>
        <Text>All good</Text>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders the fallback (message + Try again) when a child throws', async () => {
    await render(
      <ErrorBoundary>
        <Boom message="Kaboom" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Kaboom');
    expect(screen.getByTestId('error-retry')).toBeTruthy();
    // The throwing child must not have leaked into the rendered tree.
    expect(screen.queryByText('All good')).toBeNull();
  });

  it('reports the caught error to crash reporting', async () => {
    await render(
      <ErrorBoundary>
        <Boom message="Reported" />
      </ErrorBoundary>,
    );

    expect(reportCaughtError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Reported' }),
    );
  });

  it('recovers when Try again is pressed and the child no longer throws', async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) {
        throw new Error('Transient');
      }
      return <Text>Recovered</Text>;
    }

    await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(screen.getByTestId('error-retry'));

    // The reset re-render is concurrent under React 19; wait for it to flush.
    expect(await screen.findByText('Recovered')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
