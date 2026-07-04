/**
 * Pure, testable logic for the postflop decision drill, kept out of the screen so it
 * can be unit-tested without React (mirroring how `swipeAnswer.ts` extracts the
 * gesture-to-answer decision). All poker correctness lives in `@core` —
 * `buildPostflopScenario` validates/parses the cards and `suggestDecision` is the
 * teaching heuristic. This module only sources a random scenario from a range and
 * grades a pick against the heuristic.
 */
import { formatCard, RANKS, SUITS, type Card } from '@core/domain/cards';
import { handClassCombos } from '@core/domain/combos';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import {
  buildPostflopScenario,
  suggestDecision,
  type PostflopDecision,
  type PostflopScenario,
} from '@core/domain/postflopScenario';

/**
 * The action the hero faces, sampled per scenario. A mix of aggressive lines (bet /
 * raise — `isFacingAggression` true) and passive ones (check — false) so the drill
 * exercises both branches of the heuristic.
 */
export const POSTFLOP_FACINGS = [
  'villain bets pot',
  'villain bets half pot',
  'villain raises',
  'villain checks',
  'checked to you',
] as const;

/** Fixed pot/stack — the heuristic ignores them, so randomizing would add noise only. */
const POT_SIZE = 10;
const STACK_DEPTH = 100;

function pick<T>(arr: readonly T[], random: () => number): T {
  return arr[Math.min(arr.length - 1, Math.floor(random() * arr.length))];
}

/**
 * Deal a random postflop scenario from a range: pick a hand class, expand it to a
 * concrete combo for the hero, deal a 3-card flop from the remaining deck, and choose
 * the action faced. Returns a `@core` `PostflopScenario` built (and validated) by
 * `buildPostflopScenario`. `hands` must be non-empty (the screen guards this).
 */
export function dealPostflopScenario(
  hands: PokerHand[],
  random: () => number = Math.random,
): PostflopScenario {
  const heroHand = pick(handClassCombos(getRandomHandFrom(hands, random)), random);

  // Deal three distinct flop cards from the deck minus the hero's cards.
  const dead = new Set(heroHand.map(formatCard));
  const pool: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const card: Card = { rank, suit };
      if (!dead.has(formatCard(card))) pool.push(card);
    }
  }
  const flop: Card[] = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    flop.push(pool[index]);
    pool.splice(index, 1);
  }

  return buildPostflopScenario({
    heroHand: heroHand.map(formatCard).join(''),
    flop: flop.map(formatCard).join(''),
    potSize: POT_SIZE,
    stackDepth: STACK_DEPTH,
    facing: pick(POSTFLOP_FACINGS, random),
  });
}

export interface PostflopScore {
  chosen: PostflopDecision;
  suggested: PostflopDecision;
  rationale: string;
  correct: boolean;
}

/**
 * Grade a chosen decision against the heuristic's suggestion for the scenario. The pick
 * is "correct" when it matches `suggestDecision`; the rationale explains the suggestion.
 */
export function scorePostflopDecision(
  scenario: PostflopScenario,
  chosen: PostflopDecision,
): PostflopScore {
  const { decision: suggested, rationale } = suggestDecision(scenario);
  return { chosen, suggested, rationale, correct: chosen === suggested };
}
