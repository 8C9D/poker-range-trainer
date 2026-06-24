import { fireEvent, render } from '@testing-library/react-native';

import { HandGrid } from '../components/HandGrid';

// RNTL v14's render is async (React 19); queries populate only after the await.
describe('HandGrid', () => {
  it('renders all 169 starting hands from the core matrix', async () => {
    const { getAllByTestId, getByTestId } = await render(
      <HandGrid selected={new Set()} onToggleHand={() => {}} />,
    );

    expect(getAllByTestId(/^hand-cell-/)).toHaveLength(169);
    // Spot-check the known matrix corners.
    expect(getByTestId('hand-cell-AA')).toBeTruthy();
    expect(getByTestId('hand-cell-AKs')).toBeTruthy();
    expect(getByTestId('hand-cell-AKo')).toBeTruthy();
    expect(getByTestId('hand-cell-22')).toBeTruthy();
  });

  it('calls onToggleHand with the pressed hand', async () => {
    const onToggleHand = jest.fn();
    const { getByTestId } = await render(
      <HandGrid selected={new Set()} onToggleHand={onToggleHand} />,
    );

    fireEvent.press(getByTestId('hand-cell-AA'));

    expect(onToggleHand).toHaveBeenCalledTimes(1);
    expect(onToggleHand).toHaveBeenCalledWith('AA');
  });

  it('reflects selected state via accessibility', async () => {
    const { getByTestId } = await render(
      <HandGrid selected={new Set(['AA'])} onToggleHand={() => {}} />,
    );

    expect(getByTestId('hand-cell-AA').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('hand-cell-KK').props.accessibilityState.selected).toBe(false);
  });

  it('does not fire when disabled', async () => {
    const onToggleHand = jest.fn();
    const { getByTestId } = await render(
      <HandGrid selected={new Set()} onToggleHand={onToggleHand} disabled />,
    );

    fireEvent.press(getByTestId('hand-cell-AA'));

    expect(onToggleHand).not.toHaveBeenCalled();
  });
});
