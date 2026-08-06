import { formatCard } from '@core/domain/cards';
import {
  buildPostflopScenario,
  POSTFLOP_DECISIONS,
  suggestDecision,
} from '@core/domain/postflopScenario';

import { dealPostflopScenario, scorePostflopDecision } from '../components/postflopDrill';

describe('scorePostflopDecision', () => {
  // AA on A-7-2, checked to you → strong made hand, not facing aggression → bet.
  const scenario = buildPostflopScenario({
    heroHand: 'AsAh',
    flop: 'Ad7c2h',
    potSize: 10,
    stackDepth: 100,
    facing: 'checked to you',
  });

  it('scores the heuristic-suggested decision correct', () => {
    const suggested = suggestDecision(scenario).decision;
    expect(suggested).toBe('bet');

    const score = scorePostflopDecision(scenario, suggested);
    expect(score.correct).toBe(true);
    expect(score.suggested).toBe('bet');
  });

  it('scores a different pick incorrect', () => {
    const suggested = suggestDecision(scenario).decision;
    const otherPick = POSTFLOP_DECISIONS.find((decision) => decision !== suggested)!;

    const score = scorePostflopDecision(scenario, otherPick);
    expect(score.correct).toBe(false);
    expect(score.suggested).toBe('bet');
  });
});

describe('dealPostflopScenario', () => {
  it('deals a valid scenario: 2 hero cards, 3 flop cards, all distinct', () => {
    const scenario = dealPostflopScenario(['AA', 'AKs', 'KQo'], () => 0);

    expect(scenario.heroHand).toHaveLength(2);
    expect(scenario.flop).toHaveLength(3);
    const keys = [...scenario.heroHand, ...scenario.flop].map(formatCard);
    expect(new Set(keys).size).toBe(5);
  });

  it('only deals hero hands drawn from the provided range', () => {
    // random()=0 → getRandomHandFrom picks index 0 ('AA'), so the hero holds two aces.
    const scenario = dealPostflopScenario(['AA'], () => 0);
    expect(scenario.heroHand.every((card) => card.rank === 'A')).toBe(true);
  });
});
