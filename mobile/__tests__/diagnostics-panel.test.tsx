import * as Sentry from '@sentry/react-native';
import { render, userEvent } from '@testing-library/react-native';

import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

/**
 * The DSN gate, tested from both sides: a DSN-unset build must show nothing at
 * all (the panel is a launch-verification hook, not a feature), and a DSN-set
 * build must send a real Error through the seam so the TestFlight pass can
 * confirm the pipeline in the Sentry dashboard (LAUNCH-CHECKLIST.md step 9.6).
 */

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

const mockCapture = Sentry.captureException as jest.Mock;

const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

afterEach(() => {
  if (originalDsn === undefined) {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  } else {
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
  }
  jest.clearAllMocks();
});

describe('DiagnosticsPanel', () => {
  it('renders nothing at all when the DSN is unset', async () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { toJSON } = await render(<DiagnosticsPanel />);
    expect(toJSON()).toBeNull();
  });

  it('sends a test error through Sentry and confirms on screen when the DSN is set', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/0';
    const screen = await render(<DiagnosticsPanel />);

    expect(screen.queryByTestId('diagnostics-status')).toBeNull();
    await userEvent.press(screen.getByTestId('send-test-crash-report'));

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const sent = mockCapture.mock.calls[0][0] as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toContain('Sentry pipeline test');
    expect(screen.getByTestId('diagnostics-status')).toBeTruthy();
  });
});
