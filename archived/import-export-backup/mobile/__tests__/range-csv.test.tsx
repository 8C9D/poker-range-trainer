import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RangeCsv } from '../components/RangeCsv';

// Native clipboard module: in-memory stub (hoisted above imports by jest).
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

describe('RangeCsv', () => {
  it('renders the current range as CSV', async () => {
    const { getByTestId } = await render(
      <RangeCsv name="UTG Open" hands={['AA', 'KK']} onImport={() => {}} />,
    );

    // The component renders the @core-formatted CSV: the summary block + the hand column.
    const current = getByTestId('range-csv-current');
    expect(current).toHaveTextContent(/name,UTG Open/);
    expect(current).toHaveTextContent(/hand/);
    expect(current).toHaveTextContent(/AA/);
    expect(current).toHaveTextContent(/KK/);
  });

  it('applies a valid CSV by importing its hands (and name)', async () => {
    const onImport = jest.fn();
    const { getByTestId } = await render(
      <RangeCsv name="" hands={[]} onImport={onImport} />,
    );

    fireEvent.changeText(getByTestId('range-csv-input'), 'name,Imported\nhand\nQQ\nJJ');
    await waitFor(() =>
      expect(getByTestId('range-csv-input').props.value).toBe('name,Imported\nhand\nQQ\nJJ'),
    );
    fireEvent.press(getByTestId('range-csv-apply'));

    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith({ name: 'Imported', hands: ['QQ', 'JJ'] }),
    );
  });

  it('shows an error and does not import on malformed CSV', async () => {
    const onImport = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <RangeCsv name="" hands={[]} onImport={onImport} />,
    );

    fireEvent.changeText(getByTestId('range-csv-input'), 'no hand column here');
    await waitFor(() =>
      expect(getByTestId('range-csv-input').props.value).toBe('no hand column here'),
    );
    fireEvent.press(getByTestId('range-csv-apply'));

    await waitFor(() => expect(queryByTestId('range-csv-error')).not.toBeNull());
    expect(onImport).not.toHaveBeenCalled();
  });
});
