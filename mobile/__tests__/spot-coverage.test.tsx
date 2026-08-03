import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RangeMetadata, SavedRange } from '@core/types/range';

import { SpotCoverage } from '../components/SpotCoverage';

// Links render their child; this asserts the coverage map's own behavior, not routing.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

function makeRange(name: string, metadata: RangeMetadata): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
  };
}

describe('SpotCoverage', () => {
  it('summarizes an uncovered library', async () => {
    const { getByTestId } = await render(<SpotCoverage ranges={[]} />);

    expect(getByTestId('coverage-summary')).toHaveTextContent(
      '0 of 65 standard spots covered · 0%',
    );
  });

  it('counts a covering range in its seat and situation cell', async () => {
    const ranges = [makeRange('BTN open', { position: 'btn', actionType: 'open' })];
    const { getByTestId } = await render(<SpotCoverage ranges={ranges} />);

    expect(getByTestId('coverage-btn-foldedToYou')).toHaveTextContent('1/1');
    expect(getByTestId('coverage-summary')).toHaveTextContent(/^1 of 65/);
  });

  it('lists the covering range when a cell is opened, and closes on a second tap', async () => {
    const ranges = [makeRange('BTN open', { position: 'btn', actionType: 'open' })];
    const { getByTestId, queryByTestId, findByText, getByText } = await render(
      <SpotCoverage ranges={ranges} />,
    );

    await fireEvent.press(getByTestId('coverage-btn-foldedToYou'));
    expect(await findByText('6-max, 100bb. Folded to you on the BTN.')).toBeTruthy();
    expect(getByText('BTN open')).toBeTruthy();

    await fireEvent.press(getByTestId('coverage-btn-foldedToYou'));
    await waitFor(() => expect(queryByTestId('coverage-detail')).toBeNull());
  });

  it('offers a create action for every uncovered spot in a cell', async () => {
    const { getByTestId, findAllByText } = await render(<SpotCoverage ranges={[]} />);

    await fireEvent.press(getByTestId('coverage-bb-facingOpen'));

    expect(await findAllByText('Create')).toHaveLength(5);
    expect(getByTestId('coverage-create-sixMax|bb|facingOpen|utg|100')).toBeTruthy();
  });

  it('offers to play the covered spots and hides the button when none are', async () => {
    const ranges = [makeRange('BTN open', { position: 'btn', actionType: 'open' })];
    const { queryByTestId, rerender } = await render(<SpotCoverage ranges={ranges} />);

    expect(queryByTestId('play-spots')).toBeTruthy();

    await rerender(<SpotCoverage ranges={[]} />);
    expect(queryByTestId('play-spots')).toBeNull();
  });

  it('opens on the format the library is mostly written for', async () => {
    const ranges = [makeRange('hu', { position: 'btn', tableSize: 'headsUp', stackDepthBb: 20 })];
    const { getByTestId, queryByTestId } = await render(<SpotCoverage ranges={ranges} />);

    // Heads-up has only the button and the big blind.
    expect(queryByTestId('coverage-co-foldedToYou')).toBeNull();
    expect(getByTestId('coverage-btn-foldedToYou')).toBeTruthy();
    expect(getByTestId('coverage-summary')).toHaveTextContent(/of 5 standard spots/);
  });

  it('redraws the map for another table size', async () => {
    const { getByTestId, queryByTestId } = await render(<SpotCoverage ranges={[]} />);

    await fireEvent.press(getByTestId('coverage-table-headsUp'));

    await waitFor(() => expect(queryByTestId('coverage-co-foldedToYou')).toBeNull());
    expect(getByTestId('coverage-summary')).toHaveTextContent(/^0 of 5 /);
  });

  it('keeps a format selected when its control is tapped again', async () => {
    const { getByTestId } = await render(<SpotCoverage ranges={[]} />);

    await fireEvent.press(getByTestId('coverage-stack-20'));
    await fireEvent.press(getByTestId('coverage-stack-20'));

    await waitFor(() => expect(getByTestId('coverage-btn-foldedToYou')).toBeTruthy());
    expect(getByTestId('coverage-summary')).toHaveTextContent(/^0 of 65/);
  });
});
