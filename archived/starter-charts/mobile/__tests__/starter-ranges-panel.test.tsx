import { render, userEvent, waitFor } from '@testing-library/react-native';

import { STARTER_RANGE_TEMPLATES } from '@core/domain/starterRanges';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';

import { StarterRangesPanel } from '../components/StarterRangesPanel';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');

describe('StarterRangesPanel', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('adds the pack alongside the ranges already saved', async () => {
    saveSavedRange({
      id: 'mine',
      name: 'My own chart',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const { getByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('add-starter-ranges'));

    await waitFor(() =>
      expect(getByTestId('starter-status')).toHaveTextContent(
        `Added ${STARTER_RANGE_TEMPLATES.length} starter charts.`,
      ),
    );
    const names = loadSavedRanges().map((range) => range.name);
    expect(names).toHaveLength(STARTER_RANGE_TEMPLATES.length + 1);
    expect(names[0]).toBe('My own chart');
  });

  it('adds nothing a second time instead of duplicating the pack', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<StarterRangesPanel />);

    await user.press(getByTestId('add-starter-ranges'));
    await waitFor(() => expect(getByTestId('starter-status')).toHaveTextContent(/Added/));
    await user.press(getByTestId('add-starter-ranges'));

    await waitFor(() =>
      expect(getByTestId('starter-status')).toHaveTextContent(/already in your library/),
    );
    expect(loadSavedRanges()).toHaveLength(STARTER_RANGE_TEMPLATES.length);
  });
});
