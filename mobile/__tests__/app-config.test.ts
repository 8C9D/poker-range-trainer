import { readFileSync } from 'fs';
import { join } from 'path';

interface PrivacyAccessedAPIType {
  NSPrivacyAccessedAPIType: string;
  NSPrivacyAccessedAPITypeReasons: string[];
}

interface PrivacyCollectedDataType {
  NSPrivacyCollectedDataType: string;
  NSPrivacyCollectedDataTypeLinked: boolean;
  NSPrivacyCollectedDataTypeTracking: boolean;
  NSPrivacyCollectedDataTypePurposes: string[];
}

interface AppConfig {
  expo: {
    ios: {
      bundleIdentifier?: string;
      buildNumber?: string;
      supportsTablet?: boolean;
      infoPlist?: {
        ITSAppUsesNonExemptEncryption?: boolean;
      };
      privacyManifests?: {
        NSPrivacyTracking: boolean;
        NSPrivacyTrackingDomains: string[];
        NSPrivacyCollectedDataTypes: PrivacyCollectedDataType[];
        NSPrivacyAccessedAPITypes: PrivacyAccessedAPIType[];
      };
    };
  };
}

// Read the static Expo config the way prebuild/EAS will, and assert the iOS privacy
// manifest (required for App Store submission) is present and well-formed. This is a
// config guard, not a runtime test — there is no logic to exercise.
const config = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as AppConfig;

describe('app.json iOS privacy manifest', () => {
  const ios = config.expo.ios;

  /**
   * The one value in this file that can never be corrected. Apple binds the
   * bundle identifier to the App Store record at first submission; it cannot be
   * changed afterwards, and it cannot be reused by another record even after the
   * app is removed. Nothing else fails when it changes — the build still
   * succeeds, and the mismatch only surfaces at upload, against a record that
   * will not take it. `buildNumber` is pinned here for a far smaller reason, so
   * this belongs here too.
   */
  it('pins the permanent iOS bundle identifier', () => {
    expect(ios.bundleIdentifier).toBe('com.arthurzhang.pokerrangetrainer');
  });

  it('sets an iOS build number to pair with the version', () => {
    // The exact value is owned by EAS: the production profile's autoIncrement
    // bumps it in app.json on every build, so only the shape is pinned here.
    expect(ios.buildNumber).toMatch(/^\d+$/);
  });

  it('ships iPhone-only: tablet support stays off until an iPad layout has been exercised', () => {
    // 1.0 launches without iPad (decision of 2026-08-18, LAUNCH-CHECKLIST.md):
    // the layout has never run on a tablet, and offering it there sight-unseen
    // ships an untested surface. Flipping this back on is a product decision
    // that also changes which screenshots Apple requires.
    expect(ios.supportsTablet).toBe(false);
  });

  it('declares exempt encryption so uploads skip the compliance dialog', () => {
    // The app implements no encryption of its own; it only uses the OS's TLS.
    // This answer was given once in App Store Connect for build 3 and is pinned
    // here so every later build carries it in the binary instead of re-raising
    // the export-compliance question at upload.
    expect(ios.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('declares tracking disabled with no tracking domains', () => {
    const manifest = ios.privacyManifests;
    expect(manifest).toBeDefined();
    expect(manifest?.NSPrivacyTracking).toBe(false);
    expect(manifest?.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('declares exactly the diagnostics Sentry collects: crash + performance, unlinked, untracked', () => {
    // The App Privacy answers and docs/privacy-policy.md describe an app that
    // collects crash and performance diagnostics only, never linked to identity
    // and never for tracking. This holds the manifest to that story; widening
    // the collection means updating both documents alongside this list.
    const collected = ios.privacyManifests?.NSPrivacyCollectedDataTypes ?? [];
    expect(collected.map((entry) => entry.NSPrivacyCollectedDataType).sort()).toEqual([
      'NSPrivacyCollectedDataTypeCrashData',
      'NSPrivacyCollectedDataTypePerformanceData',
    ]);
    for (const entry of collected) {
      expect(entry.NSPrivacyCollectedDataTypeLinked).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual([
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ]);
    }
  });

  it('declares the required-reason APIs the native deps use, each with a reason', () => {
    const types = ios.privacyManifests?.NSPrivacyAccessedAPITypes ?? [];
    expect(types.length).toBeGreaterThan(0);

    // Apple rejects a required-reason API declaration with no reason code.
    for (const entry of types) {
      expect(entry.NSPrivacyAccessedAPITypeReasons.length).toBeGreaterThan(0);
    }

    const categories = types.map((entry) => entry.NSPrivacyAccessedAPIType);
    // File timestamp: react-native-mmkv. UserDefaults: RN/Expo core.
    expect(categories).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
    expect(categories).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
  });
});
