'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { TodayReadModel } from '@poker-range-trainer/contracts'
import { goalLine } from '@poker-range-trainer/domain/domain/trainingGoal'

import { GoalSelect } from '@/components/goal-select'
import { ApiClientError, getToday, listRanges, updateTrainingGoal } from '@/lib/api-client'
import { storeDrillPools } from '@/lib/drill-handoff'
import { browserTimeZone } from '@/lib/time-zone'

/** Rough drill length behind the "~X min" estimate on the review CTA. */
const MINUTES_PER_RANGE = 1.5

type FreePractice = NonNullable<TodayReadModel['freePractice']>

type TodayState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; today: TodayReadModel; libraryEmpty: boolean }

/**
 * A review queue, optionally narrowed to a set of handed-over hands.
 *
 * The hand pools never travel in the URL — a leak can name dozens of hands
 * across several charts — so they go through `sessionStorage` and only the key
 * rides along. Comma-joining the ids after encoding each keeps the separator
 * the drill parser expects while still escaping anything inside an id.
 */
function practiceHref(rangeIds: readonly string[], poolsKey?: string): string {
  const queue = rangeIds.map((id) => encodeURIComponent(id)).join(',')
  const pools = poolsKey === undefined ? '' : `&pools=${encodeURIComponent(poolsKey)}`
  return `/app/practice?queue=${queue}&mode=recognition${pools}`
}

