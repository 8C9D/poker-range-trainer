import { fireEvent, render } from '@testing-library/react-native';

import { ComboSelector } from '../components/ComboSelector';

describe('ComboSelector', () => {
  it('renders one toggle per concrete combo (AKs → 4) with a count', async () => {
    const { getByTestId, getByText } = await render(
      <ComboSelector hand="AKs" selection={new Set<string>()} onToggle={jest.fn()} />,
    );

    expect(getByTestId('combo-cell-AsKs')).toBeTruthy();
    expect(getByTestId('combo-cell-AhKh')).toBeTruthy();
    expect(getByTestId('combo-cell-AdKd')).toBeTruthy();
    expect(getByTestId('combo-cell-AcKc')).toBeTruthy();
    expect(getByText('0/4 combos')).toBeTruthy();
  });

  it('fires onToggle with the pressed combo', async () => {
    const onToggle = jest.fn();
    const { getByTestId } = await render(
      <ComboSelector hand="AKs" selection={new Set<string>()} onToggle={onToggle} />,
    );

    fireEvent.press(getByTestId('combo-cell-AsKs'));
    expect(onToggle).toHaveBeenCalledWith([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 's' },
    ]);
  });

  it('marks a combo in the selection as selected and counts only this hand', async () => {
    const { getByTestId, getByText } = await render(
      <ComboSelector hand="AKs" selection={new Set(['AsKs'])} onToggle={jest.fn()} />,
    );

    expect(getByTestId('combo-cell-AsKs').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('combo-cell-AhKh').props.accessibilityState.selected).toBe(false);
    expect(getByText('1/4 combos')).toBeTruthy();
  });
});
