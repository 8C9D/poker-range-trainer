import type { SupabaseClient } from '@supabase/supabase-js'
import { validateBackup, type Backup } from '../storage/backup'
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
  const client = deps.client ?? (await getSupabaseClient())
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

/** Permanently delete the user's cloud backup. Local data is untouched. */
export async function deleteBackup(deps: BackupRepoDeps = {}): Promise<void> {
  const { client, userId } = await requireContext(deps)
  const { error } = await client.from(BACKUPS_TABLE).delete().eq('user_id', userId)
  if (error) throw error
}

/**
 * Read back the user's backup, or null when none has been pushed yet.
 *
 * The row is validated exactly like an imported file. A pull REPLACES the whole
 * local library, so a row this app cannot read — written by a newer version, or
 * left partial — has to fail here, before the restore. Unchecked, the caller
 * wrote it straight over a working library, which then read back as empty.
 */
export async function pullBackup(deps: BackupRepoDeps = {}): Promise<Backup | null> {
  const { client, userId } = await requireContext(deps)
  const { data, error } = await client
    .from(BACKUPS_TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return validateBackup((data as { data: unknown }).data)
}
