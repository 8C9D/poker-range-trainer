import {
  practiceModeValues,
  type HandAccuracyStat,
  type PracticeMode,
} from '@poker-range-trainer/contracts'
import { rangeEdgeHands } from '@poker-range-trainer/domain/domain/edgeHands'
import { isValidHand, type PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'
import {
  getRandomHandFrom,
  getRandomPracticeHand,
  handsWithMistakes,
  isHandInRange,
} from '@poker-range-trainer/domain/domain/practice'
import {
  DEFAULT_DRILL_SECONDS,
  DRILL_DURATION_OPTIONS,
} from '@poker-range-trainer/domain/domain/timedDrill'
import { getWeaknessFocusedHand } from '@poker-range-trainer/domain/domain/weaknessDrill'
import type { PracticeAttempt, RangeHandAccuracy } from '@poker-range-trainer/domain/types/practice'

/**
 * Everything a practice run decides before it renders anything: what the URL
 * asked for, which hands the chosen mode may deal, which hand comes next, and
 * how one answer scores.
 *
 * Kept out of the component on purpose — question selection is where a drill is
 * right or wrong, and it is only checkable if randomness is injected and no
 * React, storage, or clock is involved. The component reads a plan and renders
 * it; every rule below is a pure function.
 */

/** Questions per run when the URL does not say. */
export const DEFAULT_QUESTION_COUNT = 20
export const MIN_QUESTION_COUNT = 5
export const MAX_QUESTION_COUNT = 100

/** The submission contract caps a queue at 100 ranges; so does the URL. */
export const MAX_QUEUE_LENGTH = 100

export const EDGES_FALLBACK_NOTICE =
  'This range has no borderline hands, so this run deals every hand instead.'
export const MISTAKES_EMPTY_NOTICE = 'No recorded mistakes for this range yet'

export interface DrillRequest {
  /** Ranges to drill, in order. Empty means the URL named none. */
  rangeIds: string[]
  mode: PracticeMode
  questionCount: number
  seconds: number
  poolsKey: string | undefined
}

/** The subset of `URLSearchParams` a request needs, so tests can pass anything. */
interface ReadableSearchParams {
  get(name: string): string | null
}

function isPracticeMode(value: string): value is PracticeMode {
  return (practiceModeValues as readonly string[]).includes(value)
}

function parseRangeIds(params: ReadableSearchParams): string[] {
  const raw = [params.get('range') ?? '', ...(params.get('queue') ?? '').split(',')]
  const ids: string[] = []
  const seen = new Set<string>()
  for (const candidate of raw) {
    const id = candidate.trim()
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length === MAX_QUEUE_LENGTH) break
  }
  return ids
}

function parseQuestionCount(raw: string | null): number {
  const count = Number(raw)
  if (!Number.isInteger(count)) return DEFAULT_QUESTION_COUNT
  if (count < MIN_QUESTION_COUNT || count > MAX_QUESTION_COUNT) return DEFAULT_QUESTION_COUNT
  return count
}

function parseSeconds(raw: string | null): number {
  const seconds = Number(raw)
  return DRILL_DURATION_OPTIONS.includes(seconds) ? seconds : DEFAULT_DRILL_SECONDS
}

/**
 * Read a practice URL. Every field falls back to its default rather than
 * failing: a hand-edited query string should start a sensible drill, not an
 * error page. Only a missing range list is fatal, and that is the caller's
 * "choose a range" state.
 */
export function parseDrillRequest(params: ReadableSearchParams): DrillRequest {
  const mode = params.get('mode') ?? ''
  const poolsKey = (params.get('pools') ?? '').trim()
  return {
    rangeIds: parseRangeIds(params),
    mode: isPracticeMode(mode) ? mode : 'recognition',
    questionCount: parseQuestionCount(params.get('count')),
    seconds: parseSeconds(params.get('seconds')),
    poolsKey: poolsKey === '' ? undefined : poolsKey,
  }
}

/** Where a run's prompts come from. */
export type DrillPool =
  /** Any of the 169 hands, uniformly. */
  | { readonly kind: 'random' }
  /** Only these hands (edges, recorded mistakes, or a handoff pool). */
  | { readonly kind: 'fixed'; readonly hands: readonly PokerHand[] }
  /** All 169, weighted toward hands with a recorded or in-run miss. */
  | { readonly kind: 'weakness'; readonly history: readonly PracticeAttempt[] }

export interface DrillPlan {
  readonly pool: DrillPool
  /** Why this run is not quite what was asked for, or undefined when it is. */
  readonly notice: string | undefined
  /** True when the mode has nothing to deal: do not start, do not submit. */
  readonly empty: boolean
}

export interface DrillPlanInput {
  mode: PracticeMode
  rangeHands: readonly PokerHand[]
  /** Cumulative per-hand record from `GET /practice/ranges/:id`. */
  handAccuracy: readonly HandAccuracyStat[]
  /** Hands handed over by another screen, if any. */
  handoffPool: readonly PokerHand[] | undefined
}

/** Keep only canonical hands, de-duplicated, in the order given. */
export function sanitizeHandPool(hands: readonly PokerHand[]): PokerHand[] {
  return [...new Set(hands.filter((hand) => isValidHand(hand)))]
}

/** The API reports per-hand accuracy as a list; the domain keys it by hand. */
export function indexHandAccuracy(stats: readonly HandAccuracyStat[]): RangeHandAccuracy {
  const indexed: RangeHandAccuracy = {}
  for (const stat of stats) indexed[stat.hand] = stat
  return indexed
}

/**
 * One incorrect attempt per recorded miss, capped per hand.
 *
 * `buildWeaknessPool` weights its draw by counting incorrect attempts, so the
 * cumulative record has to be replayed as attempts to bias it. The cap keeps a
 * long-running range from turning the pool into one hand: past ten misses the
 * hand is already as over-represented as it usefully can be.
 */
