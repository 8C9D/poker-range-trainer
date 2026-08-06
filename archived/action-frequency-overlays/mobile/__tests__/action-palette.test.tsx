import { fireEvent, render } from '@testing-library/react-native';

import { RANGE_ACTIONS } from '@core/types/range';

import { ActionPalette } from '../components/ActionPalette';

describe('ActionPalette', () => {
  it('renders a chip for every action and reports the tapped one', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(<ActionPalette active="raise" onSelect={onSelect} />);

    for (const action of RANGE_ACTIONS) {
      expect(getByTestId(`action-chip-${action}`)).toBeTruthy();
    }

    fireEvent.press(getByTestId('action-chip-call'));
    expect(onSelect).toHaveBeenCalledWith('call');
  });
});
