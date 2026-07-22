import type { SupabaseClient } from '@supabase/supabase-js'
import type { RangePack } from '../domain/rangeTransfer'
import { CloudNotConfiguredError, getCurrentSession } from './auth'
import { NotSignedInError } from './rangesRepo'
import { getSupabaseClient } from './supabaseClient'

/**
 * Cloud repository for v5.1 shared range PACKS (the bundle counterpart of
 * `sharedRangesRepo`).
 *
 * A signed-in user can publish a `RangePack` under an unguessable id (public, or
 * private guarded by a secret token). Any visitor can then fetch it read-only
 * via the `get_shared_pack` SECURITY DEFINER RPC, which enforces the
 * public-or-correct-token check server-side. Deps are injectable so tests use a
 * fake Supabase client and user id with no network.
 */

const SHARED_PACKS_TABLE = 'shared_packs'
const GET_SHARED_PACK_FN = 'get_shared_pack'

export interface SharedPackPublish {
  /** The unguessable share id (also part of the secret for private links). */
  id: string
  /** Whether the row is readable by id alone (public) or needs the token. */
  isPublic: boolean
  /** Secret token for private links; null for public rows. */
  token: string | null
}

interface SharedPacksRepoDeps {
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

async function requireContext(deps: SharedPacksRepoDeps): Promise<{
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
 * Publish a range pack as a shared page. Returns the generated id and (for
 * private shares) the secret token needed to view it. Requires a signed-in user.
 */
export async function publishSharedPack(
  pack: RangePack,
  isPublic: boolean,
  deps: SharedPacksRepoDeps = {},
): Promise<SharedPackPublish> {
  const { client, userId } = await requireContext(deps)
  const generate = deps.generateId ?? defaultGenerateId
  const id = generate()
  const token = isPublic ? null : generate()
  const { error } = await client.from(SHARED_PACKS_TABLE).insert({
    id,
    owner_id: userId,
    data: pack,
    is_public: isPublic,
    token,
  })
  if (error) throw error
  return { id, isPublic, token }
}

/**
 * Fetch a shared pack by id (with an optional token for private shares).
 * Returns null when nothing matches (unknown id, or wrong/missing token).
 * Does NOT require sign-in — visitors can read shared pages.
 */
export async function getSharedPack(
  id: string,
  token?: string,
  deps: SharedPacksRepoDeps = {},
): Promise<RangePack | null> {
  const client = deps.client ?? (await getSupabaseClient())
  if (!client) throw new CloudNotConfiguredError()
  const { data, error } = await client.rpc(GET_SHARED_PACK_FN, {
    p_id: id,
    p_token: token ?? null,
  })
  if (error) throw error
  return (data as RangePack | null) ?? null
}

/** Unpublish (delete) a shared pack the signed-in user owns. */
export async function unpublishSharedPack(
  id: string,
  deps: SharedPacksRepoDeps = {},
): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const { error } = await client
    .from(SHARED_PACKS_TABLE)
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)
  if (error) throw error
}

/**
 * Unpublish (delete) EVERY shared pack the signed-in user owns. Used by the
 * "delete cloud data" flow so previously-published pack links are revoked even
 * after a page reload, when no single publish id is held in memory.
 */
export async function unpublishAllSharedPacks(deps: SharedPacksRepoDeps = {}): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const { error } = await client.from(SHARED_PACKS_TABLE).delete().eq('owner_id', userId)
  if (error) throw error
}
