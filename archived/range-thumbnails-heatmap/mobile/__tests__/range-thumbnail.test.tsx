import { render } from '@testing-library/react-native';

import { RangeThumbnail } from '../components/RangeThumbnail';

describe('RangeThumbnail', () => {
  it('draws one cell per valid in-range hand', async () => {
    const { getByTestId } = await render(<RangeThumbnail hands={['AA', 'KK', 'AKs']} />);

    const thumb = getByTestId('range-thumbnail');
    expect(thumb.children).toHaveLength(3);
  });

  it('ignores hands that are not on the 13x13 grid', async () => {
    const { getByTestId } = await render(<RangeThumbnail hands={['AA', 'not-a-hand']} />);

    const thumb = getByTestId('range-thumbnail');
    expect(thumb.children).toHaveLength(1);
  });
});

describe('RangeThumbnail accessibility', () => {
  it('is skipped by VoiceOver when it is only a thumbnail beside a name', async () => {
    const { getByTestId } = await render(<RangeThumbnail hands={['AA']} />);

    expect(getByTestId('range-thumbnail').props.accessibilityLabel).toBeUndefined();
  });

  it('becomes a named image when given a label', async () => {
    // Where the chart is the content, leaving it unlabelled gives a screen
    // reader no way to learn which hands the range plays.
    const { getByTestId } = await render(
      <RangeThumbnail hands={['AA', 'KK']} label="Range chart: AA, KK" />,
    );

    const thumb = getByTestId('range-thumbnail');
    expect(thumb.props.accessibilityRole).toBe('image');
    expect(thumb.props.accessibilityLabel).toBe('Range chart: AA, KK');
  });
});
