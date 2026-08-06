import { fireEvent, render } from '@testing-library/react-native';

import { ALL_HANDS, type PokerHand } from '@core/domain/pokerHands';
import type { RangeAction } from '@core/types/range';

import { ActionGrid } from '../components/ActionGrid';

const noActions = {} as Record<PokerHand, RangeAction>;
// Most cases are about the grid itself, so they hand it a range that holds
// every hand; the out-of-range behaviour has its own case at the end.
const everyHand = ALL_HANDS;

describe('ActionGrid', () => {
  it('assigns the active action to an unassigned cell', async () => {
    const onAssign = jest.fn();
    const { getByTestId } = await render(
      <ActionGrid handActions={noActions} rangeHands={everyHand} activeAction="call" onAssign={onAssign} />,
    );

    fireEvent.press(getByTestId('action-cell-AA'));
    expect(onAssign).toHaveBeenCalledWith('AA', 'call');
  });

  it('clears a cell that already holds the active action', async () => {
    const onAssign = jest.fn();
    const handActions = { AA: 'raise' } as Record<PokerHand, RangeAction>;
    const { getByTestId } = await render(
      <ActionGrid handActions={handActions} rangeHands={everyHand} activeAction="raise" onAssign={onAssign} />,
    );

    fireEvent.press(getByTestId('action-cell-AA'));
    expect(onAssign).toHaveBeenCalledWith('AA', null);
  });

  it('announces the assigned action (or unassigned) in each cell label', async () => {
    const handActions = { AA: 'raise' } as Record<PokerHand, RangeAction>;
    const { getByLabelText } = await render(
      <ActionGrid handActions={handActions} rangeHands={everyHand} activeAction="raise" onAssign={jest.fn()} />,
    );

    expect(getByLabelText('AA: Raise')).toBeTruthy();
    expect(getByLabelText('KK: unassigned')).toBeTruthy();
  });

  it('shows a hand outside the range as out, and refuses to assign it', async () => {
    // `hands` is the membership list, so an action on a hand the range does not
    // hold is inert: the quiz skips it and the export does not colour it.
    const onAssign = jest.fn();
    const handActions = { AA: 'raise', QQ: 'threeBet' } as Record<PokerHand, RangeAction>;
    const { getByLabelText, getByTestId } = await render(
      <ActionGrid
        handActions={handActions}
        rangeHands={['AA', 'KK']}
        activeAction="raise"
        onAssign={onAssign}
      />,
    );

    expect(getByLabelText('QQ: not in this range')).toBeTruthy();
    fireEvent.press(getByTestId('action-cell-QQ'));
    expect(onAssign).not.toHaveBeenCalled();
  });
});
