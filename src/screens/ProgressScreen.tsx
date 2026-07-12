import { useState } from 'react'
import { summarizeLibraryAnalytics } from '../domain/libraryAnalytics'
import { currentStreak } from '../domain/spacedRepetition'
import { rankWeakHands, weakHandPools } from '../domain/weakHands'
import { dailyHandCounts, summarizeWeek } from '../domain/weeklyStats'
import type { PokerHand } from '../domain/pokerHands'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import type { SavedRange } from '../types/range'
import './ProgressScreen.css'

interface ProgressScreenProps {
  /** Drill the queued ranges, each restricted to its own weak-hand pool. */
  onDrillWeakHands: (queue: SavedRange[], pools: Record<string, PokerHand[]>) => void
}

/** Long-term training overview: streak, accuracy, volume, and weak spots. */
export function ProgressScreen({ onDrillWeakHands }: ProgressScreenProps) {
  const [ranges] = useState(() => loadSavedRanges())
  const [history] = useState(() => loadSessionHistory())
  const [practiceStats] = useState(() => loadPracticeStats())
  const [handAccuracy] = useState(() => loadHandAccuracy())
  const [now] = useState(() => new Date())

  const nowIso = now.toISOString()
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt)
  const streak = currentStreak(playedAt, nowIso)
  const month = summarizeWeek(history, nowIso, 30)
  const analytics = summarizeLibraryAnalytics(Object.values(practiceStats))
  const days = dailyHandCounts(history, nowIso)
  const maxDay = Math.max(1, ...days.map((day) => day.handsAnswered))
  const weakHands = rankWeakHands(handAccuracy).filter((entry) =>
    ranges.some((range) => range.id === entry.rangeId),
  )

  function rangeName(rangeId: string): string {
    return ranges.find((range) => range.id === rangeId)?.name ?? 'Deleted range'
  }

  function drillWeakHands() {
    const pools = weakHandPools(weakHands)
    const queue = ranges.filter((range) => pools[range.id]?.length)
    if (queue.length === 0) return
    onDrillWeakHands(queue, pools)
  }

  return (
    <div className="progress">
      <h1>Progress</h1>

      <section className="progress-tiles" aria-label="Training overview">
        <div className="coach-card progress-tile">
          <span className="progress-tile-value coach-tabular">
            {streak} day{streak === 1 ? '' : 's'}
          </span>
          <span className="progress-tile-label">
            Streak — one rest day is forgiven before it resets
          </span>
        </div>
        <div className="coach-card progress-tile">
          <span className="progress-tile-value coach-tabular">
            {month.handsAnswered > 0 ? `${month.accuracy.toFixed(0)}%` : '—'}
          </span>
          <span className="progress-tile-label">30-day accuracy</span>
        </div>
        <div className="coach-card progress-tile">
          <span className="progress-tile-value coach-tabular">{analytics.totalAttempts}</span>
          <span className="progress-tile-label">Hands answered all-time</span>
        </div>
      </section>

      <section className="coach-card" aria-label="Hands answered this week">
        <h3>Hands answered this week</h3>
        <ul className="progress-chart">
          {days.map((day, index) => {
            const date = new Date(day.dayStart)
            const weekday = date.toLocaleDateString(undefined, {
              weekday: 'short',
              timeZone: 'UTC',
            })
            const isToday = index === days.length - 1
            return (
              <li
                key={day.dayStart}
                className={isToday ? 'progress-chart-day today' : 'progress-chart-day'}
                aria-label={`${weekday}: ${day.handsAnswered} hands`}
              >
                <span
                  className="progress-chart-bar"
                  title={`${day.handsAnswered} hands`}
                  style={{ height: `${Math.round((day.handsAnswered / maxDay) * 100)}%` }}
                />
                <span className="progress-chart-label">{weekday}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="coach-card" aria-label="Library analytics">
        <h3>Across your library</h3>
        <p className="progress-analytics coach-tabular">
          {analytics.rangesPracticed} range{analytics.rangesPracticed === 1 ? '' : 's'} practiced
          · {analytics.totalCorrect} of {analytics.totalAttempts} correct ·{' '}
          {analytics.totalAttempts > 0 ? `${analytics.overallAccuracy.toFixed(0)}%` : '—'} overall
        </p>
      </section>

      <section className="coach-card" aria-label="Weakest hands">
        <div className="progress-weak-header">
          <h3>Weakest hands</h3>
          {weakHands.length > 0 && (
            <button type="button" className="coach-btn primary" onClick={drillWeakHands}>
              Drill these
            </button>
          )}
        </div>
        {weakHands.length === 0 ? (
          <p className="progress-empty">No recorded misses yet — they will show up here.</p>
        ) : (
          <table className="progress-weak-table coach-tabular">
            <thead>
              <tr>
                <th scope="col">Hand</th>
                <th scope="col">Range</th>
                <th scope="col">Record</th>
                <th scope="col">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {weakHands.map((entry) => (
                <tr key={`${entry.rangeId}-${entry.hand}`}>
                  <td>{entry.hand}</td>
                  <td className="progress-weak-range">{rangeName(entry.rangeId)}</td>
                  <td>
                    {entry.correct}/{entry.attempts}
                  </td>
                  <td>{entry.accuracy.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
