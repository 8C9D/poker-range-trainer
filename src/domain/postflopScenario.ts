import { formatCard, parseBoard, type Card } from './cards'
import { categorizeHand, type HandCategory } from './handCategory'

/**
 * Postflop decision-practice foundation (v4 "Practice postflop decisions").
 *
 * A scenario pairs the hero's two cards with a flop and some context (pot,
 * stack, the action faced). This is a self-graded drill foundation — there is no
 * solver/EV here; a "correct decision" heuristic can come in a later slice.
 */

export const POSTFLOP_DECISIONS = ['bet', 'check', 'call', 'raise', 'fold'] as const
export type PostflopDecision = (typeof POSTFLOP_DECISIONS)[number]

export const POSTFLOP_DECISION_LABELS: Record<PostflopDecision, string> = {
  bet: 'Bet',
  check: 'Check',
  call: 'Call',
  raise: 'Raise',
  fold: 'Fold',
}

export interface PostflopScenario {
  heroHand: Card[]
  flop: Card[]
  /** Pot size at decision time (in chips or big blinds; caller's choice). */
  potSize: number
  /** Effective stack depth at decision time. */
  stackDepth: number
  /** Short description of the action the hero faces, e.g. "villain bets pot". */
  facing: string
}

export interface PostflopScenarioInput {
  heroHand: string
  flop: string
  potSize: number
  stackDepth: number
  facing: string
}

/**
 * Parse and validate a postflop scenario. Throws a clear `Error` when the hand
 * or flop is malformed, the wrong size, or shares a card across hand and board.
 */
export function buildPostflopScenario(input: PostflopScenarioInput): PostflopScenario {
  const heroHand = parseBoard(input.heroHand)
  if (heroHand.length !== 2) {
    throw new Error('A hero hand must have exactly two cards.')
  }
  const flop = parseBoard(input.flop)
  if (flop.length !== 3) {
    throw new Error('A flop must have exactly three cards.')
  }
  const seen = new Set<string>()
  for (const card of [...heroHand, ...flop]) {
    const key = formatCard(card)
    if (seen.has(key)) {
      throw new Error(`Duplicate card across hand and board: "${key}".`)
    }
    seen.add(key)
  }
  return {
    heroHand,
    flop,
    potSize: input.potSize,
    stackDepth: input.stackDepth,
    facing: input.facing,
  }
}

/** The hero hand's category tags against the scenario's flop. */
export function describeHeroHand(scenario: PostflopScenario): HandCategory[] {
  return categorizeHand(scenario.heroHand, scenario.flop)
}

/** Strong made hands worth betting/raising for value. */
const STRONG_MADE: HandCategory[] = ['straight', 'set', 'trips', 'twoPair', 'overpair', 'topPair']
/** Drawing hands that want to continue (call vs a bet, semi-bluff when checked to). */
const DRAWS: HandCategory[] = ['flushDraw', 'straightDraw']
/** Medium-strength made hands that prefer a cheap showdown. */
const MEDIUM_MADE: HandCategory[] = ['middlePair', 'bottomPair', 'pair']

/**
 * True when the action the hero faces involves aggression (a bet or raise).
 *
 * The `(?<!-)` guard keeps a pot-type descriptor like "3-bet pot" from counting
 * as a bet the hero currently faces, while still matching "bets"/"bet" as verbs.
 */
export function isFacingAggression(scenario: PostflopScenario): boolean {
  return /\b((?<!-)bet|raise|jam|shove|all[- ]?in)/i.test(scenario.facing)
}

export interface DecisionSuggestion {
  decision: PostflopDecision
  rationale: string
}

/**
 * Suggest a postflop decision from a simple, transparent heuristic.
 *
 * This is a TEACHING heuristic, deliberately NOT GTO / solver-accurate: it maps
 * the hero hand's category tags (and whether aggression is faced) to a sensible
 * default line. Strong made hands play for value; draws continue; weak/air gives
 * up versus a bet and checks when first to act.
 */
export function suggestDecision(scenario: PostflopScenario): DecisionSuggestion {
  const tags = describeHeroHand(scenario)
  const facing = isFacingAggression(scenario)
  const has = (list: HandCategory[]) => list.some((tag) => tags.includes(tag))

  if (has(STRONG_MADE)) {
    return facing
      ? { decision: 'raise', rationale: 'Strong made hand — raise for value against a bet.' }
      : { decision: 'bet', rationale: 'Strong made hand — bet for value.' }
  }

  if (has(DRAWS)) {
    return facing
      ? { decision: 'call', rationale: 'Drawing hand — call to realize equity against a bet.' }
      : { decision: 'bet', rationale: 'Drawing hand — bet as a semi-bluff when checked to.' }
  }

  if (has(MEDIUM_MADE)) {
    return facing
      ? { decision: 'call', rationale: 'Medium-strength pair — call for a cheap showdown.' }
      : { decision: 'check', rationale: 'Medium-strength pair — check to control the pot.' }
  }

  return facing
    ? { decision: 'fold', rationale: 'No hand or draw — fold against a bet.' }
    : { decision: 'check', rationale: 'No hand or draw — check and give up.' }
}
