import { render, userEvent } from '@testing-library/react-native';

import BoardScreen from '../app/board';

// The board explorer reads no storage; only expo-router's Stack.Screen needs stubbing.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

describe('BoardScreen', () => {
  it('tags a two-tone ace-high flop once three cards are entered', async () => {
    // userEvent (async) awaits each tap, so the six sequential picks don't overlap act().
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BoardScreen />);

    // No texture is shown before a full flop.
    expect(queryByTestId('board-texture')).toBeNull();

    // Enter As, Kd, 7s (rank then suit fills the active slot and advances).
    await user.press(getByTestId('rank-A'));
    await user.press(getByTestId('suit-s'));
    await user.press(getByTestId('rank-K'));
    await user.press(getByTestId('suit-d'));
    await user.press(getByTestId('rank-7'));
    await user.press(getByTestId('suit-s'));

    // As Kd 7s: ace present, two spades (flush draw → wet), distinct unconnected ranks.
    expect(getByTestId('board-texture')).toBeTruthy();
    expect(getByTestId('texture-tag-aceHigh')).toBeTruthy();
    expect(getByTestId('texture-tag-twoTone')).toBeTruthy();
    expect(getByTestId('texture-tag-wet')).toBeTruthy();
    expect(queryByTestId('texture-tag-rainbow')).toBeNull();
    expect(queryByTestId('texture-tag-paired')).toBeNull();
    expect(queryByTestId('texture-tag-monotone')).toBeNull();
  });

  it('flags a duplicate card instead of a texture', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BoardScreen />);

    // As, As, Kd — the repeated As is a duplicate.
    await user.press(getByTestId('rank-A'));
    await user.press(getByTestId('suit-s'));
    await user.press(getByTestId('rank-A'));
    await user.press(getByTestId('suit-s'));
    await user.press(getByTestId('rank-K'));
    await user.press(getByTestId('suit-d'));

    expect(getByTestId('board-error')).toBeTruthy();
    expect(queryByTestId('board-texture')).toBeNull();
  });
});
