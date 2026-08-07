import type { ComponentType } from 'react';

import * as Sentry from '@sentry/react-native';

import {
  getSentryDsn,
  initCrashReporting,
  isCrashReportingEnabled,
  registerNavigationContainer,
  reportCaughtError,
  wrapRootComponent,
} from '../platform/crashReporting';

/**
 * The crash-reporting seam's one contract, tested from both sides: with
 * `EXPO_PUBLIC_SENTRY_DSN` unset the app must behave EXACTLY as it did before
 * Sentry existed (no init, no wrapping, no reporting, no console output), and
 * with it set the init options must keep the privacy-sensitive capture off —
 * the privacy manifest and the App Privacy answers describe an app that ships
 * crash and performance diagnostics only, and these assertions are what keep
 * the binary matching those documents.
 */

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => ({ sentryWrapped: component })),
  captureException: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    name: 'ReactNavigation',
    registerNavigationContainer: jest.fn(),
  })),
}));

const mockInit = Sentry.init as jest.Mock;
const mockWrap = Sentry.wrap as jest.Mock;
const mockCapture = Sentry.captureException as jest.Mock;
const mockNavigationIntegration = Sentry.reactNavigationIntegration as jest.Mock;

const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

function restoreDsn(): void {
  if (originalDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
}

afterEach(() => {
  restoreDsn();
  jest.clearAllMocks();
});

describe('with the DSN unset', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('is disabled, and a blank DSN does not count as set', () => {
    expect(getSentryDsn()).toBeNull();
    expect(isCrashReportingEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_SENTRY_DSN = '   ';
    expect(getSentryDsn()).toBeNull();
    expect(isCrashReportingEnabled()).toBe(false);
  });

  it('does nothing at all: no init, no console output, no integration built', () => {
    const consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((level) =>
      jest.spyOn(console, level),
    );

    initCrashReporting();

    expect(mockInit).not.toHaveBeenCalled();
    expect(mockNavigationIntegration).not.toHaveBeenCalled();
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('leaves the root component completely unchanged', () => {
    const Root = (() => null) as ComponentType<Record<string, unknown>>;
    expect(wrapRootComponent(Root)).toBe(Root);
    expect(mockWrap).not.toHaveBeenCalled();
  });

  it('swallows caught-error reports and navigation registration', () => {
    reportCaughtError(new Error('caught'));
    registerNavigationContainer({ current: null });

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockNavigationIntegration).not.toHaveBeenCalled();
  });
});

describe('with the DSN set', () => {
  const DSN = 'https://key@o0.ingest.sentry.io/0';

  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
  });

  it('initialises with the DSN and route-change tracing', () => {
    initCrashReporting();

    expect(mockInit).toHaveBeenCalledTimes(1);
    const options = mockInit.mock.calls[0][0] as Record<string, unknown>;
    expect(options.dsn).toBe(DSN);
    expect(options.integrations).toEqual([expect.objectContaining({ name: 'ReactNavigation' })]);
  });

  it('keeps every screen-content capture off and the trace volume conservative', () => {
    initCrashReporting();

    const options = mockInit.mock.calls[0][0] as Record<string, unknown>;
    expect(options.attachScreenshot).toBe(false);
    expect(options.attachViewHierarchy).toBe(false);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    // Only the navigation integration: adding replay (or any other capture)
    // must be a deliberate decision that also updates the privacy documents.
    expect(options.integrations).toHaveLength(1);
    expect(options.tracesSampleRate as number).toBeLessThanOrEqual(0.1);
  });

  it('wraps the root, reports caught errors, and registers the router', () => {
    const Root = (() => null) as ComponentType<Record<string, unknown>>;
    expect(wrapRootComponent(Root)).toEqual({ sentryWrapped: Root });

    const error = new Error('caught');
    reportCaughtError(error);
    expect(mockCapture).toHaveBeenCalledWith(error);

    // The seam memoizes one integration instance; read it back off the init
    // options rather than the factory mock, which clearAllMocks has reset.
    initCrashReporting();
    const options = mockInit.mock.calls[0][0] as {
      integrations: [{ registerNavigationContainer: jest.Mock }];
    };
    const ref = { current: null };
    registerNavigationContainer(ref);
    expect(options.integrations[0].registerNavigationContainer).toHaveBeenCalledWith(ref);
  });
});
