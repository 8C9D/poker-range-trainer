import { render, userEvent, waitFor } from '@testing-library/react-native';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { FrequenciesEditor } from '../components/FrequenciesEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

function seedRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'UTG Open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    handActions: { AA: 'call' },
  });
}

describe('FrequencyEditorScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    seedRange();
  });

  it('live-saves a hand mixed strategy onto the range', async () => {
    const user = userEvent.setup();
    // The first range hand (AA) is active by default, so its MixedStrategyEditor is shown.
    const { getByTestId } = await render(<FrequenciesEditor id="r1" />);

    await user.press(getByTestId('mixed-inc-raise'));

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies?.AA).toEqual([
        { action: 'raise', frequency: 5 },
      ]);
    });
  });

  it('names a hand whose frequencies do not total 100 and jumps to it', async () => {
    const user = userEvent.setup();
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mixedStrategies: {
        AA: [{ action: 'raise', frequency: 100 }],
        KK: [{ action: 'raise', frequency: 60 }],
      },
    });
    const { getByTestId, queryByTestId } = await render(<FrequenciesEditor id="r1" />);

    // Only one hand's total is on screen at a time, so the whole-range line is
    // the only place a mix left at 60% shows up.
    expect(getByTestId('freq-incomplete')).toHaveTextContent(/1 hand not at 100%: KK/);

    await user.press(getByTestId('freq-incomplete'));
    // Eight +5 presses take KK's fold leg from 0 to 40, so the mix reaches 100.
    for (let i = 0; i < 8; i++) await user.press(getByTestId('mixed-inc-fold'));

    await waitFor(() => expect(queryByTestId('freq-incomplete')).toBeNull());
  });

  it('preserves other overlays (handActions) when saving frequencies', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<FrequenciesEditor id="r1" />);

    await user.press(getByTestId('mixed-inc-raise'));

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies?.AA).toBeDefined();
    });
    const saved = findSavedRangeById('r1');
    expect(saved?.handActions?.AA).toBe('call');
    expect(saved?.hands).toEqual(['AA', 'KK']);
  });
});
