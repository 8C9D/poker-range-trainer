import { render } from '@testing-library/react-native';

import { RangeStatsBar } from '../components/RangeStatsBar';

describe('RangeStatsBar', () => {
  it('shows zeros for an empty range', async () => {
    const { getByTestId } = await render(<RangeStatsBar hands={[]} />);

    expect(getByTestId('stat-hands')).toHaveTextContent('0 hands');
    expect(getByTestId('stat-combos')).toHaveTextContent('0/1326 combos');
    expect(getByTestId('stat-percent')).toHaveTextContent('0.0%');
  });

  it('counts combos and percentage for a selection', async () => {
    // AA = 6 combos, AKs = 4 combos -> 10 of 1326 = 0.75% -> 0.8% at 1dp.
    const { getByTestId } = await render(<RangeStatsBar hands={['AA', 'AKs']} />);

    expect(getByTestId('stat-hands')).toHaveTextContent('2 hands');
    expect(getByTestId('stat-combos')).toHaveTextContent('10/1326 combos');
    expect(getByTestId('stat-percent')).toHaveTextContent('0.8%');
  });

  it('counts a narrowed hand class at its refined size', async () => {
    // AA is down to one combo, so the range holds 5, not the hand-class 10.
    const { getByTestId } = await render(
      <RangeStatsBar hands={['AA', 'AKs']} comboSelections={{ AA: ['AhAs'] }} />,
    );

    expect(getByTestId('stat-combos')).toHaveTextContent('5/1326 combos');
    expect(getByTestId('stat-percent')).toHaveTextContent('0.4%');
  });

  it('uses the singular "hand" for one selection', async () => {
    const { getByTestId } = await render(<RangeStatsBar hands={['AA']} />);

    expect(getByTestId('stat-hands')).toHaveTextContent('1 hand');
  });
});
