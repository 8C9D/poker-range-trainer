import { useState } from 'react'
import { formatDateLine, formatDayDistance, greetingFor } from '../app/format'
import {
  describeFreePractice,
  freePracticeAction,
  suggestFreePractice,
} from '../domain/freePractice'
import type { PokerHand } from '../domain/pokerHands'
import { practiceAccuracyPercentage } from '../domain/practiceStats'
import { currentStreak, selectDueRanges } from '../domain/spacedRepetition'
import { GOAL_OPTIONS, evaluateDailyGoal, goalLine } from '../domain/trainingGoal'
import { sessionsForLibrary, summarizeWeek } from '../domain/weeklyStats'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import type { SavedRange } from '../types/range'
import './TodayScreen.css'

/** Rough drill length used for the "~X min" estimate on the review CTA. */
const MINUTES_PER_RANGE = 1.5

interface TodayScreenProps {
  /** Start a queued review drill through the given ranges (one at a time). */
  onStartReview: (queue: SavedRange[]) => void
  /** Drill the queued ranges, each restricted to its own weak-hand pool. */
  onDrillWeakHands: (queue: SavedRange[], pools: Record<string, PokerHand[]>) => void
}

/**
 * The home screen: what's due today, one primary action. All data is loaded
 * once on mount (practice unmounts this screen, so returning always re-reads
 * fresh stats).
 */
