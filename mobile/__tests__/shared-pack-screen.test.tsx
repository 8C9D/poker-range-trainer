import { render, userEvent, waitFor } from '@testing-library/react-native';

import { getSharedPack } from '@core/cloud/sharedPacksRepo';
import type { RangePack } from '@core/domain/rangeTransfer';
import { saveSavedRange } from '@core/storage/rangeStorage';

import SharedPackScreen from '../app/p/[id]';
import { getMobileSupabaseClient } from '../platform/supabaseClient';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'pack1' }),
}));
jest.mock('../platform/supabaseClient', () => ({ getMobileSupabaseClient: jest.fn() }));
jest.mock('../platform/createRangeId', () => ({ createRangeId: jest.fn(() => 'new-id') }));
jest.mock('@core/cloud/sharedPacksRepo', () => ({ getSharedPack: jest.fn() }));
jest.mock('@core/storage/rangeStorage', () => ({ saveSavedRange: jest.fn() }));

const mockGetClient = getMobileSupabaseClient as jest.Mock;
const mockGetPack = getSharedPack as jest.Mock;
const mockSave = saveSavedRange as jest.Mock;

const PACK: RangePack = {
  kind: 'poker-range-pack',
  version: 1,
  name: 'Opening Ranges',
  ranges: [
    {
      id: 'a',
      name: 'UTG',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'b',
      name: 'BTN',
      hands: ['KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('SharedPackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the not-configured message when there is no cloud client', async () => {
    mockGetClient.mockResolvedValue(null);

    const { getByTestId } = await render(<SharedPackScreen />);

    await waitFor(() => expect(getByTestId('shared-not-configured')).toBeTruthy());
  });

  it('fetches a shared pack and adds all of its ranges', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    mockGetPack.mockResolvedValue(PACK);

    const user = userEvent.setup();
    const { getByTestId } = await render(<SharedPackScreen />);

    await waitFor(() => expect(getByTestId('shared-pack-name')).toHaveTextContent('Opening Ranges'));
    expect(mockGetPack).toHaveBeenCalledWith('pack1', undefined, { client: { id: 'client' } });

    await user.press(getByTestId('shared-add-all'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', name: 'UTG' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', name: 'BTN' }));
  });

  it('shows not-found when the shared pack is missing', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    mockGetPack.mockResolvedValue(null);

    const { getByTestId } = await render(<SharedPackScreen />);

    await waitFor(() => expect(getByTestId('shared-not-found')).toBeTruthy());
  });

  it('rejects a pack containing a range with non-canonical hands', async () => {
    mockGetClient.mockResolvedValue({ id: 'client' });
    // Publisher-controlled payload: adding an invalid hand to the library would throw.
    mockGetPack.mockResolvedValue({
      ...PACK,
      ranges: [PACK.ranges[0], { ...PACK.ranges[1], hands: ['KK', 'XX'] }],
    });

    const { getByTestId } = await render(<SharedPackScreen />);

    await waitFor(() => expect(getByTestId('shared-not-found')).toBeTruthy());
  });
});
