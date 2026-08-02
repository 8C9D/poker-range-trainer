import { useState } from 'react'
import { HAND_CLASS_LABELS } from '../domain/handClass'
import { rankHandClassLeaks, type HandClassLeak } from '../domain/leakReport'
import { summarizeLibraryAnalytics } from '../domain/libraryAnalytics'
import { currentStreak } from '../domain/spacedRepetition'
import {
  accuracyByActionType,
  accuracyByPosition,
  type AccuracyGroup,
} from '../domain/seatAccuracy'
import { describeSpot, matchRangeToSpot, spotKey, type Spot } from '../domain/spot'
import { rankSpotLeaks } from '../domain/spotLeaks'
import { rankWeakHands, weakHandPools } from '../domain/weakHands'
import { dailyHandCounts, summarizeWeek } from '../domain/weeklyStats'
import type { PokerHand } from '../domain/pokerHands'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { loadSpotAccuracy } from '../storage/spotAccuracyStorage'
import {
  ACTION_TYPE_LABELS,
  POSITION_LABELS,
  type SavedRange,
} from '../types/range'
import './ProgressScreen.css'

interface ProgressScreenProps {
  /** Drill the queued ranges, each restricted to its own weak-hand pool. */
  onDrillWeakHands: (queue: SavedRange[], pools: Record<string, PokerHand[]>) => void
  /** Drill one recorded spot on its own. */
  onDrillSpot: (spot: Spot) => void
}

/** Long-term training overview: streak, accuracy, volume, and weak spots. */
export function ProgressScreen({ onDrillWeakHands, onDrillSpot }: ProgressScreenProps) {
  const [ranges] = useState(() => loadSavedRanges())
  const [history] = useState(() => loadSessionHistory())
  const [practiceStats] = useState(() => loadPracticeStats())
  const [handAccuracy] = useState(() => loadHandAccuracy())
  const [spotAccuracy] = useState(() => loadSpotAccuracy())
  const [now] = useState(() => new Date())

  const nowIso = now.toISOString()
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt)
  const streak = currentStreak(playedAt, nowIso)
  const month = summarizeWeek(history, nowIso, 30)
  const liveRangeIds = new Set(ranges.map((range) => range.id))
  const analytics = summarizeLibraryAnalytics(
    Object.values(practiceStats).filter((stat) => liveRangeIds.has(stat.rangeId)),
  )
  const days = dailyHandCounts(history, nowIso)
  const maxDay = Math.max(1, ...days.map((day) => day.handsAnswered))
  const weakHands = rankWeakHands(handAccuracy).filter((entry) =>
    ranges.some((range) => range.id === entry.rangeId),
  )
  // Stats for deleted ranges would name leaks the user can no longer drill.
  const liveAccuracy = Object.fromEntries(
    Object.entries(handAccuracy).filter(([rangeId]) =>
      ranges.some((range) => range.id === rangeId),
    ),
  )
  const leaks = rankHandClassLeaks(liveAccuracy)
  const spotLeaks = rankSpotLeaks(spotAccuracy).filter(
    (leak) => matchRangeToSpot(ranges, leak.spot) !== null,
  )
  const seatGroups = accuracyByPosition(ranges, practiceStats)
  const actionGroups = accuracyByActionType(ranges, practiceStats)

  function rangeName(rangeId: string): string {
    return ranges.find((range) => range.id === rangeId)?.name ?? 'Deleted range'
  }

  function drillLeak(leak: HandClassLeak) {
    const queue = ranges.filter((range) => leak.pools[range.id]?.length)
    if (queue.length === 0) return
    onDrillWeakHands(queue, leak.pools)
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
            })
            const isToday = index === days.length - 1
            return (
              <li
                key={day.dayStart}
                className={isToday ? 'progress-chart-day today' : 'progress-chart-day'}
                aria-label={`${weekday}: ${day.handsAnswered} hands`}
              >
                {/* A bar with no number reads as decoration: 20 hands and 200
                    draw the same full-height column. */}
                <span className="progress-chart-value coach-tabular">
                  {day.handsAnswered > 0 ? day.handsAnswered : ''}
                </span>
                <span className="progress-chart-track">
                  <span
                    className="progress-chart-bar"
                    style={{ height: `${Math.round((day.handsAnswered / maxDay) * 100)}%` }}
                  />
                </span>
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

      <section className="coach-card" aria-label="Accuracy by seat and action">
        <h3>Where you leak</h3>
        {seatGroups.length === 0 && actionGroups.length === 0 ? (
          <p className="progress-empty">
            Practice ranges that record a position or an action and this will show which seats
            and which actions you are weakest in.
          </p>
        ) : (
          <div className="progress-seats">
            <LeakColumn heading="By seat" groups={seatGroups} labels={POSITION_LABELS} />
            <LeakColumn heading="By action" groups={actionGroups} labels={ACTION_TYPE_LABELS} />
          </div>
        )}
      </section>

      {spotLeaks.length > 0 && (
        <section className="coach-card" aria-label="Weakest spots">
          <h3>Weakest spots</h3>
          <ul className="progress-spot-list">
            {spotLeaks.slice(0, 5).map((leak) => (
              <li key={spotKey(leak.spot)} className="progress-spot-row">
                <div className="progress-spot-info">
                  <span className="progress-spot-name">{describeSpot(leak.spot)}</span>
                  <span className="progress-spot-meta coach-tabular">
                    {leak.correct}/{leak.attempts} · {leak.accuracy.toFixed(0)}%
                  </span>
                </div>
                <button
                  type="button"
                  className="coach-btn"
                  onClick={() => onDrillSpot(leak.spot)}
                  aria-label={`Drill ${describeSpot(leak.spot)}`}
                >
                  Drill
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="coach-card" aria-label="Leaks by hand type">
        <h3>Leaks by hand type</h3>
        {leaks.length === 0 ? (
          <p className="progress-empty">
            Practice a little more and the hand types you miss most will show up here.
          </p>
        ) : (
          <ul className="progress-leaks">
            {leaks.map((leak) => (
              <li key={leak.handClass} className="progress-leak">
                <div className="progress-leak-info">
                  <span className="progress-leak-name">{HAND_CLASS_LABELS[leak.handClass]}</span>
                  <span className="progress-leak-meta coach-tabular">
                    {leak.correct}/{leak.attempts} · {leak.accuracy.toFixed(0)}% ·{' '}
                    {leak.missedHands.slice(0, 4).join(', ')}
                    {leak.missedHands.length > 4 ? '…' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="coach-btn"
                  onClick={() => drillLeak(leak)}
                  aria-label={`Drill ${HAND_CLASS_LABELS[leak.handClass]}`}
                >
                  Drill
                </button>
              </li>
            ))}
          </ul>
        )}
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

/**
 * One ranked column of the v8.4 leak breakdown: weakest group first, each an
 * accuracy bar. Renders nothing when the cut has no group above the threshold.
 */
function LeakColumn<T extends string>({
  heading,
  groups,
  labels,
}: {
  heading: string
  groups: AccuracyGroup<T>[]
  labels: Record<T, string>
}) {
  if (groups.length === 0) return null
  return (
    <div className="progress-seat-column">
      <h4 className="progress-seat-heading">{heading}</h4>
      <ul className="progress-seat-list">
        {groups.map((group) => (
          <li key={group.key} className="progress-seat-row">
            <span className="progress-seat-name">{labels[group.key]}</span>
            <span className="progress-seat-bar">
              <span
                className="progress-seat-fill"
                style={{ width: `${Math.max(2, group.accuracy)}%` }}
              />
            </span>
            <span className="progress-seat-value coach-tabular">
              {group.accuracy.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