export function TodayScreen({ onStartReview, onDrillWeakHands }: TodayScreenProps) {
  const [now] = useState(() => new Date())
  const [ranges] = useState(() => loadSavedRanges())
  const [reviewStates] = useState(() => loadReviewStates())
  const [storedHistory] = useState(() => loadSessionHistory())
  const [practiceStats] = useState(() => loadPracticeStats())
  const [handAccuracy] = useState(() => loadHandAccuracy())
  const [goal, setGoal] = useState(() => loadTrainingGoal())
  const [goalError, setGoalError] = useState<string | null>(null)

  const nowIso = now.toISOString()
  // Sessions recorded against ranges that have since gone away would still count
  // toward the streak, the week tiles, and the daily goal.
  const history = sessionsForLibrary(storedHistory, ranges)
  const due = selectDueRanges(
    ranges.filter((range) => !range.archived),
    reviewStates,
    nowIso,
  )
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt)
  const streak = currentStreak(playedAt, nowIso)
  const week = summarizeWeek(history, nowIso, 7)
  const sharpestName = week.sharpestRangeId
    ? (ranges.find((range) => range.id === week.sharpestRangeId)?.name ?? null)
    : null
  const estimatedMinutes = Math.max(1, Math.ceil(due.length * MINUTES_PER_RANGE))
  const goalProgress = evaluateDailyGoal(history, nowIso, goal)
  // Only worth computing when nothing is due, which is exactly when it is shown.
  const freePractice =
    due.length === 0
      ? suggestFreePractice({ ranges, handAccuracy, reviewStates, now: nowIso })
      : null

  function startFreePractice() {
    if (!freePractice) return
    if (freePractice.kind === 'weakHands') {
      onDrillWeakHands(freePractice.ranges, freePractice.pools)
      return
    }
    onStartReview([freePractice.range])
  }

  return (
    <div className="today">
      <p className="today-date">{formatDateLine(now)}</p>
      <div className="today-heading">
        <h1>{greetingFor(now)}</h1>
        {streak > 0 && (
          <span
            className="coach-chip today-streak"
            title="Counts consecutive days with at least one practice session. One rest day is forgiven before it resets."
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="today-flame">
              <path d="M12 2c1 4-4 5.5-4 10a4 4 0 0 0 8 0c0-2-1-3-1-3s3 1.5 3 5a6 6 0 0 1-12 0C6 8 11 7 12 2z" />
            </svg>
            {streak} day{streak === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {ranges.length === 0 ? (
        <section className="coach-card today-cta" aria-label="Get started">
          <div className="today-cta-copy">
            <h2>Welcome</h2>
            <p>
              You have no ranges yet. Create your first one — pick the hands on the grid, save
              it, and it shows up here ready to train.
            </p>
          </div>
          <div className="today-cta-actions">
            <a className="coach-btn primary" href="#/library/new">
              Create a range
            </a>
            <a className="coach-btn" href="#/library">
              Open Library
            </a>
          </div>
        </section>
      ) : (
        <>
          {due.length > 0 ? (
            <section className="coach-card today-cta" aria-label="Today's review">
              <div className="today-cta-copy">
                <h2>Today&rsquo;s review</h2>
                <p className="coach-tabular">
                  {due.length} range{due.length === 1 ? '' : 's'} due &middot; ~{estimatedMinutes}{' '}
                  min
                </p>
              </div>
              <button
                type="button"
                className="coach-btn primary"
                onClick={() => onStartReview(due)}
              >
                Start review
              </button>
            </section>
          ) : (
            <section className="coach-card today-cta" aria-label="All caught up">
              <div className="today-cta-copy">
                <h2>All caught up</h2>
                <p>
                  {freePractice
                    ? `Nothing is due right now. ${describeFreePractice(freePractice)}`
                    : 'Nothing is due right now. Fancy a free practice run anyway?'}
                </p>
              </div>
              {/* Caught up is where a steady user spends most days, so the card
                  runs the practice the records call for rather than handing the
                  "which range, which mode" decision back at the Library door. */}
              {freePractice ? (
                <button type="button" className="coach-btn" onClick={startFreePractice}>
                  {freePracticeAction(freePractice)}
                </button>
              ) : (
                <a className="coach-btn" href="#/library">
                  Free practice
                </a>
              )}
            </section>
          )}

          {due.length > 0 && (
            <section className="coach-card today-due" aria-label="Due now">
              <h2>Due now</h2>
              <ul className="today-due-list">
                {due.map((range) => {
                  const stats = practiceStats[range.id]
                  return (
                    <li key={range.id} className="today-due-row">
                      <div className="today-due-info">
                        <span className="today-due-name">{range.name}</span>
                        <span className="today-due-meta coach-tabular">
                          {stats
                            ? `${practiceAccuracyPercentage(stats).toFixed(0)}% last accuracy · practiced ${formatDayDistance(stats.lastPracticedAt, nowIso)}`
                            : 'New — never practiced'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="coach-btn"
                        onClick={() => onStartReview([range])}
                      >
                        Review
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="coach-card today-goal" aria-label="Daily goal">
            <div className="today-goal-head">
              <h2>Daily goal</h2>
              <label className="today-goal-picker">
                <select
                  className="coach-input"
                  aria-label="Daily goal in hands"
                  value={goal}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    // A throw here (full or blocked store) would escape the click
                    // handler and leave the picker showing a target nothing saved.
                    try {
                      saveTrainingGoal(next)
                    } catch (error) {
                      setGoalError(
                        error instanceof Error ? error.message : 'Could not save the daily goal.',
                      )
                      return
                    }
                    setGoalError(null)
                    setGoal(next)
                  }}
                >
                  <option value={0}>Off</option>
                  {GOAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} hands
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {goalError && (
              <p className="today-cta-error" role="alert">
                {goalError}
              </p>
            )}
            <p className="today-goal-line coach-tabular">{goalLine(goalProgress)}</p>
            {goal > 0 && (
              <div
                className="today-goal-bar"
                role="progressbar"
                aria-label="Daily goal progress"
                aria-valuenow={Math.round(goalProgress.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${goalProgress.percent}%` }} />
              </div>
            )}
          </section>

          <section className="today-tiles" aria-label="This week">
            <div className="coach-card today-tile">
              <span className="today-tile-value coach-tabular">{week.handsAnswered}</span>
              <span className="today-tile-label">Hands this week</span>
            </div>
            <div className="coach-card today-tile">
              <span className="today-tile-value coach-tabular">
                {week.handsAnswered > 0 ? `${week.accuracy.toFixed(0)}%` : '—'}
              </span>
              <span className="today-tile-label">Accuracy</span>
            </div>
            <div className="coach-card today-tile">
              <span className="today-tile-value today-tile-name" title={sharpestName ?? undefined}>
                {sharpestName ?? '—'}
              </span>
              <span className="today-tile-label">Sharpest range</span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
