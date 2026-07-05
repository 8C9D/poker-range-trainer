import { fireEvent, render } from '@testing-library/react-native';

import { isValidMixedStrategy, type HandMixedStrategy } from '@core/domain/mixedStrategy';

import { MixedStrategyEditor } from '../components/MixedStrategyEditor';
import { stepMixedFrequency } from '../components/mixedStrategyStep';

describe('stepMixedFrequency', () => {
  it('adds an action at one step up from zero', () => {
    expect(stepMixedFrequency([], 'raise', 1)).toEqual([{ action: 'raise', frequency: 5 }]);
  });

  it('decreases an existing frequency', () => {
    const start: HandMixedStrategy = [{ action: 'raise', frequency: 100 }];
    expect(stepMixedFrequency(start, 'raise', -1)).toEqual([{ action: 'raise', frequency: 95 }]);
  });

  it('clamps at zero and drops the action', () => {
    expect(stepMixedFrequency([], 'raise', -1)).toEqual([]);
  });

  it('reaches a valid 100% total', () => {
    const start: HandMixedStrategy = [{ action: 'raise', frequency: 95 }];
    const next = stepMixedFrequency(start, 'raise', 1);
    expect(isValidMixedStrategy(next)).toBe(true);
  });

  it('keeps other actions when stepping one', () => {
    const start: HandMixedStrategy = [{ action: 'raise', frequency: 50 }];
    const next = stepMixedFrequency(start, 'call', 1);
    expect(next).toEqual([
      { action: 'call', frequency: 5 },
      { action: 'raise', frequency: 50 },
    ]);
  });
});

describe('MixedStrategyEditor', () => {
  it('fires onChange with the stepped-up action', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <MixedStrategyEditor strategy={[]} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('mixed-inc-raise'));
    expect(onChange).toHaveBeenCalledWith([{ action: 'raise', frequency: 5 }]);
  });

  it('shows the running total and validity', async () => {
    const { getByTestId } = await render(
      <MixedStrategyEditor strategy={[{ action: 'raise', frequency: 100 }]} onChange={jest.fn()} />,
    );

    const totalText = getByTestId('mixed-total').props.children.join('');
    expect(totalText).toContain('100%');
    expect(totalText).toContain('✓');
  });
});
