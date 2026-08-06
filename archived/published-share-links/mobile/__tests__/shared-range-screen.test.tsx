import { render, userEvent, waitFor } from '@testing-library/react-native';

import { getSharedRange } from '@core/cloud/sharedRangesRepo';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import SharedRangeScreen from '../app/r/[id]';
import { getMobileSupabaseClient } from '../platform/supabaseClient';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'abc' }),
}));
jest.mock('../platform/supabaseClient', () => ({ getMobileSupabaseClient: jest.fn() }));
jest.mock('../platform/createRangeId', () => ({ createRangeId: () => 'new-id' }));
jest.mock('@core/cloud/sharedRangesRepo', () => ({ getSharedRange: jest.fn() }));
jest.mock('@core/storage/rangeStorage', () => ({ saveSavedRange: jest.fn() }));

const mockGetClient = getMobileSupabaseClient as jest.Mock;
const mockGetShared = getSharedRange as jest.Mock;
const mockSave = saveSavedRange as jest.Mock;

const SHARED: SavedRange = {
  id: 'abc',
  name: 'UTG Open',
  hands: ['AA', 'KK'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SharedRangeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the not-configured message when there is no cloud client', async () => {
    mockGetClient.mockResolvedValue(null);

    const { getByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-not-configured')).toBeTruthy());
  });

  it('fetches a shared range and adds a copy to the library', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    mockGetShared.mockResolvedValue(SHARED);

    const user = userEvent.setup();
    const { getByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-range-name')).toHaveTextContent('UTG Open'));
    expect(mockGetShared).toHaveBeenCalledWith('abc', undefined, { client: { id: 'client' } });

    await user.press(getByTestId('shared-add'));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-id', name: 'UTG Open', hands: ['AA', 'KK'] }),
      ),
    );
  });

  it('reports an add the device store refused instead of confirming it', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    mockGetShared.mockResolvedValue(SHARED);
    mockSave.mockImplementation(() => {
      throw new Error('Could not save: storage is full or unavailable.');
    });

    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-range-name')).toBeTruthy());
    await user.press(getByTestId('shared-add'));

    await waitFor(() =>
      expect(getByTestId('shared-add-error')).toHaveTextContent(/storage is full or unavailable/),
    );
    expect(queryByTestId('shared-status')).toBeNull();
    // The button stays, so the viewer can free space and retry.
    expect(getByTestId('shared-add')).toBeTruthy();
  });

  it('shows not-found when the shared range is missing', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    mockGetShared.mockResolvedValue(null);

    const { getByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-not-found')).toBeTruthy());
  });

  it('rejects a shared range with non-canonical hands instead of crashing', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    // Publisher-controlled payload: an invalid hand would make the percentage math throw.
    mockGetShared.mockResolvedValue({ ...SHARED, hands: ['AA', 'XX'] });

    const { getByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-not-found')).toBeTruthy());
  });

  it.each([
    ['a name that is not a string', { name: { toString: 1 } }],
    ['no id', { id: '' }],
    ['an unparseable createdAt', { createdAt: 'whenever' }],
    // The screen's percentage math reads `comboSelections` straight off the
    // payload, so a number where a combo list belongs threw mid-render.
    ['an unreadable comboSelections entry', { comboSelections: { AA: 5 } }],
  ])('rejects a shared range with %s', async (_label, broken) => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    // Canonical hands are not enough — the rest of the payload is publisher-
    // controlled too, and the name is rendered straight into the screen.
    mockGetShared.mockResolvedValue({ ...SHARED, ...broken });

    const { getByTestId } = await render(<SharedRangeScreen />);

    await waitFor(() => expect(getByTestId('shared-not-found')).toBeTruthy());
  });
});
