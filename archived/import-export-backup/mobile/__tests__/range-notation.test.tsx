import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import { formatRangeNotation, parseRangeNotation } from '@core/domain/rangeNotation';

import { RangeNotation } from '../components/RangeNotation';

// Native clipboard module: in-memory stub (hoisted above imports by jest).
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('77+')),
}));

describe('RangeNotation', () => {
  beforeEach(() => {
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    (Clipboard.getStringAsync as jest.Mock).mockClear();
  });

  it('mirrors the current selection as notation', async () => {
    const { getByTestId } = await render(
      <RangeNotation selectedHands={['AA', 'KK']} onReplaceHands={() => {}} />,
    );

    expect(getByTestId('notation-current')).toHaveTextContent(formatRangeNotation(['AA', 'KK']));
  });

  it('copies the current notation to the clipboard', async () => {
    const { getByTestId } = await render(
      <RangeNotation selectedHands={['AA', 'KK']} onReplaceHands={() => {}} />,
    );

    fireEvent.press(getByTestId('notation-copy'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(formatRangeNotation(['AA', 'KK']));
  });

  it('applies valid notation by replacing the selection', async () => {
    const onReplaceHands = jest.fn();
    const { getByTestId } = await render(
      <RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />,
    );

    fireEvent.changeText(getByTestId('notation-input'), '77+');
    // Wait for the controlled input to commit before applying (RNTL v14 async).
    await waitFor(() => expect(getByTestId('notation-input').props.value).toBe('77+'));
    fireEvent.press(getByTestId('notation-apply'));

    await waitFor(() =>
      expect(onReplaceHands).toHaveBeenCalledWith(parseRangeNotation('77+')),
    );
  });

  it('shows an error and keeps the selection on invalid notation', async () => {
    const onReplaceHands = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />,
    );

    fireEvent.changeText(getByTestId('notation-input'), 'zzz');
    await waitFor(() => expect(getByTestId('notation-input').props.value).toBe('zzz'));
    fireEvent.press(getByTestId('notation-apply'));

    await waitFor(() => expect(queryByTestId('notation-error')).not.toBeNull());
    expect(onReplaceHands).not.toHaveBeenCalled();
  });
});
