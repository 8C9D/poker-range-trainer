import { formatCard } from '@core/domain/cards';

import { availabilityForBoard, isBlockerAvailabilityError } from '../components/blockerDrill';

describe('availabilityForBoard', () => {
  it('counts all combos when the board is empty', () => {
    const result = availabilityForBoard(['AKs'], '');
    if (isBlockerAvailabilityError(result)) throw new Error('expected availability');
    expect(result.remaining).toBe(4);
  });

  it('removes combos blocked by the board', () => {
    const result = availabilityForBoard(['AKs'], 'As');
    if (isBlockerAvailabilityError(result)) throw new Error('expected availability');

    expect(result.remaining).toBe(3);
    const usesAs = result.combos.some((combo) => combo.some((card) => formatCard(card) === 'As'));
    expect(usesAs).toBe(false);
  });

  it('restricts eligibility to a combo selection', () => {
    const result = availabilityForBoard(['AKs'], '', new Set(['AhKh']));
    if (isBlockerAvailabilityError(result)) throw new Error('expected availability');

    expect(result.remaining).toBe(1);
    expect(result.combos[0].map(formatCard)).toEqual(['Ah', 'Kh']);
  });

  it('reports an error for an unparseable board', () => {
    const result = availabilityForBoard(['AKs'], 'ZZ');
    expect(isBlockerAvailabilityError(result)).toBe(true);
  });
});
