import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ComboExplorer } from '../components/ComboExplorer';
import { light } from '../theme/colors';

/**
 * The blocked combos are the whole point of typing dead cards, so they have to stay
 * readable and have to be announced. They were previously drawn at `opacity: 0.3`,
 * which composited the card text to about 1.9:1 and told VoiceOver nothing.
 */
describe('ComboExplorer', () => {
  it('lists the concrete combos for the typed hand class', async () => {
    const { getByTestId, getByText } = await render(<ComboExplorer />);

    expect(getByText('4 combos')).toBeTruthy();
    expect(getByTestId('combo-cell-AsKs')).toBeTruthy();
    expect(getByTestId('combo-cell-AcKc')).toBeTruthy();
  });

  it('counts the survivors once dead cards are typed', async () => {
    const { getByTestId, getByText } = await render(<ComboExplorer />);

    // Wrap the interaction so the controlled input commits before the grid is read.
    await act(async () => {
      fireEvent.changeText(getByTestId('combo-dead-input'), 'As');
    });

    expect(getByText('3 of 4 combos')).toBeTruthy();
  });

  it('announces a blocked combo as blocked and leaves the survivors bare', async () => {
    const { getByTestId } = await render(<ComboExplorer />);

    // Wrap the interaction so the controlled input commits before the grid is read.
    await act(async () => {
      fireEvent.changeText(getByTestId('combo-dead-input'), 'As');
    });

    expect(getByTestId('combo-cell-AsKs').props.accessibilityLabel).toBe('AsKs, blocked');
    expect(getByTestId('combo-cell-AhKh').props.accessibilityLabel).toBe('AhKh');
  });

  it('mutes a blocked combo without dimming it out of sight', async () => {
    const { getByTestId, getByText } = await render(<ComboExplorer />);

    // Wrap the interaction so the controlled input commits before the grid is read.
    await act(async () => {
      fireEvent.changeText(getByTestId('combo-dead-input'), 'As');
    });

    const cell = StyleSheet.flatten(getByTestId('combo-cell-AsKs').props.style);
    expect(cell.opacity).toBeUndefined();
    expect(cell.backgroundColor).toBe(light.well);

    // The struck-through label states "blocked" without relying on colour alone.
    const cardStyle = StyleSheet.flatten(getByText('A♠').props.style);
    expect(cardStyle.color).toBe(light.ink2);
    expect(cardStyle.textDecorationLine).toBe('line-through');
  });
});
