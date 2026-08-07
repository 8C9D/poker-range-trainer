import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'

/**
 * Thin wrapper over Supabase managed auth. No UI here — just typed async
 * operations that fail gracefully when cloud is not configured.
 *
 * The client is injectable (defaults to {@link getSupabaseClient}) so tests can
 * pass a fake Supabase auth object with no network or live credentials.
 */

/** Thrown when an auth operation is attempted while cloud is not configured. */
export class CloudNotConfiguredError extends Error {
  constructor() {
    super('Cloud is not configured.')
    this.name = 'CloudNotConfiguredError'
  }
}

// Resolve the client to use: the explicitly injected one (tests), else the
// lazily-loaded singleton. `undefined` means "not injected" (so we resolve);
// `null` means "injected as unconfigured".
async function resolveClient(
  injected: SupabaseClient | null | undefined,
): Promise<SupabaseClient | null> {
  return injected !== undefined ? injected : await getSupabaseClient()
}

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new CloudNotConfiguredError()
  return client
}

/** Create a new account. Resolves to the new session (or null if email confirm is pending). */
export async function signUp(
  email: string,
  password: string,
  client?: SupabaseClient | null,
): Promise<Session | null> {
  const { data, error } = await requireClient(await resolveClient(client)).auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data.session
}

/** Sign in with email + password. Resolves to the session. */
export async function signIn(
  email: string,
  password: string,
  client?: SupabaseClient | null,
): Promise<Session> {
  const { data, error } = await requireClient(await resolveClient(client)).auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data.session
}

/** Sign out the current user. */
export async function signOut(client?: SupabaseClient | null): Promise<void> {
  const { error } = await requireClient(await resolveClient(client)).auth.signOut()
  if (error) throw error
}

/** The current session, or null when signed out or cloud is unconfigured. */
export async function getCurrentSession(
  client?: SupabaseClient | null,
): Promise<Session | null> {
  const resolved = await resolveClient(client)
  if (!resolved) return null
  const { data, error } = await resolved.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Subscribe to auth-state changes. Resolves to an unsubscribe function. When
 * cloud is unconfigured this is a no-op (resolves to a function that does nothing).
 */
export async function onAuthChange(
  callback: (session: Session | null) => void,
  client?: SupabaseClient | null,
): Promise<() => void> {
  const resolved = await resolveClient(client)
  if (!resolved) return () => {}
  const { data } = resolved.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
