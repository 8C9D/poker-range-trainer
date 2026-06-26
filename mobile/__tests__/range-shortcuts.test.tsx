import { fireEvent, render } from '@testing-library/react-native';

import { selectAllPairs, selectSuitedBroadways } from '@core/domain/rangeShortcuts';

import { RangeShortcuts } from '../components/RangeShortcuts';

describe('RangeShortcuts', () => {
  it('adds all pairs when the pairs shortcut is pressed', async () => {
    const onAddHands = jest.fn();
    const { getByTestId } = await render(<RangeShortcuts onAddHands={onAddHands} />);

    fireEvent.press(getByTestId('shortcut-all-pairs'));

    expect(onAddHands).toHaveBeenCalledWith(selectAllPairs());
  });

  it('adds suited broadways when that shortcut is pressed', async () => {
    const onAddHands = jest.fn();
    const { getByTestId } = await render(<RangeShortcuts onAddHands={onAddHands} />);

    fireEvent.press(getByTestId('shortcut-suited-broadways'));

    expect(onAddHands).toHaveBeenCalledWith(selectSuitedBroadways());
  });
});
