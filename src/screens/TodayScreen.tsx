import { useState } from 'react'
import { RangeThumbnail } from '../components/RangeThumbnail'
import { formatDateLine, formatDayDistance, greetingFor } from '../app/format'
import {
  buildDailyWorkout,
  summarizeWorkout,
  workoutCompletedToday,
  type DailyWorkout,
} from '../domain/dailyWorkout'
import { practiceAccuracyPercentage } from '../domain/practiceStats'
import { currentStreak, selectDueRanges } from '../domain/spacedRepetition'
import { buildSpotCoverage, inferLibraryContext } from '../domain/spotCoverage'
import { GOAL_OPTIONS, evaluateDailyGoal, goalLine } from '../domain/trainingGoal'
import { summarizeWeek } from '../domain/weeklyStats'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { loadSpotAccuracy } from '../storage/spotAccuracyStorage'
import { loadTrainingGoal, saveTrainingGoal } from '../storage/trainingGoalStorage'
import { loadWorkoutCompletion } from '../storage/workoutStorage'
import type { SavedRange, TableSize } from '../types/range'
import './TodayScreen.css'

/** Rough drill length used for the "~X min" estimate on the review CTA. */
const MINUTES_PER_RANGE = 1.5

interface TodayScreenProps {
  /** Start a queued review drill through the given ranges (one at a time). */
  onStartReview: (queue: SavedRange[]) => void
  /** Start the spot drill over the whole library at the given format. */
  onPlaySpots: (format: { tableSize: TableSize; stackDepthBb: number }) => void
  /** Run the composed daily workout. */
  onStartWorkout: (workout: DailyWorkout) => void
}

/**
 * The home screen: what's due today, one primary action. All data is loaded
 * once on mount (practice unmounts this screen, so returning always re-reads
 * fresh stats).
 */
export function TodayScreen({ onStartReview, onPlaySpots, onStartWorkout }: TodayScreenProps) {
  const [now] = useState(() => new Date())
  const [ranges] = useState(() => loadSavedRanges())
  const [reviewStates] = useState(() => loadReviewStates())
  const [history] = useState(() => loadSessionHistory())
  const [practiceStats] = useState(() => loadPracticeStats())
  const [spotAccuracy] = useState(() => loadSpotAccuracy())
  const [workoutCompletion] = useState(() => loadWorkoutCompletion())
  const [goal, setGoal] = useState(() => loadTrainingGoal())

  const nowIso = now.toISOString()
  const due = selectDueRanges(
    ranges.filter((range) => !range.archived),
    reviewStates,
    nowIso,
  )
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt)
  const streak = currentStreak(playedAt, nowIso)
  const week = summarizeWeek(history, nowIso)
  const sharpestName = week.sharpestRangeId
    ? (ranges.find((range) => range.id === week.sharpestRangeId)?.name ?? null)
    : null
  const estimatedMinutes = Math.max(1, Math.ceil(due.length * MINUTES_PER_RANGE))
  const goalProgress = evaluateDailyGoal(history, nowIso, goal)
  // The spot drill only has something to deal once a range describes a situation.
  const spotFormat = inferLibraryContext(ranges)
  const spotCoverage = buildSpotCoverage(ranges, spotFormat.tableSize, spotFormat.stackDepthBb)
  // A finished workout stays finished for the day; the card flips to its done
  // state instead of re-offering the same plan.
  const workoutDone = workoutCompletedToday(workoutCompletion, nowIso)
  const workout = workoutDone
    ? null
    : buildDailyWorkout({
        ranges,
        reviewStates,
        spotAccuracy,
        now: nowIso,
        goalHands: goal,
      })

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
              You have no ranges yet. Build your first one in the Library, then come back here to
              train it on a schedule.
            </p>
          </div>
          <a className="coach-btn primary" href="#/library">
            Open Library
          </a>
        </section>
      ) : (
        <>
          {workoutDone ? (
            <section className="coach-card today-cta" aria-label="Daily workout">
              <div className="today-cta-copy">
                <h2>Daily workout</h2>
                <p className="coach-tabular">
                  Done for today. {goal > 0 ? goalLine(goalProgress) : 'See you tomorrow.'}
                </p>
              </div>
            </section>
          ) : (
            workout && (
              <section className="coach-card today-cta" aria-label="Daily workout">
                <div className="today-cta-copy">
                  <h2>Daily workout</h2>
                  <p className="coach-tabular">{summarizeWorkout(workout)}</p>
                </div>
                <button
                  type="button"
                  className="coach-btn primary"
                  onClick={() => onStartWorkout(workout)}
                >
                  Start workout
                </button>
              </section>
            )
          )}

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
                className={workout ? 'coach-btn' : 'coach-btn primary'}
                onClick={() => onStartReview(due)}
              >
                Start review
              </button>
            </section>
          ) : (
            <section className="coach-card today-cta" aria-label="All caught up">
              <div className="today-cta-copy">
                <h2>All caught up</h2>
                <p>Nothing is due right now. Fancy a free practice run anyway?</p>
              </div>
              <a className="coach-btn" href="#/library">
                Free practice
              </a>
            </section>
          )}

          {spotCoverage.covered > 0 && (
            <section className="coach-card today-cta" aria-label="Play the spot">
              <div className="today-cta-copy">
                <h2>Play the spot</h2>
                <p className="coach-tabular">
                  The table deals the situation &middot; {spotCoverage.covered} of{' '}
                  {spotCoverage.total} spots covered
                </p>
              </div>
              <button
                type="button"
                className="coach-btn"
                onClick={() => onPlaySpots(spotFormat)}
              >
                Play
              </button>
            </section>
          )}

          {due.length > 0 && (
            <section className="coach-card today-due" aria-label="Due now">
              <h3>Due now</h3>
              <ul className="today-due-list">
                {due.map((range) => {
                  const stats = practiceStats[range.id]
                  return (
                    <li key={range.id} className="today-due-row">
                      <RangeThumbnail hands={range.hands} size={40} />
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
              <h3>Daily goal</h3>
              <label className="today-goal-picker">
                <select
                  className="coach-input"
                  aria-label="Daily goal in hands"
                  value={goal}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    saveTrainingGoal(next)
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
