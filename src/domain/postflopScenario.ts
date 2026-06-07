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
