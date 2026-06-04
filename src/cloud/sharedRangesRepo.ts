import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedRange } from '../types/range'
import { CloudNotConfiguredError, getCurrentSession } from './auth'
import { NotSignedInError } from './rangesRepo'
import { getSupabaseClient } from './supabaseClient'

/**
 * Cloud repository for v3.2 shared range pages.
 *
 * A signed-in user can publish a range under an unguessable id (public, or
 * private guarded by a secret token). Any visitor can then fetch it read-only
 * via the `get_shared_range` SECURITY DEFINER RPC, which enforces the
 * public-or-correct-token check server-side. Deps are injectable so tests use a
 * fake Supabase client and user id with no network.
 */

const SHARED_RANGES_TABLE = 'shared_ranges'
const GET_SHARED_RANGE_FN = 'get_shared_range'

export interface SharedRangePublish {
  /** The unguessable share id (also the secret for private links). */
  id: string
  /** Whether the row is readable by id alone (public) or needs the token. */
  isPublic: boolean
  /** Secret token for private links; null for public rows. */
  token: string | null
}

interface SharedRangesRepoDeps {
  client?: SupabaseClient | null
  /** Resolve the current user id; defaults to the active session's user. */
  resolveUserId?: () => Promise<string | null>
  /** Generate the share id / token; injectable for deterministic tests. */
  generateId?: () => string
}

async function defaultResolveUserId(): Promise<string | null> {
  const session = await getCurrentSession()
  return session?.user.id ?? null
}

function defaultGenerateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

async function requireContext(deps: SharedRangesRepoDeps): Promise<{
  client: SupabaseClient
  userId: string
}> {
  const client = deps.client ?? (await getSupabaseClient())
  if (!client) throw new CloudNotConfiguredError()
  const userId = await (deps.resolveUserId ?? defaultResolveUserId)()
  if (!userId) throw new NotSignedInError()
  return { client, userId }
}

/**
 * Publish a range as a shared page. Returns the generated id and (for private
 * shares) the secret token needed to view it. Requires a signed-in user.
 */
export async function publishSharedRange(
  range: SavedRange,
  isPublic: boolean,
  deps: SharedRangesRepoDeps = {},
): Promise<SharedRangePublish> {
  const { client, userId } = await requireContext(deps)
  const generate = deps.generateId ?? defaultGenerateId
  const id = generate()
  const token = isPublic ? null : generate()
  const { error } = await client.from(SHARED_RANGES_TABLE).insert({
    id,
    owner_id: userId,
    data: range,
    is_public: isPublic,
    token,
  })
  if (error) throw error
  return { id, isPublic, token }
}

/**
 * Fetch a shared range by id (with an optional token for private shares).
 * Returns null when nothing matches (unknown id, or wrong/missing token).
 * Does NOT require sign-in — visitors can read shared pages.
 */
export async function getSharedRange(
  id: string,
  token?: string,
  deps: SharedRangesRepoDeps = {},
): Promise<SavedRange | null> {
  const client = deps.client ?? (await getSupabaseClient())
  if (!client) throw new CloudNotConfiguredError()
  const { data, error } = await client.rpc(GET_SHARED_RANGE_FN, {
    p_id: id,
    p_token: token ?? null,
  })
  if (error) throw error
  return (data as SavedRange | null) ?? null
}

/** Unpublish (delete) a shared range the signed-in user owns. */
export async function unpublishSharedRange(
  id: string,
  deps: SharedRangesRepoDeps = {},
): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const { error } = await client
    .from(SHARED_RANGES_TABLE)
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)
  if (error) throw error
}
