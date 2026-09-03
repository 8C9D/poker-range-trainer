'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { ProgressReadModel } from '@poker-range-trainer/contracts'
import { HAND_CLASS_LABELS } from '@poker-range-trainer/domain/domain/handClass'
import {
  describeMistakeBias,
  describePositionBias,
} from '@poker-range-trainer/domain/domain/mistakeBias'
import { POSITION_LABELS } from '@poker-range-trainer/domain/types/range'

import { ApiClientError, getProgress, listRanges } from '@/lib/api-client'
import { storeDrillPools, type DrillPools } from '@/lib/drill-handoff'
import { browserTimeZone } from '@/lib/time-zone'

/** The list endpoint's largest page — one request covers most libraries whole. */
const NAME_LOOKUP_PAGE_SIZE = 100

type ProgressState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; progress: ProgressReadModel; rangeNames: Map<string, string> }

function practiceHref(rangeIds: readonly string[], poolsKey: string): string {
  const queue = rangeIds.map((id) => encodeURIComponent(id)).join(',')
  return `/app/practice?queue=${queue}&mode=recognition&pools=${encodeURIComponent(poolsKey)}`
}

function plural(count: number, word: string): string {
  return `${word}${count === 1 ? '' : 's'}`
}

/**
 * A calendar date read in the viewer's own zone.
 *
 * `new Date('2026-09-01')` is UTC midnight, which lands on August 31 for
 * anyone west of Greenwich and would label the bar with the wrong weekday.
 */
function calendarDate(day: string): Date {
  return new Date(`${day}T00:00:00`)
}

function weekdayLabel(day: string): string {
  return calendarDate(day).toLocaleDateString(undefined, { weekday: 'short' })
}

