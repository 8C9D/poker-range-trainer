import { answerVerbs, feedbackLine, scenarioLine } from '../lib/scenario';
import type { SavedRange } from '@core/types/range';

function range(metadata?: SavedRange['metadata']): SavedRange {
  return {
    id: 'r1',
    name: 'Test',
    hands: ['AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata,
  };
}

describe('answerVerbs', () => {
  it('uses the range action verb vs Fold, falling back to In range', () => {
    expect(answerVerbs(range({ actionType: 'threeBet' }))).toEqual({ yes: '3-bet', no: 'Fold' });
    expect(answerVerbs(range())).toEqual({ yes: 'In range', no: 'Fold' });
  });
});

describe('scenarioLine', () => {
  it('describes the seat, stack, and action', () => {
    expect(scenarioLine(range({ position: 'utg', stackDepthBb: 100, actionType: 'open' }))).toBe(
      'You are UTG, 100bb. First to act — open or fold.',
    );
  });

  it('returns null with no metadata', () => {
    expect(scenarioLine(range())).toBeNull();
  });
});

describe('feedbackLine', () => {
  const verbs = { yes: 'Open', no: 'Fold' };

  it('confirms hits and explains misses', () => {
    expect(feedbackLine('AA', true, true, verbs)).toBe('Correct — open AA.');
    expect(feedbackLine('72o', false, true, verbs)).toBe('Correct — 72o is a fold.');
    expect(feedbackLine('AA', true, false, verbs)).toBe('AA is in this range — open it.');
    expect(feedbackLine('72o', false, false, verbs)).toBe("72o isn't in this range — fold it.");
  });
});
