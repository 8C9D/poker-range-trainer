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

  it('fills the scenario from the range name in one tap', async () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = await render(
      <RangeMetadataEditor value={{}} onChange={onChange} name="SB 3-bet vs BTN open (6-max 100bb)" />,
    );

    expect(getByText('SB · 3-bet · vs BTN · 6-max · 100bb')).toBeTruthy();
    fireEvent.press(getByTestId('use-scenario-from-name'));

    expect(onChange).toHaveBeenCalledWith({
      position: 'sb',
      actionType: 'threeBet',
      versusPosition: 'btn',
      tableSize: 'sixMax',
      stackDepthBb: 100,
    });
  });

  it('offers only what the fields do not already say', async () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = await render(
      <RangeMetadataEditor value={{ position: 'co' }} onChange={onChange} name="SB 3-bet vs BTN" />,
    );

    // The recorded seat wins over the name's, so only the rest is offered.
    expect(getByText('3-bet · vs BTN')).toBeTruthy();
    fireEvent.press(getByTestId('use-scenario-from-name'));

    expect(onChange).toHaveBeenCalledWith({
      position: 'co',
      actionType: 'threeBet',
      versusPosition: 'btn',
    });
  });

  it('offers no scenario for a name that describes none', async () => {
    const { queryByTestId } = await render(
      <RangeMetadataEditor value={{}} onChange={jest.fn()} name="My favourite chart" />,
    );

    expect(queryByTestId('use-scenario-from-name')).toBeNull();
  });

  it('offers nothing when no name is supplied', async () => {
    const { queryByTestId } = await render(
      <RangeMetadataEditor value={{}} onChange={jest.fn()} />,
    );

    expect(queryByTestId('use-scenario-from-name')).toBeNull();
  });
});