const MAX_REPLAYED_MISSES_PER_HAND = 10
const REPLAY_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export function replayRecordedMisses(stats: readonly HandAccuracyStat[]): PracticeAttempt[] {
  const attempts: PracticeAttempt[] = []
  for (const stat of stats) {
    const misses = Math.min(stat.falsePositives + stat.falseNegatives, MAX_REPLAYED_MISSES_PER_HAND)
    for (let index = 0; index < misses; index += 1) {
      // Direction only matters to a recap, never to the pool weighting, but
      // keeping it honest costs nothing: the first replays are the folds.
      const expectedInRange = index < stat.falseNegatives
      attempts.push({
        hand: stat.hand,
        expectedInRange,
        userAnsweredInRange: !expectedInRange,
        correct: false,
        timestamp: REPLAY_TIMESTAMP,
      })
    }
  }
  return attempts
}

function plan(pool: DrillPool, notice?: string): DrillPlan {
  return { pool, notice, empty: false }
}

/**
 * Decide which hands a run may deal.
 *
 * A handoff pool always wins: another screen asked for these exact hands, and
 * silently widening that back to the mode's own pool would drill the wrong
 * thing. Otherwise the mode decides, and the two modes that can come up empty
 * say so instead of pretending: edges falls back to every hand with a notice
 * (an all-in or empty range genuinely has no boundary), while mistakes refuses
 * to run at all, because a mistakes drill over hands you have never missed is
 * not the drill that was asked for.
 */
export function buildDrillPlan(input: DrillPlanInput): DrillPlan {
  const handoff = sanitizeHandPool(input.handoffPool ?? [])
  if (handoff.length > 0) return plan({ kind: 'fixed', hands: handoff })

  switch (input.mode) {
    case 'edges': {
      const edges = rangeEdgeHands([...input.rangeHands])
      if (edges.length === 0) return plan({ kind: 'random' }, EDGES_FALLBACK_NOTICE)
      return plan({ kind: 'fixed', hands: edges })
    }
    case 'mistakes': {
      const missed = handsWithMistakes(indexHandAccuracy(input.handAccuracy))
      if (missed.length === 0) {
        return { pool: { kind: 'fixed', hands: [] }, notice: MISTAKES_EMPTY_NOTICE, empty: true }
      }
      return plan({ kind: 'fixed', hands: missed })
    }
    case 'weakness':
      return plan({ kind: 'weakness', history: replayRecordedMisses(input.handAccuracy) })
    case 'recognition':
    case 'timed':
    case 'build':
      return plan({ kind: 'random' })
  }
}

/**
 * The next hand to prompt. `answered` is this run's attempts so far, which only
 * the weakness pool uses — it re-weights as the run exposes new soft spots.
 */
export function drawDrillHand(
  pool: DrillPool,
  answered: readonly PracticeAttempt[],
  random: () => number = Math.random,
): PokerHand {
  switch (pool.kind) {
    case 'random':
      return getRandomPracticeHand(random)
    case 'fixed':
      if (pool.hands.length === 0) throw new Error('Cannot draw a prompt from an empty pool.')
      return getRandomHandFrom([...pool.hands], random)
    case 'weakness':
      return getWeaknessFocusedHand([...pool.history, ...answered], random)
  }
}

/** One answered question, carrying both what to submit and what to show. */
export interface DrillAnswer {
  questionId: string
  hand: PokerHand
  /** What the user said: true = "in range". */
  answer: boolean
  answeredAt: string
  expectedInRange: boolean
  correct: boolean
}

/**
 * Score an answer locally so feedback is immediate. The server scores the
 * submission again from the range it owns; this copy only drives the UI.
 */
export function scoreDrillAnswer(
  hand: PokerHand,
  rangeHands: readonly PokerHand[],
  answer: boolean,
  identity: { questionId: string; answeredAt: string },
): DrillAnswer {
  const expectedInRange = isHandInRange(hand, [...rangeHands])
  return {
    questionId: identity.questionId,
    hand,
    answer,
    answeredAt: identity.answeredAt,
    expectedInRange,
    correct: answer === expectedInRange,
  }
}

/** The exact shape `practiceSessionSubmissionSchema` accepts — nothing more. */
export function toSubmissionAnswers(
  answers: readonly DrillAnswer[],
): { questionId: string; hand: PokerHand; answer: boolean; answeredAt: string }[] {
  return answers.map(({ questionId, hand, answer, answeredAt }) => ({
    questionId,
    hand,
    answer,
    answeredAt,
  }))
}

/** The same answers as domain attempts, for the recap and weakness weighting. */
export function toPracticeAttempts(answers: readonly DrillAnswer[]): PracticeAttempt[] {
  return answers.map((answer) => ({
    hand: answer.hand,
    expectedInRange: answer.expectedInRange,
    userAnsweredInRange: answer.answer,
    correct: answer.correct,
    timestamp: answer.answeredAt,
  }))
}

export type CardSuit = 's' | 'h' | 'd' | 'c'
export interface PromptCard {
  rank: string
  suit: CardSuit
}

/**
 * Two concrete cards for a hand code, so the prompt looks like a deal rather
 * than notation. Deterministic: a suited hand shares a suit, a pair and an
 * offsuit hand do not, which is all the notation actually says.
 */
export function promptCards(hand: PokerHand): PromptCard[] {
  const high = hand[0] ?? '?'
  const low = hand[1] ?? '?'
  return hand.endsWith('s')
    ? [
        { rank: high, suit: 's' },
        { rank: low, suit: 's' },
      ]
    : [
        { rank: high, suit: 's' },
        { rank: low, suit: 'h' },
      ]
}
