import type { ComponentType } from 'react';

import * as Sentry from '@sentry/react-native';

import { setRestoreDamageReporter } from '@core/storage/backup';

import { setStorageLossReporter } from '../platform/storeIntegrity';

import {
  getSentryDsn,
  initCrashReporting,
  isCrashReportingEnabled,
  registerNavigationContainer,
  reportCaughtError,
  reportRestoreDamage,
  reportStorageLoss,
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

// The storage layer cannot import this module (it loads before Sentry), so the
// wiring runs the other way and is mocked here to be observable.
jest.mock('../platform/storeIntegrity', () => ({ setStorageLossReporter: jest.fn() }));

// Same for the restore-damage seam: `@core/storage/backup` is shared with the web
// app, so the wiring runs from here and is mocked to be observable. Only the
// setter is replaced; nothing else in that module is used by this file.
jest.mock('@core/storage/backup', () => ({ setRestoreDamageReporter: jest.fn() }));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => ({ sentryWrapped: component })),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    name: 'ReactNavigation',
    registerNavigationContainer: jest.fn(),
  })),
}));

const mockInit = Sentry.init as jest.Mock;
const mockWrap = Sentry.wrap as jest.Mock;
const mockCapture = Sentry.captureException as jest.Mock;
const mockCaptureMessage = Sentry.captureMessage as jest.Mock;
const mockSetStorageLossReporter = setStorageLossReporter as jest.Mock;
const mockSetRestoreDamageReporter = setRestoreDamageReporter as jest.Mock;
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

  it('swallows storage-loss reports too', () => {
    reportStorageLoss(['poker-range-trainer.saved-ranges.v1']);

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  /**
   * The storage layer reports through an injected function because it loads
   * before Sentry does, which leaves exactly one line joining the two. Unwired,
   * detection still works and the user is still told — and Sentry silently
   * hears nothing, forever, with every test above this one still passing.
   */
  it('wires the storage-loss reporter even with reporting disabled', () => {
    initCrashReporting();

    expect(mockSetStorageLossReporter).toHaveBeenCalledWith(reportStorageLoss);
  });

  it('swallows restore-damage reports too', () => {
    reportRestoreDamage(['poker-range-trainer.saved-ranges.v1']);

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  /**
   * Same one-line join as the storage-loss reporter, for the same class of
   * damage: `@core/storage/backup` is shared with the web app, so it cannot
   * import this module and reports through an injected function instead.
   * Unwired, the restore still fails safely and the user still sees the error,
   * while the fact that the library is now mixed goes nowhere.
   */
  it('wires the restore-damage reporter even with reporting disabled', () => {
    initCrashReporting();

    expect(mockSetRestoreDamageReporter).toHaveBeenCalledWith(reportRestoreDamage);
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

  /**
   * Storage loss raises no exception anywhere — MMKV drops the data natively and
   * every read afterwards succeeds — so this message is the only way it ever
   * reaches anyone but the user. It must carry the key names and nothing else:
   * the privacy manifest and docs/privacy-policy.md describe an app that sends
   * crash and performance diagnostics, never library contents.
   */
  it('reports missing storage keys as an error, carrying only the key names', () => {
    reportStorageLoss(['poker-range-trainer.saved-ranges.v1']);

    expect(mockCaptureMessage).toHaveBeenCalledWith('Storage keys missing after open: 1', {
      level: 'error',
      extra: { keys: ['poker-range-trainer.saved-ranges.v1'] },
    });
  });

  /**
   * A refused rollback raises nothing either: `restoreBackup` swallows it on
   * purpose so the error the user sees stays the reason the RESTORE failed. This
   * message is the only record that the library now holds one slice from a
   * different point in time, and it carries key names for the same reason.
   */
  it('reports slices a restore could not roll back, carrying only the key names', () => {
    reportRestoreDamage(['poker-range-trainer.saved-ranges.v1']);

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Backup restore left slices unrolled-back: 1',
      { level: 'error', extra: { keys: ['poker-range-trainer.saved-ranges.v1'] } },
    );
  });
});
