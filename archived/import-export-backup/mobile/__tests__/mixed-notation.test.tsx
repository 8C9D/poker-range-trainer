import { act, fireEvent, render } from '@testing-library/react-native';

import type { HandMixedStrategy } from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';

import { MixedNotation } from '../components/MixedNotation';

// Clipboard is stubbed (copy/paste are not exercised here).
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

const AA_MIX: Record<PokerHand, HandMixedStrategy> = {
  AA: [
    { action: 'raise', frequency: 60 },
    { action: 'call', frequency: 40 },
  ],
};

describe('MixedNotation', () => {
  it('shows the current strategies as notation and applies valid input', async () => {
    const onReplaceStrategies = jest.fn();
    const { getByTestId } = await render(
      <MixedNotation mixedStrategies={AA_MIX} onReplaceStrategies={onReplaceStrategies} />,
    );

    expect(getByTestId('mixed-notation-current')).toHaveTextContent('AA: call 40, raise 60');

    // Wrap each interaction so the controlled input commits before Apply reads it.
    await act(async () => {
      fireEvent.changeText(getByTestId('mixed-notation-input'), 'KK: raise 100');
    });
    await act(async () => {
      fireEvent.press(getByTestId('mixed-notation-apply'));
    });

    expect(onReplaceStrategies).toHaveBeenCalledWith({
      KK: [{ action: 'raise', frequency: 100 }],
    });
  });

  it('surfaces a parse error and does not replace the map', async () => {
    const onReplaceStrategies = jest.fn();
    const { getByTestId } = await render(
      <MixedNotation mixedStrategies={AA_MIX} onReplaceStrategies={onReplaceStrategies} />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId('mixed-notation-input'), 'Nonsense without a colon');
    });
    await act(async () => {
      fireEvent.press(getByTestId('mixed-notation-apply'));
    });

    expect(getByTestId('mixed-notation-error')).toBeTruthy();
    expect(onReplaceStrategies).not.toHaveBeenCalled();
    expect(getByTestId('mixed-notation-current')).toHaveTextContent('AA: call 40, raise 60');
  });
});
