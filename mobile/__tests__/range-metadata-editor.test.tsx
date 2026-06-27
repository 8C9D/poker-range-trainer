import { fireEvent, render } from '@testing-library/react-native';

import { RangeMetadataEditor } from '../components/RangeMetadataEditor';

describe('RangeMetadataEditor', () => {
  it('sets a field when a chip is tapped', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeMetadataEditor value={{}} onChange={onChange} />);

    fireEvent.press(getByTestId('meta-position-btn'));

    expect(onChange).toHaveBeenCalledWith({ position: 'btn' });
  });

  it('clears a field when its selected chip is tapped again', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <RangeMetadataEditor value={{ position: 'btn' }} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('meta-position-btn'));

    // Cleared -> position dropped (toEqual ignores the undefined key).
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('captures a positive stack depth as a number', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeMetadataEditor value={{}} onChange={onChange} />);

    fireEvent.changeText(getByTestId('meta-stack'), '100');

    expect(onChange).toHaveBeenCalledWith({ stackDepthBb: 100 });
  });

  it('captures notes text', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeMetadataEditor value={{}} onChange={onChange} />);

    fireEvent.changeText(getByTestId('meta-notes'), 'vs UTG open');

    expect(onChange).toHaveBeenCalledWith({ notes: 'vs UTG open' });
  });
});
