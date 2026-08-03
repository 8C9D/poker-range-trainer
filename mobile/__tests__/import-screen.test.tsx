import { render, userEvent, waitFor } from '@testing-library/react-native';

import { encodeRangeToHash } from '@core/domain/rangeTransfer';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import ImportScreen from '../app/import';

const params: { range?: string } = {};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => params,
}));
jest.mock('../platform/createRangeId', () => ({ createRangeId: () => 'new-id' }));
jest.mock('@core/storage/rangeStorage', () => ({ saveSavedRange: jest.fn() }));

const mockSave = saveSavedRange as jest.Mock;

const RANGE: SavedRange = {
  id: 'abc',
  name: 'UTG Open',
  hands: ['AA', 'KK'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ImportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete params.range;
  });

  it('previews the range carried by a deep link and adds a copy to the library', async () => {
    params.range = encodeRangeToHash(RANGE);

    const user = userEvent.setup();
    const { getByTestId } = await render(<ImportScreen />);

    expect(getByTestId('import-range-name')).toHaveTextContent('UTG Open');

    await user.press(getByTestId('import-add'));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-id', name: 'UTG Open', hands: ['AA', 'KK'] }),
      ),
    );
    expect(getByTestId('import-status')).toHaveTextContent('Added "UTG Open" to your library.');
  });

  it('reports an add the device store refused instead of confirming it', async () => {
    params.range = encodeRangeToHash(RANGE);
    mockSave.mockImplementation(() => {
      throw new Error('Could not save: storage is full or unavailable.');
    });

    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<ImportScreen />);

    await user.press(getByTestId('import-add'));

    await waitFor(() =>
      expect(getByTestId('import-save-error')).toHaveTextContent(/storage is full or unavailable/),
    );
    // Without this the button did nothing and said nothing, and the range was
    // simply not in the library later.
    expect(queryByTestId('import-status')).toBeNull();
  });

  it('imports a pasted web share link', async () => {
    const link = `https://example.com/app/#range=${encodeRangeToHash(RANGE)}`;

    const user = userEvent.setup();
    const { getByTestId } = await render(<ImportScreen />);

    await user.type(getByTestId('import-input'), link);
    await user.press(getByTestId('import-decode'));

    await waitFor(() => expect(getByTestId('import-range-name')).toHaveTextContent('UTG Open'));
  });

  it('reports a link that carries no range payload', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<ImportScreen />);

    await user.type(getByTestId('import-input'), 'https://example.com/nothing-here');
    await user.press(getByTestId('import-decode'));

    await waitFor(() =>
      expect(getByTestId('import-error')).toHaveTextContent(/does not look like a share link/),
    );
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('rejects a payload whose hands are not canonical instead of crashing', async () => {
    params.range = encodeRangeToHash({ ...RANGE, hands: ['AA', 'XX'] as SavedRange['hands'] });

    const { getByTestId, queryByTestId } = await render(<ImportScreen />);

    await waitFor(() => expect(getByTestId('import-error')).toBeTruthy());
    expect(queryByTestId('import-preview')).toBeNull();
  });
});
