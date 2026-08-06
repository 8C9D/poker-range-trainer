import { comboKey, handClassCombos } from '@core/domain/combos';

import { enumerateCombos, isComboEnumerationError } from '../components/comboEnumeration';

describe('enumerateCombos', () => {
  it('enumerates the right combo counts for each hand shape', () => {
    const pair = enumerateCombos('AA', '');
    const suited = enumerateCombos('AKs', '');
    const offsuit = enumerateCombos('AKo', '');
    if (
      isComboEnumerationError(pair) ||
      isComboEnumerationError(suited) ||
      isComboEnumerationError(offsuit)
    ) {
      throw new Error('expected valid enumerations');
    }
    expect(pair.total).toBe(6);
    expect(suited.total).toBe(4);
    expect(offsuit.total).toBe(12);
  });

  it('normalizes loose input (case, suited/offsuit flag)', () => {
    const result = enumerateCombos('aks', '');
    expect(isComboEnumerationError(result)).toBe(false);
    if (!isComboEnumerationError(result)) {
      expect(result.hand).toBe('AKs');
      expect(result.survivingCount).toBe(4);
    }
  });

  it('removes exactly the combos blocked by a dead card', () => {
    const result = enumerateCombos('AKs', 'As');
    if (isComboEnumerationError(result)) throw new Error('expected a valid enumeration');

    // AKs has AsKs/AhKh/AdKd/AcKc; the As blocks only AsKs.
    expect(result.total).toBe(4);
    expect(result.survivingCount).toBe(3);
    const blocked = comboKey([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 's' },
    ]);
    expect(result.deadKeys.has(blocked)).toBe(true);
    expect(result.deadKeys.size).toBe(1);
  });

  it('blocks half a pair when one of its cards is dead', () => {
    const result = enumerateCombos('AA', 'As');
    if (isComboEnumerationError(result)) throw new Error('expected a valid enumeration');
    // Three of AA's six combos use the As.
    expect(result.survivingCount).toBe(3);
    expect(result.deadKeys.size).toBe(handClassCombos('AA').length - 3);
  });

  it('reports an error for an invalid hand', () => {
    const result = enumerateCombos('XY', '');
    expect(isComboEnumerationError(result)).toBe(true);
  });

  it('reports an error for unparseable dead cards', () => {
    const result = enumerateCombos('AKs', 'ZZ');
    expect(isComboEnumerationError(result)).toBe(true);
  });
});
