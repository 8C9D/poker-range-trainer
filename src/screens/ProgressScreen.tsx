import { useState } from 'react'
import { HAND_CLASS_LABELS } from '../domain/handClass'
import { rankHandClassLeaks, type HandClassLeak } from '../domain/leakReport'
import { summarizeLibraryAnalytics } from '../domain/libraryAnalytics'
import {
  describeMistakeBias,
  describePositionBias,
  mistakeBiasByPosition,
  positionBiasPools,
  summarizeMistakeBias,
  type PositionMistakeBias,
} from '../domain/mistakeBias'
import { currentStreak } from '../domain/spacedRepetition'
import { rankWeakHands, weakHandPools } from '../domain/weakHands'
import {
  dailyHandCounts,
  sessionsForLibrary,
  summarizeWeek,
  weeklyAccuracyTrend,
} from '../domain/weeklyStats'
import type { PokerHand } from '../domain/pokerHands'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { POSITION_LABELS, type SavedRange } from '../types/range'
import './ProgressScreen.css'

interface ProgressScreenProps {
  /** Drill the queued ranges, each restricted to its own weak-hand pool. */
  onDrillWeakHands: (queue: SavedRange[], pools: Record<string, PokerHand[]>) => void
}

/** Long-term training overview: streak, accuracy, volume, and weak hands. */
export function ProgressScreen({ onDrillWeakHands }: ProgressScreenProps) {
  const [ranges] = useState(() => loadSavedRanges())
  const [storedHistory] = useState(() => loadSessionHistory())
  const [practiceStats] = useState(() => loadPracticeStats())
  const [handAccuracy] = useState(() => loadHandAccuracy())
  const [now] = useState(() => new Date())

  const nowIso = now.toISOString()
  // Every per-range cut below is already scoped to the live library; the volume
  // and accuracy figures have to be scoped the same way or they contradict it.
  const history = sessionsForLibrary(storedHistory, ranges)
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
  const weekHasData = days.some((day) => day.handsAnswered > 0)
  const trend = weeklyAccuracyTrend(history, nowIso)
  const trendHasData = trend.some((point) => point.handsAnswered > 0)
  // Stats for deleted ranges would name leaks the user can no longer drill. Both
  // reports below rank a CAPPED list, so the scoping happens before the ranking:
  // filtering afterwards lets an orphaned record spend one of the slots and push
  // a real leak off the end.
  const liveAccuracy = Object.fromEntries(
    Object.entries(handAccuracy).filter(([rangeId]) => liveRangeIds.has(rangeId)),
  )
  const weakHands = rankWeakHands(liveAccuracy)
  const leaks = rankHandClassLeaks(liveAccuracy)
  const bias = summarizeMistakeBias(liveAccuracy)
  const seatBias = mistakeBiasByPosition(ranges, liveAccuracy)

  function rangeName(rangeId: string): string {
    return ranges.find((range) => range.id === rangeId)?.name ?? 'Deleted range'
  }

  function drillLeak(leak: HandClassLeak) {
    const queue = ranges.filter((range) => leak.pools[range.id]?.length)
    if (queue.length === 0) return
    onDrillWeakHands(queue, leak.pools)
  }

  /** Drill a seat's lean over just the hands it missed in that direction. */
  function drillSeatBias(lean: PositionMistakeBias) {
    const pools = positionBiasPools(ranges, liveAccuracy, lean)
    const queue = ranges.filter((range) => pools[range.id]?.length)
    if (queue.length === 0) return
    onDrillWeakHands(queue, pools)
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
        <h2>Hands answered this week</h2>
        {weekHasData ? (
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
                  aria-label={`${weekday}: ${day.handsAnswered} hand${day.handsAnswered === 1 ? '' : 's'}`}
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
        ) : (
          // An all-zero chart is seven bare ticks: decoration that says nothing.
          // Every sibling card explains itself when empty; this one should too.
          <p className="progress-empty">
            Answer some hands and this week’s practice will show up here.
          </p>
        )}
      </section>

      <section className="coach-card" aria-label="Accuracy by week">
        <h2>Accuracy by week</h2>
        {trendHasData ? (
          <ul className="progress-chart">
            {trend.map((point, index) => {
              const weekLabel = new Date(point.weekStart).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
              const isThisWeek = index === trend.length - 1
              return (
                <li
                  key={point.weekStart}
                  className={isThisWeek ? 'progress-chart-day today' : 'progress-chart-day'}
                  aria-label={
                    point.handsAnswered > 0
                      ? `Week of ${weekLabel}: ${point.accuracy.toFixed(0)}% over ${point.handsAnswered} hand${point.handsAnswered === 1 ? '' : 's'}`
                      : `Week of ${weekLabel}: no practice`
                  }
                >
                  <span className="progress-chart-value coach-tabular">
                    {point.handsAnswered > 0 ? `${point.accuracy.toFixed(0)}%` : ''}
                  </span>
                  <span className="progress-chart-track">
                    <span
                      className="progress-chart-bar"
                      style={{ height: `${Math.round(point.accuracy)}%` }}
                    />
                  </span>
                  <span className="progress-chart-label">{weekLabel}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="progress-empty">
            Practice over a couple of weeks and your accuracy trend will show up here.
          </p>
        )}
      </section>

      <section className="coach-card" aria-label="Library analytics">
        <h2>Across your library</h2>
        {analytics.totalAttempts > 0 ? (
          <p className="progress-analytics coach-tabular">
            {analytics.rangesPracticed} range{analytics.rangesPracticed === 1 ? '' : 's'} practiced
            · {analytics.totalCorrect} of {analytics.totalAttempts} correct ·{' '}
            {analytics.overallAccuracy.toFixed(0)}% overall
          </p>
        ) : (
          // "0 ranges practiced · 0 of 0 correct · — overall" is a row of zeros
          // dressed as a statistic. Same reason as the charts above: every
          // sibling card explains itself when empty, so this one should too.
          <p className="progress-empty">
            Practice any range and how your library is going will show up here.
          </p>
        )}
      </section>

      <section className="coach-card" aria-label="Which way you miss">
        <h2>Which way you miss</h2>
        <p className="progress-bias-verdict">{describeMistakeBias(bias)}</p>
        {bias.bias !== 'unknown' && (
          <>
            {/* Accuracy alone cannot separate a player who has to fold more from
                one who has to open up, and the two need opposite corrections. */}
            <span
              className="progress-bias-bar"
              role="img"
              aria-label={`${bias.loose} of ${bias.mistakes} misses played a hand the chart folds`}
            >
              <span
                className="progress-bias-loose"
                style={{ width: `${Math.round(bias.loosePercentage)}%` }}
              />
            </span>
            <p className="progress-bias-counts coach-tabular">
              {`${bias.loose} played too many · ${bias.tight} folded too many`}
            </p>
            {seatBias.length > 0 && (
              <ul className="progress-bias-seats">
                {seatBias.map((lean) => (
                  <li key={lean.position} className="progress-bias-seat-row">
                    <span className="progress-bias-seat-text">
                      <strong>{POSITION_LABELS[lean.position]}</strong> {describePositionBias(lean)}{' '}
                      (
                      <span className="coach-tabular">
                        {lean.summary.bias === 'loose' ? lean.summary.loose : lean.summary.tight} of{' '}
                        {lean.summary.mistakes}
                      </span>
                      {' misses)'}
                    </span>
                    {/* Every sibling report on this screen can be acted on from
                        where it is named; a lean with no drill sends the user off
                        to work out which charts it meant. */}
                    <button
                      type="button"
                      className="coach-btn progress-bias-drill"
                      onClick={() => drillSeatBias(lean)}
                      aria-label={`Drill the hands you ${
                        lean.summary.bias === 'loose' ? 'play too often' : 'fold too often'
                      } from ${POSITION_LABELS[lean.position]}`}
                    >
                      Drill
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="coach-card" aria-label="Leaks by hand type">
        <h2>Leaks by hand type</h2>
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
          <h2>Weakest hands</h2>
          {weakHands.length > 0 && (
            <button type="button" className="coach-btn primary" onClick={drillWeakHands}>
              Drill these
            </button>
          )}
        </div>
        {weakHands.length === 0 ? (
          <p className="progress-empty">No recorded misses yet — they will show up here.</p>
        ) : (
          <div className="coach-table-scroll">
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
          </div>
        )}
      </section>
    </div>
  )
}
