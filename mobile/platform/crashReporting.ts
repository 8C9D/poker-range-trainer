/**
 * Crash-reporting seam, mirroring the archived cloud env seam
 * (archived/cloud-sync/mobile/platform/cloudEnv.ts): everything is gated on a
 * single Expo public var. With `EXPO_PUBLIC_SENTRY_DSN` unset the app behaves
 * exactly as it did before Sentry existed — no init, no network, no console
 * output — and every helper here is an inert no-op / identity.
 *
 * What ships when the DSN is set is deliberately minimal: crash and
 * performance diagnostics only. Session replay, screenshots and view
 * hierarchies are NOT collected — a poker study tool has no business shipping
 * screen contents to a third party, and each extra data class would cost
 * another App Privacy declaration. The privacy manifest, the App Privacy
 * answers and docs/privacy-policy.md all describe this exact configuration;
 * widening it means updating all three.
 */
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/** The Sentry DSN, or `null` when crash reporting is disabled. */
export function getSentryDsn(): string | null {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof dsn !== 'string') return null;
  const trimmed = dsn.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when the DSN is set and crash reporting is live. */
export function isCrashReportingEnabled(): boolean {
  return getSentryDsn() !== null;
}

// Route-change tracing: @sentry/react-native ~7.11.0 (the release Expo pins
// for SDK 56) predates `expoRouterIntegration`; its documented expo-router
// setup is `reactNavigationIntegration` registered with the router's
// navigation container ref from the root layout. Created lazily so a
// DSN-unset run never constructs it.
let navigationIntegration: ReturnType<typeof Sentry.reactNavigationIntegration> | null = null;

function getNavigationIntegration(): ReturnType<typeof Sentry.reactNavigationIntegration> {
  navigationIntegration ??= Sentry.reactNavigationIntegration();
  return navigationIntegration;
}

/** Initialise Sentry, or do nothing at all when the DSN is unset. */
export function initCrashReporting(): void {
  const dsn = getSentryDsn();
  if (!dsn) return;
  Sentry.init({
    dsn,
    integrations: [getNavigationIntegration()],
    // The free tier is 5k events/month; keep the trace volume conservative.
    tracesSampleRate: 0.1,
    // Never ship screen contents: no screenshots, no view hierarchies, and no
    // session replay (its sample rates pinned to 0 so an SDK default can
    // never turn it on).
    attachScreenshot: false,
    attachViewHierarchy: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

/** Register expo-router's navigation container for route-change tracing. */
export function registerNavigationContainer(navigationContainerRef: unknown): void {
  if (!isCrashReportingEnabled()) return;
  getNavigationIntegration().registerNavigationContainer(navigationContainerRef);
}

/** The root component wrapped for Sentry's touch tracking, or unchanged when disabled. */
export function wrapRootComponent<P extends Record<string, unknown>>(
  root: ComponentType<P>,
): ComponentType<P> {
  return isCrashReportingEnabled() ? Sentry.wrap(root) : root;
}

/**
 * Report an error the app caught and recovered from (the ErrorBoundary's
 * fallback path): a caught render error never reaches the global handler, so
 * without this it would be invisible in production.
 */
export function reportCaughtError(error: unknown): void {
  if (!isCrashReportingEnabled()) return;
  Sentry.captureException(error);
}
