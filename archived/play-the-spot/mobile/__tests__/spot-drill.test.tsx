import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { RangeMetadata, SavedRange } from '@core/types/range';

import { SpotDrill } from '../components/practice/SpotDrill';

jest.mock('expo-haptics');

function makeRange(name: string, metadata: RangeMetadata): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata,
  };
}

const btnOpen = makeRange('BTN open', { position: 'btn', actionType: 'open' });
const vsBbThreeBet = makeRange('BTN vs BB 3-bet', {
  position: 'btn',
  actionType: 'fourBet',
  versusPosition: 'bb',
});
const bbDefend = makeRange('BB defend vs CO', {
  position: 'bb',
  actionType: 'defend',
  versusPosition: 'co',
});

async function renderDrill(props: Partial<Parameters<typeof SpotDrill>[0]> = {}) {
  const onFinish = jest.fn();
  const view = await render(
    <SpotDrill
      ranges={[btnOpen]}
      tableSize="sixMax"
      stackDepthBb={100}
      questionCount={2}
      onFinish={onFinish}
      random={() => 0}
      {...props}
    />,
  );
  return { ...view, onFinish };
}

describe('SpotDrill', () => {
  it('states the dealt spot and labels the answers with the range’s action', async () => {
    const { getByTestId } = await renderDrill();

    expect(getByTestId('spot-scenario')).toHaveTextContent(
      '6-max, 100bb. Folded to you on the BTN.',
    );
    expect(getByTestId('answer-yes')).toHaveTextContent('Open');
    expect(getByTestId('answer-no')).toHaveTextContent('Fold');
  });

  it('speaks the dealt spot and names each card face', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { getByTestId } = await renderDrill();

    // Nothing moves focus when a drill advances, so the deal has to say itself
    // or VoiceOver goes silent after the first answer.
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith('6-max, 100bb. Folded to you on the BTN. AA'),
    );
    // Suits are glyphs the reader skips, so each face carries its own label.
    expect(getByTestId('card-As').props.accessibilityLabel).toBe('A of spades');
    announce.mockRestore();
  });

  it('explains the empty state when the library covers no spot at this format', async () => {
    const { getByTestId, queryByTestId } = await renderDrill({ ranges: [] });

    expect(getByTestId('spot-drill-empty')).toBeTruthy();
    expect(queryByTestId('answer-yes')).toBeNull();
  });

  it('names the grading range in the feedback after an answer', async () => {
    const { getByTestId, findByTestId } = await renderDrill();

    fireEvent.press(getByTestId('answer-yes'));

    expect(await findByTestId('drill-feedback')).toHaveTextContent('Correct — open AA.');
    expect(getByTestId('drill-why')).toHaveTextContent('That spot is your “BTN open”.');
  });

  it('hands back the note the grading chart carries for a missed hand', async () => {
    const { getByTestId, findByTestId } = await renderDrill({
      ranges: [{ ...btnOpen, handNotes: { AA: 'Always open — even into a 3-bettor.' } }],
    });

    // The first draw is AA, which this chart opens, so folding it is a miss.
    fireEvent.press(getByTestId('answer-no'));

    expect(await findByTestId('drill-note')).toHaveTextContent(
      'Your note: Always open — even into a 3-bettor.',
    );
  });

  it('groups the finished attempts by the range that graded them', async () => {
    // The first draw picks the first covered spot; every later draw picks the last,
    // so the two questions are graded by different ranges.
    let first = true;
    const { getByTestId, findByTestId, onFinish } = await renderDrill({
      ranges: [btnOpen, bbDefend],
      random: () => {
        if (first) {
          first = false;
          return 0;
        }
        return 0.99;
      },
    });

    // Both hands are drawn from the far end of the grid, so both "play" answers
    // are misses and each holds its explanation until Next.
    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('drill-next'));
    await waitFor(
      () => expect(getByTestId('spot-scenario')).toHaveTextContent(/facing an open from the CO/),
      { timeout: 3000 },
    );
    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-next');
    fireEvent.press(getByTestId('drill-next'));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const { byRange, bySpot } = onFinish.mock.calls[0][0];
    expect(Object.keys(byRange).sort()).toEqual(['BB defend vs CO', 'BTN open']);
    expect(bySpot.map((stat: { spotKey: string }) => stat.spotKey)).toEqual([
      'sixMax|btn|foldedToYou|-|100',
      'sixMax|bb|facingOpen|co|100',
    ]);
  });

  it('reports the attempts answered so far when closed early', async () => {
    const { getByTestId, findByTestId, onFinish } = await renderDrill();

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('overlay-close'));

    // The reason matters as much as the attempts: a host cannot tell a close
    // from a completed run by counting them.
    expect(onFinish).toHaveBeenCalledWith(
      {
        byRange: { 'BTN open': [expect.objectContaining({ hand: 'AA' })] },
        bySpot: [{ spotKey: 'sixMax|btn|foldedToYou|-|100', attempts: 1, correct: 1 }],
      },
      'closed',
    );
  });

  it('records nothing when closed before answering', async () => {
    const { getByTestId, onFinish } = await renderDrill();

    fireEvent.press(getByTestId('overlay-close'));

    expect(onFinish).toHaveBeenCalledWith({ byRange: {}, bySpot: [] }, 'closed');
  });
});

describe('SpotDrill chained spots', () => {
  it('carries a correctly played hand into the covered follow-up spot', async () => {
    const { getByTestId, findByTestId } = await renderDrill({
      ranges: [btnOpen, vsBbThreeBet],
      random: () => 0,
    });

    fireEvent.press(getByTestId('answer-yes'));
    await findByTestId('drill-feedback');

    expect(await findByTestId('spot-chain')).toBeTruthy();
    expect(getByTestId('spot-scenario')).toHaveTextContent(/facing a 3-bet from the BB/);
    expect(getByTestId('drill-hand')).toHaveTextContent('AA');
  });

  it('ends the hand on a fold and deals a fresh spot', async () => {
    const { getByTestId, findByTestId, queryByTestId } = await renderDrill({
      ranges: [btnOpen, vsBbThreeBet],
      random: () => 0,
    });

    // Folding AA is a miss, so the explanation holds until the user continues.
    fireEvent.press(getByTestId('answer-no'));
    await findByTestId('drill-feedback');
    fireEvent.press(getByTestId('drill-next'));
    await waitFor(() => expect(queryByTestId('drill-feedback')).toBeNull(), { timeout: 3000 });

    expect(queryByTestId('spot-chain')).toBeNull();
  });
});
