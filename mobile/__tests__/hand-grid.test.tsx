import { fireEvent, render } from '@testing-library/react-native';

import { HandGrid, handAtPoint } from '../components/HandGrid';

// Pure mapping used by drag-paint — reliably testable without simulating gestures.
// Grid is 13×13; with side 130 each cell is 10px.
describe('handAtPoint', () => {
  it('maps the grid corners and center to the right hands', () => {
    expect(handAtPoint(5, 5, 130)).toBe('AA'); // top-left = pair
    expect(handAtPoint(125, 5, 130)).toBe('A2s'); // top-right = suited
    expect(handAtPoint(5, 125, 130)).toBe('A2o'); // bottom-left = offsuit
    expect(handAtPoint(125, 125, 130)).toBe('22'); // bottom-right = pair
    expect(handAtPoint(65, 65, 130)).toBe('88'); // center = pair
  });

  it('returns null outside the grid or with no measured size', () => {
    expect(handAtPoint(-1, 5, 130)).toBeNull();
    expect(handAtPoint(5, -1, 130)).toBeNull();
    expect(handAtPoint(130, 5, 130)).toBeNull(); // x == side -> col 13
    expect(handAtPoint(5, 130, 130)).toBeNull();
    expect(handAtPoint(5, 5, 0)).toBeNull();
  });
});

// RNTL v14's render is async (React 19); queries populate only after the await.
describe('HandGrid', () => {
  it('renders all 169 starting hands from the core matrix', async () => {
    const { getAllByTestId, getByTestId } = await render(
      <HandGrid selected={new Set()} onSetSelected={() => {}} />,
    );

    expect(getAllByTestId(/^hand-cell-/)).toHaveLength(169);
    expect(getByTestId('hand-cell-AA')).toBeTruthy();
    expect(getByTestId('hand-cell-AKs')).toBeTruthy();
    expect(getByTestId('hand-cell-AKo')).toBeTruthy();
    expect(getByTestId('hand-cell-22')).toBeTruthy();
  });

  it('taps an unselected hand to select it', async () => {
    const onSetSelected = jest.fn();
    const { getByTestId } = await render(
      <HandGrid selected={new Set()} onSetSelected={onSetSelected} />,
    );

    fireEvent.press(getByTestId('hand-cell-AA'));

    expect(onSetSelected).toHaveBeenCalledTimes(1);
    expect(onSetSelected).toHaveBeenCalledWith('AA', true);
  });

  it('taps a selected hand to deselect it', async () => {
    const onSetSelected = jest.fn();
    const { getByTestId } = await render(
      <HandGrid selected={new Set(['AA'])} onSetSelected={onSetSelected} />,
    );

    fireEvent.press(getByTestId('hand-cell-AA'));

    expect(onSetSelected).toHaveBeenCalledWith('AA', false);
  });

  it('reflects selected state via accessibility', async () => {
    const { getByTestId } = await render(
      <HandGrid selected={new Set(['AA'])} onSetSelected={() => {}} />,
    );

    expect(getByTestId('hand-cell-AA').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('hand-cell-KK').props.accessibilityState.selected).toBe(false);
  });

  it('does not fire when disabled', async () => {
    const onSetSelected = jest.fn();
    const { getByTestId } = await render(
      <HandGrid selected={new Set()} onSetSelected={onSetSelected} disabled />,
    );

    fireEvent.press(getByTestId('hand-cell-AA'));

    expect(onSetSelected).not.toHaveBeenCalled();
  });
});
