import type { SupabaseClient } from '@supabase/supabase-js'
import type { Backup } from '../storage/backup'
import { CloudNotConfiguredError, getCurrentSession } from './auth'
import { NotSignedInError } from './rangesRepo'
import { getSupabaseClient } from './supabaseClient'

/**
 * Cloud repository for the full library backup (v3 explicit push/pull sync).
 *
 * One row per user holds the entire {@link Backup} object, so all persisted
 * slices sync together without a table per data type. `pushBackup` upserts that
 * row; `pullBackup` reads it back. Deps are injectable so tests use a fake
 * Supabase client and user id with no network.
 */

const BACKUPS_TABLE = 'backups'

interface BackupRepoDeps {
  client?: SupabaseClient | null
  /** Resolve the current user id; defaults to the active session's user. */
  resolveUserId?: () => Promise<string | null>
}

async function defaultResolveUserId(): Promise<string | null> {
  const session = await getCurrentSession()
  return session?.user.id ?? null
}

async function requireContext(deps: BackupRepoDeps): Promise<{
  client: SupabaseClient
  userId: string
}> {
  const client = deps.client ?? getSupabaseClient()
  if (!client) throw new CloudNotConfiguredError()
  const userId = await (deps.resolveUserId ?? defaultResolveUserId)()
  if (!userId) throw new NotSignedInError()
  return { client, userId }
}

/** Upsert the user's single backup row with the full library snapshot. */
export async function pushBackup(backup: Backup, deps: BackupRepoDeps = {}): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const { error } = await client.from(BACKUPS_TABLE).upsert({
    user_id: userId,
    data: backup,
    updated_at: backup.exportedAt,
  })
  if (error) throw error
}

/** Read back the user's backup, or null when none has been pushed yet. */
export async function pullBackup(deps: BackupRepoDeps = {}): Promise<Backup | null> {
  const { client, userId } = await requireContext(deps)
  const { data, error } = await client
    .from(BACKUPS_TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? (data as { data: Backup }).data : null
}
