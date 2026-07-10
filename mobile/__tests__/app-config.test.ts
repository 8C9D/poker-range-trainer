import { readFileSync } from 'fs';
import { join } from 'path';

interface PrivacyAccessedAPIType {
  NSPrivacyAccessedAPIType: string;
  NSPrivacyAccessedAPITypeReasons: string[];
}

interface AppConfig {
  expo: {
    ios: {
      buildNumber?: string;
      privacyManifests?: {
        NSPrivacyTracking: boolean;
        NSPrivacyTrackingDomains: string[];
        NSPrivacyCollectedDataTypes: unknown[];
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

  it('sets an iOS build number to pair with the version', () => {
    expect(ios.buildNumber).toBe('1');
  });

  it('declares tracking disabled with no tracking domains', () => {
    const manifest = ios.privacyManifests;
    expect(manifest).toBeDefined();
    expect(manifest?.NSPrivacyTracking).toBe(false);
    expect(manifest?.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('declares the required-reason APIs the native deps use, each with a reason', () => {
    const types = ios.privacyManifests?.NSPrivacyAccessedAPITypes ?? [];
    expect(types.length).toBeGreaterThan(0);

    // Apple rejects a required-reason API declaration with no reason code.
    for (const entry of types) {
      expect(entry.NSPrivacyAccessedAPITypeReasons.length).toBeGreaterThan(0);
    }

    const categories = types.map((entry) => entry.NSPrivacyAccessedAPIType);
    // File timestamp: expo-file-system + react-native-mmkv. UserDefaults: RN/Expo core.
    expect(categories).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
    expect(categories).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
  });
});
