import { fireEvent, render } from '@testing-library/react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import type { RangeAction } from '@core/types/range';

import { ActionGrid } from '../components/ActionGrid';

const noActions = {} as Record<PokerHand, RangeAction>;

describe('ActionGrid', () => {
  it('assigns the active action to an unassigned cell', async () => {
    const onAssign = jest.fn();
    const { getByTestId } = await render(
      <ActionGrid handActions={noActions} activeAction="call" onAssign={onAssign} />,
    );

    fireEvent.press(getByTestId('action-cell-AA'));
    expect(onAssign).toHaveBeenCalledWith('AA', 'call');
  });

  it('clears a cell that already holds the active action', async () => {
    const onAssign = jest.fn();
    const handActions = { AA: 'raise' } as Record<PokerHand, RangeAction>;
    const { getByTestId } = await render(
      <ActionGrid handActions={handActions} activeAction="raise" onAssign={onAssign} />,
    );

    fireEvent.press(getByTestId('action-cell-AA'));
    expect(onAssign).toHaveBeenCalledWith('AA', null);
  });

  it('announces the assigned action (or unassigned) in each cell label', async () => {
    const handActions = { AA: 'raise' } as Record<PokerHand, RangeAction>;
    const { getByLabelText } = await render(
      <ActionGrid handActions={handActions} activeAction="raise" onAssign={jest.fn()} />,
    );

    expect(getByLabelText('AA: Raise')).toBeTruthy();
    expect(getByLabelText('KK: unassigned')).toBeTruthy();
  });
});
