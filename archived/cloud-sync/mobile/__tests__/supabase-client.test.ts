import { getMobileSupabaseClient, resetSupabaseClient } from '../platform/supabaseClient';

describe('mobile Supabase client factory', () => {
  const origUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const origKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  beforeEach(() => {
    resetSupabaseClient();
  });

  afterEach(() => {
    resetSupabaseClient();
    restore('EXPO_PUBLIC_SUPABASE_URL', origUrl);
    restore('EXPO_PUBLIC_SUPABASE_ANON_KEY', origKey);
  });

  it('resolves to null when cloud is unconfigured (local-first)', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    await expect(getMobileSupabaseClient()).resolves.toBeNull();
  });

  it('creates the client from an injected config + create (no real network)', async () => {
    const sentinel = { fake: 'client' };
    const create = jest.fn(() => sentinel);

    const client = await getMobileSupabaseClient({
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      create,
    } as never);

    expect(client).toBe(sentinel);
    expect(create).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key');
  });
});
