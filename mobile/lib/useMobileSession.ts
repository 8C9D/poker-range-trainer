import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getCurrentSession, onAuthChange } from '@core/cloud/auth';

import { getMobileSupabaseClient } from '../platform/supabaseClient';

export interface MobileSessionState {
  /** `undefined` while the client is resolving; `null` when cloud is unconfigured. */
  client: SupabaseClient | null | undefined;
  /** The current auth session, or `null` when signed out / unconfigured. */
  session: Session | null;
}

/**
 * Resolve the native Supabase client and track the current auth session, mirroring the
 * effect in AuthPanel so screens that gate cloud actions (e.g. publishing a shared link)
 * can reuse it. Local-first: with cloud unconfigured the client is null and the session
 * stays null, so gated actions simply never appear.
 */
export function useMobileSession(): MobileSessionState {
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      const resolved = await getMobileSupabaseClient();
      if (!active) return;
      setClient(resolved);
      if (!resolved) return;
      const current = await getCurrentSession(resolved);
      if (!active) return;
      setSession(current);
      unsubscribe = await onAuthChange((next) => {
        if (active) setSession(next);
      }, resolved);
      if (!active) unsubscribe();
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { client, session };
}
