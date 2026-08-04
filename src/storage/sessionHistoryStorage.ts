import type { PracticeSessionRecord, PracticeSessionSummary } from '../types/practice'
import { isNonNegativeInteger, isValidTimestamp, readJson, writeJson } from './storageHelpers'

/**
 * Local persistence for the practice session history — an append-only log of
 * finished sessions per range, backed by `localStorage`.
 *
 * Mirrors `practiceStatsStorage.ts`: side-effect-only, with all reads/writes
 * funneled through the exported functions under a single versioned key. Unlike
 * the cumulative per-range stats (one record per range), history is a LIST per
 * range, kept in insertion order (oldest → newest), so the performance view can
 * show a session timeline.
 */

/** Versioned key so a future schema change can migrate instead of clobbering. */
export const SESSION_HISTORY_STORAGE_KEY = 'poker-range-trainer.session-history.v1'

/** Validate a parsed value as `PracticeSessionRecord`, returning `null` if malformed. */
function parsePracticeSessionRecord(value: unknown): PracticeSessionRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const { rangeId, playedAt, totalQuestions, correctAnswers } = value as Record<string, unknown>

  if (typeof rangeId !== 'string' || rangeId.length === 0) return null
  if (!isValidTimestamp(playedAt)) return null
  if (!isNonNegativeInteger(totalQuestions) || totalQuestions === 0) return null
  if (!isNonNegativeInteger(correctAnswers) || correctAnswers > totalQuestions) return null

  return { rangeId, playedAt, totalQuestions, correctAnswers }
}

/** Strictly validate and normalize a complete session-history map. */
export function validateSessionHistory(value: unknown): Record<string, PracticeSessionRecord[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Session history is not an object.')
  }
  const history: Record<string, PracticeSessionRecord[]> = {}
  for (const raw of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) throw new Error('Session history contains a non-list record.')
    for (const entry of raw) {
      const record = parsePracticeSessionRecord(entry)
      if (record === null) throw new Error('Session history contains an invalid session.')
      const sessions = history[record.rangeId] ?? []
      sessions.push(record)
      history[record.rangeId] = sessions
    }
  }
  return history
}

/** Persist the full history map, serialized under the single storage key. */
function writeSessionHistory(history: Record<string, PracticeSessionRecord[]>): void {
  writeJson(SESSION_HISTORY_STORAGE_KEY, history)
}

/**
 * All persisted session history, keyed by `rangeId`, each value an
 * oldest-first list of finished sessions.
 *
 * Returns an empty map when nothing is stored, the JSON is corrupt, or the stored
 * value is not a non-null, non-array object. Non-array range entries and malformed
 * records are skipped, and each record is re-keyed by its own `rangeId`, so one bad
 * record never discards the rest and the structure is always self-consistent.
 */
export function loadSessionHistory(): Record<string, PracticeSessionRecord[]> {
  const parsed = readJson(SESSION_HISTORY_STORAGE_KEY)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const history: Record<string, PracticeSessionRecord[]> = {}
  for (const value of Object.values(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      const record = parsePracticeSessionRecord(entry)
      if (record === null) continue
      const list = history[record.rangeId] ?? []
      list.push(record)
      history[record.rangeId] = list
    }
  }
  return history
}

/**
 * Append one finished session to `rangeId`'s history log.
 *
 * A session with no answered questions (`summary.totalQuestions <= 0`) is a
 * no-op, consistent with `recordPracticeSession`. `playedAt` defaults to now
 * (ISO-8601). New records go at the end so the list stays oldest-first.
 */
export function recordPracticeSessionHistory(
  rangeId: string,
  summary: Pick<PracticeSessionSummary, 'totalQuestions' | 'correctAnswers'>,
  playedAt: string = new Date().toISOString(),
): void {
  if (summary.totalQuestions <= 0) return
  if (
    rangeId.length === 0 ||
    !isNonNegativeInteger(summary.totalQuestions) ||
    !isNonNegativeInteger(summary.correctAnswers) ||
    summary.correctAnswers > summary.totalQuestions ||
    !isValidTimestamp(playedAt)
  ) {
    throw new Error('Cannot record an invalid practice session.')
  }

  const history = loadSessionHistory()
  const list = history[rangeId] ?? []
  history[rangeId] = [
    ...list,
    {
      rangeId,
      playedAt,
      totalQuestions: summary.totalQuestions,
      correctAnswers: summary.correctAnswers,
    },
  ]
  writeSessionHistory(history)
}