function weekLabel(weekStart: string): string {
  return calendarDate(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function messageFor(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'We could not load your progress.'
}

/**
 * Load the read model, plus the range names the weakest-hands table needs.
 *
 * The analytics carry range ids, not names: the server reports what the records
 * say, and a record can outlive the chart it was made against. The library
 * lookup is what turns the live ones into names and leaves the rest as
 * "Deleted range" — and it is skipped entirely when nothing weak was reported.
 */
async function loadProgress(): Promise<ProgressState> {
  try {
    const progress = (await getProgress(browserTimeZone())).data
    const rangeNames = new Map<string, string>()
    if (progress.weakestHands.length > 0) {
      const library = await listRanges({ pageSize: NAME_LOOKUP_PAGE_SIZE, archived: 'include' })
      for (const range of library.data) rangeNames.set(range.id, range.name)
    }
    return { status: 'ready', progress, rangeNames }
  } catch (error) {
    return { status: 'error', message: messageFor(error) }
  }
}

/** Long-term training overview: streak, accuracy, volume, and where the leaks are. */
export function ProgressView() {
  const router = useRouter()
  const [state, setState] = useState<ProgressState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void loadProgress().then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [loadAttempt])

  function retry(): void {
    setState({ status: 'loading' })
    setLoadAttempt((attempt) => attempt + 1)
  }

  /** Drill exactly the hands a report named, in exactly the ranges it named them for. */
  function drill(pools: DrillPools): void {
    const rangeIds = Object.keys(pools).filter((rangeId) => (pools[rangeId]?.length ?? 0) > 0)
    if (rangeIds.length === 0) return
    router.push(practiceHref(rangeIds, storeDrillPools(pools)))
  }

  if (state.status === 'loading') {
    return (
      <p className="library-state" aria-busy="true">
        Loading your progress…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="library-state" role="alert">
        <h1>We could not load your progress</h1>
        <p>{state.message}</p>
        <button className="button button-primary" type="button" onClick={retry}>
          Try again
        </button>
      </section>
    )
  }

  const { progress, rangeNames } = state
  const { allTime, mistakeBias, dailyActivity, weeklyAccuracyTrend } = progress
  const maxDay = Math.max(1, ...dailyActivity.map((day) => day.handsAnswered))
  const weekHasData = dailyActivity.some((day) => day.handsAnswered > 0)
  const trendHasData = weeklyAccuracyTrend.some((point) => point.handsAnswered > 0)
  // Weak-hand entries are already ranked; grouping keeps that order per range.
  const weakestPools: DrillPools = {}
  for (const entry of progress.weakestHands) {
    if (!rangeNames.has(entry.rangeId)) continue
    const pool = (weakestPools[entry.rangeId] ??= [])
    if (!pool.includes(entry.hand)) pool.push(entry.hand)
  }

  return (
    <section className="progress-view" aria-labelledby="progress-title">
      <h1 id="progress-title">Progress</h1>

      <section className="progress-tiles" aria-label="Training overview">
        <div className="today-card progress-tile">
          <span className="progress-tile-value">
            {progress.streakDays} {plural(progress.streakDays, 'day')}
          </span>
          <span className="progress-tile-label">
            Streak — one rest day is forgiven before it resets
          </span>
        </div>
        <div className="today-card progress-tile">
          <span className="progress-tile-value">
            {progress.trailingThirtyDays.handsAnswered > 0
              ? `${progress.trailingThirtyDays.accuracyPercentage.toFixed(0)}%`
              : '—'}
          </span>
          <span className="progress-tile-label">30-day accuracy</span>
        </div>
        <div className="today-card progress-tile">
          <span className="progress-tile-value">{allTime.handsAnswered}</span>
          <span className="progress-tile-label">Hands answered all-time</span>
        </div>
      </section>

      <section className="today-card" aria-label="Hands answered this week">
        <h2>Hands answered this week</h2>
        {weekHasData ? (
          <ul className="progress-chart">
            {dailyActivity.map((day, index) => {
              const weekday = weekdayLabel(day.day)
              return (
                <li
                  key={day.day}
                  className={
                    index === dailyActivity.length - 1
                      ? 'progress-chart-day is-today'
                      : 'progress-chart-day'
                  }
                  aria-label={`${weekday}: ${day.handsAnswered} ${plural(day.handsAnswered, 'hand')}`}
                >
                  {/* A bar with no number reads as decoration: 20 hands and 200
                      draw the same full-height column. */}
                  <span className="progress-chart-value">
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
          <p className="progress-empty">
            Answer some hands and this week&rsquo;s practice will show up here.
          </p>
        )}
      </section>

      <section className="today-card" aria-label="Accuracy by week">
        <h2>Accuracy by week</h2>
        {trendHasData ? (
          <ul className="progress-chart">
            {weeklyAccuracyTrend.map((point, index) => {
              const label = weekLabel(point.weekStart)
              return (
                <li
                  key={point.weekStart}
                  className={
                    index === weeklyAccuracyTrend.length - 1
                      ? 'progress-chart-day is-today'
                      : 'progress-chart-day'
                  }
                  aria-label={
                    point.handsAnswered > 0
                      ? `Week of ${label}: ${point.accuracyPercentage.toFixed(0)}% over ${point.handsAnswered} ${plural(point.handsAnswered, 'hand')}`
                      : `Week of ${label}: no practice`
                  }
                >
                  <span className="progress-chart-value">
                    {point.handsAnswered > 0 ? `${point.accuracyPercentage.toFixed(0)}%` : ''}
                  </span>
                  <span className="progress-chart-track">
                    <span
                      className="progress-chart-bar"
                      style={{ height: `${Math.round(point.accuracyPercentage)}%` }}
                    />
                  </span>
                  <span className="progress-chart-label">{label}</span>
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

      <section className="today-card" aria-label="Library analytics">
        <h2>Across your library</h2>
        {allTime.handsAnswered > 0 ? (
          <p className="progress-analytics">
            {allTime.rangesPracticed} {plural(allTime.rangesPracticed, 'range')} practiced ·{' '}
            {allTime.correctAnswers} of {allTime.handsAnswered} correct ·{' '}
            {allTime.accuracyPercentage.toFixed(0)}% overall
          </p>
        ) : (
          // "0 ranges practiced · 0 of 0 correct" is a row of zeros dressed as a
          // statistic; every sibling card explains itself when empty.
          <p className="progress-empty">
            Practice any range and how your library is going will show up here.
          </p>
        )}
      </section>

      <section className="today-card" aria-label="Which way you miss">
        <h2>Which way you miss</h2>
        <p className="progress-bias-verdict">{describeMistakeBias(mistakeBias)}</p>
        {mistakeBias.bias === 'unknown' ? null : (
          <>
            {/* Accuracy alone cannot separate a player who has to fold more from
                one who has to open up, and the two need opposite corrections. */}
            <span
              className="progress-bias-bar"
              role="img"
              aria-label={`${mistakeBias.loose} of ${mistakeBias.mistakes} misses played a hand the chart folds`}
            >
              <span
                className="progress-bias-loose"
                style={{ width: `${Math.round(mistakeBias.loosePercentage)}%` }}
              />
            </span>
            <p className="progress-bias-counts">
              {mistakeBias.loose} played too many · {mistakeBias.tight} folded too many
            </p>
            {progress.positionLeans.length > 0 ? (
              <ul className="progress-bias-seats">
                {progress.positionLeans.map((lean) => (
                  <li key={lean.position} className="progress-bias-seat-row">
                    <span className="progress-bias-seat-text">
                      <strong>{POSITION_LABELS[lean.position]}</strong> {describePositionBias(lean)}{' '}
                      ({lean.summary.bias === 'loose' ? lean.summary.loose : lean.summary.tight} of{' '}
                      {lean.summary.mistakes} misses)
                    </span>
                    {/* Every sibling report can be acted on from where it is
                        named; a lean with no drill sends the user off to work
                        out which charts it meant. */}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => drill(lean.pools)}
                      aria-label={`Drill the hands you ${
                        lean.summary.bias === 'loose' ? 'play too often' : 'fold too often'
                      } from ${POSITION_LABELS[lean.position]}`}
                    >
                      Drill
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className="today-card" aria-label="Leaks by hand type">
        <h2>Leaks by hand type</h2>
        {progress.handClassLeaks.length === 0 ? (
          <p className="progress-empty">
            Practice a little more and the hand types you miss most will show up here.
          </p>
        ) : (
          <ul className="progress-leaks">
            {progress.handClassLeaks.map((leak) => (
              <li key={leak.handClass} className="progress-leak">
                <div className="progress-leak-info">
                  <span className="progress-leak-name">{HAND_CLASS_LABELS[leak.handClass]}</span>
                  <span className="progress-leak-meta">
                    {leak.correct}/{leak.attempts} · {leak.accuracyPercentage.toFixed(0)}% ·{' '}
                    {leak.missedHands.slice(0, 4).join(', ')}
                    {leak.missedHands.length > 4 ? '…' : ''}
                  </span>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => drill(leak.pools)}
                  aria-label={`Drill ${HAND_CLASS_LABELS[leak.handClass]}`}
                >
                  Drill
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="today-card" aria-label="Weakest hands">
        <div className="progress-weak-header">
          <h2>Weakest hands</h2>
          {progress.weakestHands.length > 0 ? (
            <button
              className="button button-small"
              type="button"
              onClick={() => drill(weakestPools)}
            >
              Drill weakest hands
            </button>
          ) : null}
        </div>
        {progress.weakestHands.length === 0 ? (
          <p className="progress-empty">No recorded misses yet — they will show up here.</p>
        ) : (
          <div className="progress-table-scroll">
            <table className="progress-weak-table">
              <thead>
                <tr>
                  <th scope="col">Hand</th>
                  <th scope="col">Range</th>
                  <th scope="col">Record</th>
                  <th scope="col">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {progress.weakestHands.map((entry) => (
                  <tr key={`${entry.rangeId}-${entry.hand}`}>
                    <td>{entry.hand}</td>
                    <td className="progress-weak-range">
                      {rangeNames.get(entry.rangeId) ?? 'Deleted range'}
                    </td>
                    <td>
                      {entry.correct}/{entry.attempts}
                    </td>
                    <td>{entry.accuracyPercentage.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
