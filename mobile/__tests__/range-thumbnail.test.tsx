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
