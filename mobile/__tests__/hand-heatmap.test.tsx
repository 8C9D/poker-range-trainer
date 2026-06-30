import { render } from '@testing-library/react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import type { HandAccuracyStat, RangeHandAccuracy } from '@core/types/practice';

import { HandHeatmap } from '../components/HandHeatmap';

function stat(hand: PokerHand, attempts: number, correct: number): HandAccuracyStat {
  return { hand, attempts, correct, falsePositives: 0, falseNegatives: attempts - correct };
}

describe('HandHeatmap', () => {
  it('renders 169 cells colored by accuracy heat level', async () => {
    // AA answered 0/2 → 0% → low; KK 2/2 → 100% → high; everything else untested.
    const accuracy = {
      AA: stat('AA', 2, 0),
      KK: stat('KK', 2, 2),
    } as Partial<RangeHandAccuracy> as RangeHandAccuracy;

    const { getAllByTestId, getByTestId } = await render(<HandHeatmap accuracy={accuracy} />);

    expect(getAllByTestId(/^heat-cell-/)).toHaveLength(169);
    expect(getByTestId('heat-cell-AA').props.accessibilityValue.text).toBe('low');
    expect(getByTestId('heat-cell-KK').props.accessibilityValue.text).toBe('high');
    expect(getByTestId('heat-cell-72o').props.accessibilityValue.text).toBe('untested');
  });
});
