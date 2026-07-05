import { render, userEvent, waitFor } from '@testing-library/react-native';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import FrequencyEditorScreen from '../app/frequency-editor';
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
    const { getByTestId } = await render(<FrequencyEditorScreen />);

    await user.press(getByTestId('mixed-inc-raise'));

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies?.AA).toEqual([
        { action: 'raise', frequency: 5 },
      ]);
    });
  });

  it('preserves other overlays (handActions) when saving frequencies', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<FrequencyEditorScreen />);

    await user.press(getByTestId('mixed-inc-raise'));

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies?.AA).toBeDefined();
    });
    const saved = findSavedRangeById('r1');
    expect(saved?.handActions?.AA).toBe('call');
    expect(saved?.hands).toEqual(['AA', 'KK']);
  });
});