function dateLine(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * 'today', 'yesterday', or 'Nd ago', counted in local calendar days rather than
 * 24-hour buckets: an 11pm session is "yesterday" the next morning.
 */
function dayDistance(iso: string, nowIso: string): string {
  const then = new Date(iso)
  const now = new Date(nowIso)
  if (Number.isNaN(then.getTime()) || Number.isNaN(now.getTime())) return ''
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function plural(count: number, word: string): string {
  return `${word}${count === 1 ? '' : 's'}`
}

/** One line describing the suggestion, for the "all caught up" card. */
function describeFreePractice(suggestion: FreePractice): string {
  if (suggestion.kind === 'weakHands') {
    const charts = suggestion.rangeIds.length
    return `Sharpen the ${suggestion.handCount} ${plural(suggestion.handCount, 'hand')} you play worst, across ${charts} ${plural(charts, 'chart')}.`
  }
  return 'Get ahead: the chart that comes round next is ready to review early.'
}

function messageFor(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'We could not load your day.'
}

/**
 * Load Today, and only when it looks like a brand-new account, ask the library
 * whether it is genuinely empty.
 *
 * A quiet Today (nothing due, no suggestion, no hands this week) is what both a
 * first run and a fully rested week look like, and those want opposite screens:
 * "create your first range" versus "all caught up". One extra request settles
 * it, and it is skipped on every day that already has an answer.
 */
async function loadToday(): Promise<TodayState> {
  try {
    const today = (await getToday(browserTimeZone())).data
    const couldBeNew =
      today.dueRanges.length === 0 &&
      today.freePractice === null &&
      today.trailingSevenDays.handsAnswered === 0
    const libraryEmpty = couldBeNew ? (await listRanges({ pageSize: 1 })).data.length === 0 : false
    return { status: 'ready', today, libraryEmpty }
  } catch (error) {
    return { status: 'error', message: messageFor(error) }
  }
}

/** The home screen: what is due today, and one primary action. */
export function TodayView() {
  const router = useRouter()
  const [state, setState] = useState<TodayState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [goalError, setGoalError] = useState<string>()
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    let active = true
    void loadToday().then((next) => {
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

  /**
   * Save the picked target, then re-read Today: the goal line, the bar, and the
   * remaining count are all server-computed, so guessing them locally would
   * show a progress figure the next load contradicts. A failed save leaves the
   * select on the target that is actually stored.
   */
  async function saveGoal(nextTarget: number | null): Promise<void> {
    setSavingGoal(true)
    setGoalError(undefined)
    try {
      await updateTrainingGoal(nextTarget)
    } catch (error) {
      setGoalError(
        error instanceof ApiClientError ? error.message : 'Could not save the daily goal.',
      )
      return
    } finally {
      setSavingGoal(false)
    }
    setState(await loadToday())
  }

  function startWeakHandDrill(suggestion: Extract<FreePractice, { kind: 'weakHands' }>): void {
    const poolsKey = storeDrillPools(suggestion.pools)
    router.push(practiceHref(suggestion.rangeIds, poolsKey))
  }

  if (state.status === 'loading') {
    return (
      <p className="library-state" aria-busy="true">
        Loading your day…
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="library-state" role="alert">
        <h1>We could not load your day</h1>
        <p>{state.message}</p>
        <button className="button button-primary" type="button" onClick={retry}>
          Try again
        </button>
      </section>
    )
  }

  const { today, libraryEmpty } = state
  const now = new Date(today.generatedAt)
  const due = today.dueRanges
  const estimatedMinutes = Math.max(1, Math.ceil(due.length * MINUTES_PER_RANGE))
  const { target, handsAnswered, remainingHands } = today.dailyGoal
  const percent = target === null ? 0 : Math.min(100, (handsAnswered / target) * 100)
  const goalProgress = {
    target: target ?? 0,
    answered: handsAnswered,
    remaining: remainingHands,
    percent,
    met: target !== null && handsAnswered >= target,
  }
  const week = today.trailingSevenDays

  return (
    <section className="today" aria-labelledby="today-title">
      <p className="today-date">{dateLine(now)}</p>
      <div className="today-heading">
        <h1 id="today-title">{greetingFor(now)}</h1>
        {today.streakDays > 0 ? (
          <span
            className="status-chip today-streak"
            title="Counts consecutive days with at least one practice session. One rest day is forgiven before it resets."
          >
            {today.streakDays} {plural(today.streakDays, 'day')}
          </span>
        ) : null}
      </div>

      {libraryEmpty ? (
        <section className="today-card today-cta" aria-label="Get started">
          <div>
            <h2>Welcome</h2>
            <p className="app-lede">
              You have no ranges yet. Create your first one — pick the hands on the grid, save it,
              and it shows up here ready to train.
            </p>
          </div>
          <div className="today-cta-actions">
            <Link className="button button-primary" href="/app/library/new">
              Create a range
            </Link>
            <Link className="text-link" href="/app/library">
              Open library
            </Link>
          </div>
        </section>
      ) : (
        <>
          {due.length > 0 ? (
            <section className="today-card today-cta" aria-label="Today's review">
              <div>
                <h2>Today&rsquo;s review</h2>
                <p className="today-cta-meta">
                  {due.length} {plural(due.length, 'range')} due · ~{estimatedMinutes} min
                </p>
              </div>
              <Link
                className="button button-primary"
                href={practiceHref(due.map((range) => range.id))}
              >
                Start review
              </Link>
            </section>
          ) : (
            <section className="today-card today-cta" aria-label="All caught up">
              <div>
                <h2>All caught up</h2>
                <p className="today-cta-meta">
                  {today.freePractice
                    ? `Nothing is due right now. ${describeFreePractice(today.freePractice)}`
                    : 'Nothing is due right now. Fancy a free practice run anyway?'}
                </p>
              </div>
              {/* Caught up is where a steady user spends most days, so the card
                  runs the practice the records call for rather than handing the
                  "which range, which mode" decision back at the library door. */}
              <FreePracticeAction
                suggestion={today.freePractice}
                onDrillWeakHands={startWeakHandDrill}
              />
            </section>
          )}

          {due.length > 0 ? (
            <section className="today-card" aria-label="Due now">
              <h2>Due now</h2>
              <ul className="today-due-list">
                {due.map((range) => (
                  <li key={range.id} className="today-due-row">
                    <div className="today-due-info">
                      <span className="today-due-name">{range.name}</span>
                      <span className="today-due-meta">
                        {range.accuracyPercentage === null || range.lastPracticedAt === null
                          ? 'New — never practiced'
                          : `${range.accuracyPercentage.toFixed(0)}% last accuracy · practiced ${dayDistance(range.lastPracticedAt, today.generatedAt)}`}
                      </span>
                    </div>
                    <Link className="text-link" href={practiceHref([range.id])}>
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="today-card today-goal" aria-label="Daily goal">
            <div className="today-goal-head">
              <h2>Daily goal</h2>
              <GoalSelect
                className="today-goal-picker"
                label="Daily goal in hands"
                target={target}
                disabled={savingGoal}
                onChange={(nextTarget) => void saveGoal(nextTarget)}
              />
            </div>
            {goalError ? (
              <p className="form-error" role="alert">
                {goalError}
              </p>
            ) : null}
            <p className="today-goal-line">{goalLine(goalProgress)}</p>
            {target === null ? null : (
              <div
                className="today-goal-bar"
                role="progressbar"
                aria-label="Daily goal progress"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            )}
          </section>

          <section className="today-tiles" aria-label="This week">
            <div className="today-card today-tile">
              <span className="today-tile-value">{week.handsAnswered}</span>
              <span className="today-tile-label">Hands this week</span>
            </div>
            <div className="today-card today-tile">
              <span className="today-tile-value">
                {week.handsAnswered > 0 ? `${week.accuracyPercentage.toFixed(0)}%` : '—'}
              </span>
              <span className="today-tile-label">Accuracy</span>
            </div>
            <div className="today-card today-tile">
              <span
                className="today-tile-value today-tile-name"
                title={week.sharpestRange?.name ?? undefined}
              >
                {week.sharpestRange?.name ?? '—'}
              </span>
              <span className="today-tile-label">Sharpest range</span>
            </div>
          </section>
        </>
      )}
    </section>
  )
}

/**
 * The one button the "all caught up" card offers.
 *
 * A weak-hand drill has to hand its pools over before it navigates, so it is a
 * button; the other two are plain destinations and stay links, which keeps
 * middle-click and "open in new tab" working for them.
 */
function FreePracticeAction({
  suggestion,
  onDrillWeakHands,
}: {
  suggestion: FreePractice | null
  onDrillWeakHands: (suggestion: Extract<FreePractice, { kind: 'weakHands' }>) => void
}) {
  if (suggestion === null) {
    return (
      <Link className="button button-primary" href="/app/library">
        Free practice
      </Link>
    )
  }
  if (suggestion.kind === 'reviewEarly') {
    return (
      <Link className="button button-primary" href={practiceHref([suggestion.rangeId])}>
        Review early
      </Link>
    )
  }
  return (
    <button
      className="button button-primary"
      type="button"
      onClick={() => onDrillWeakHands(suggestion)}
    >
      Drill weak hands
    </button>
  )
}
