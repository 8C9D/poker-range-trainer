import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedRange } from '../types/range'
import { CloudNotConfiguredError, getCurrentSession } from './auth'
import { getSupabaseClient } from './supabaseClient'

/**
 * Cloud repository for saved ranges (v3 explicit push/pull sync).
 *
 * `pushRanges` upserts the local library to the signed-in user's rows;
 * `pullRanges` reads them back. No automatic/background sync and no merge logic
 * here — the caller decides when to push or pull. Deps are injectable so tests
 * use a fake Supabase client and user id with no network.
 */

/** Thrown when a cloud op is attempted while signed out. */
export class NotSignedInError extends Error {
  constructor() {
    super('You must be signed in to sync.')
    this.name = 'NotSignedInError'
  }
}

const RANGES_TABLE = 'ranges'

interface RangesRepoDeps {
  client?: SupabaseClient | null
  /** Resolve the current user id; defaults to the active session's user. */
  resolveUserId?: () => Promise<string | null>
}

async function defaultResolveUserId(): Promise<string | null> {
  const session = await getCurrentSession()
  return session?.user.id ?? null
}

async function requireContext(deps: RangesRepoDeps): Promise<{
  client: SupabaseClient
  userId: string
}> {
  const client = deps.client ?? getSupabaseClient()
  if (!client) throw new CloudNotConfiguredError()
  const userId = await (deps.resolveUserId ?? defaultResolveUserId)()
  if (!userId) throw new NotSignedInError()
  return { client, userId }
}

/** Upsert every local range as a row for the current user. */
export async function pushRanges(
  ranges: SavedRange[],
  deps: RangesRepoDeps = {},
): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const rows = ranges.map((range) => ({
    id: range.id,
    user_id: userId,
    data: range,
    updated_at: range.updatedAt,
  }))
  const { error } = await client.from(RANGES_TABLE).upsert(rows)
  if (error) throw error
}

/** Read back the current user's ranges from the cloud. */
export async function pullRanges(deps: RangesRepoDeps = {}): Promise<SavedRange[]> {
  const { client, userId } = await requireContext(deps)
  const { data, error } = await client
    .from(RANGES_TABLE)
    .select('data')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => (row as { data: SavedRange }).data)
}
