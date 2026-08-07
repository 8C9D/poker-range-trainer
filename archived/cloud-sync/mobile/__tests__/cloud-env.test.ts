import { getMobileCloudConfig, isMobileCloudConfigured } from '../platform/cloudEnv';

describe('mobile cloud env seam', () => {
  const origUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const origKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    restore('EXPO_PUBLIC_SUPABASE_URL', origUrl);
    restore('EXPO_PUBLIC_SUPABASE_ANON_KEY', origKey);
  });

  it('is unconfigured (local-first) when the Supabase vars are absent', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    expect(isMobileCloudConfigured()).toBe(false);
    expect(getMobileCloudConfig()).toBeNull();
  });

  it('resolves the config when both Supabase vars are set', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    expect(isMobileCloudConfigured()).toBe(true);
    expect(getMobileCloudConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('stays unconfigured when only one var is set', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    expect(isMobileCloudConfigured()).toBe(false);
  });
});
