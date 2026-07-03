import { act, fireEvent, render } from '@testing-library/react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import type { RangeAction } from '@core/types/range';

import { ActionNotation } from '../components/ActionNotation';

// Clipboard is stubbed (copy/paste are not exercised here).
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

const RAISE_AA = { AA: 'raise' } as Record<PokerHand, RangeAction>;

describe('ActionNotation', () => {
  it('shows the current overlay as notation and applies valid input', async () => {
    const onReplaceActions = jest.fn();
    const { getByTestId } = await render(
      <ActionNotation handActions={RAISE_AA} onReplaceActions={onReplaceActions} />,
    );

    // Current overlay renders as action-grouped notation.
    expect(getByTestId('action-notation-current')).toHaveTextContent('Raise: AA');

    // Wrap each interaction so the controlled input commits before Apply reads it.
    await act(async () => {
      fireEvent.changeText(getByTestId('action-notation-input'), 'Call: 22\nRaise: AA');
    });
    await act(async () => {
      fireEvent.press(getByTestId('action-notation-apply'));
    });

    expect(onReplaceActions).toHaveBeenCalledWith({ '22': 'call', AA: 'raise' });
  });

  it('surfaces a parse error and does not replace the overlay', async () => {
    const onReplaceActions = jest.fn();
    const { getByTestId } = await render(
      <ActionNotation handActions={RAISE_AA} onReplaceActions={onReplaceActions} />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId('action-notation-input'), 'Nonsense without a colon');
    });
    await act(async () => {
      fireEvent.press(getByTestId('action-notation-apply'));
    });

    expect(getByTestId('action-notation-error')).toBeTruthy();
    expect(onReplaceActions).not.toHaveBeenCalled();
    // The current overlay text is unchanged.
    expect(getByTestId('action-notation-current')).toHaveTextContent('Raise: AA');
  });
});
