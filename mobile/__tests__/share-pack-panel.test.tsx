import { render, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { saveSavedRange } from '@core/storage/rangeStorage';
import { publishSharedPack, unpublishSharedPack } from '@core/cloud/sharedPacksRepo';

import { SharePackPanel } from '../components/SharePackPanel';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// The session mock is a mutable module-scoped value so a single test can flip to signed-out.
let mockSessionState: { client: unknown; session: unknown } = {
  client: {},
  session: { user: { id: 'u1' } },
};

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, opts?: { queryParams?: Record<string, string> }) => {
    const token = opts?.queryParams?.token;
    return `pokerrangetrainer://${path}${token ? `?token=${token}` : ''}`;
  },
}));
jest.mock('../lib/useMobileSession', () => ({
  useMobileSession: () => mockSessionState,
}));
jest.mock('@core/cloud/sharedPacksRepo', () => ({
  publishSharedPack: jest.fn(),
  unpublishSharedPack: jest.fn(),
}));

const publishMock = publishSharedPack as jest.MockedFunction<typeof publishSharedPack>;
const unpublishMock = unpublishSharedPack as jest.MockedFunction<typeof unpublishSharedPack>;

function pressAlertButton(text: string): jest.SpyInstance {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

describe('SharePackPanel', () => {
  beforeAll(() => installLocalStorage());
  beforeEach(() => {
    localStorageShim.clear();
    jest.clearAllMocks();
    mockSessionState = { client: {}, session: { user: { id: 'u1' } } };
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('publishes the library as a public pack link and copies it', async () => {
    publishMock.mockResolvedValue({ id: 'pack1', isPublic: true, token: null });
    const alertSpy = pressAlertButton('Public');

    const user = userEvent.setup();
    const { getByTestId, findByText } = await render(<SharePackPanel />);
    await user.press(getByTestId('pack-publish'));

    expect(await findByText('Pack link copied to clipboard.')).toBeTruthy();
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ ranges: expect.arrayContaining([expect.objectContaining({ id: 'r1' })]) }),
      true,
      expect.objectContaining({ client: expect.anything() }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pokerrangetrainer:///p/pack1');
    alertSpy.mockRestore();
  });

  it('copies a token link for a private pack, then unpublishes it', async () => {
    publishMock.mockResolvedValue({ id: 'pack2', isPublic: false, token: 'secret' });
    unpublishMock.mockResolvedValue(undefined);
    const alertSpy = pressAlertButton('Private');

    const user = userEvent.setup();
    const { getByTestId, findByText } = await render(<SharePackPanel />);
    await user.press(getByTestId('pack-publish'));

    expect(await findByText('Pack link copied to clipboard.')).toBeTruthy();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pokerrangetrainer:///p/pack2?token=secret');

    await user.press(getByTestId('pack-unpublish'));
    expect(await findByText('Pack link unpublished.')).toBeTruthy();
    expect(unpublishMock).toHaveBeenCalledWith('pack2', expect.anything());
    alertSpy.mockRestore();
  });

  it('reports when there are no ranges to publish', async () => {
    localStorageShim.clear();
    publishMock.mockResolvedValue({ id: 'packX', isPublic: true, token: null });
    const alertSpy = pressAlertButton('Public');

    const user = userEvent.setup();
    const { getByTestId, findByText } = await render(<SharePackPanel />);
    await user.press(getByTestId('pack-publish'));

    expect(await findByText('No ranges to publish yet.')).toBeTruthy();
    expect(publishMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('renders nothing when signed out', async () => {
    mockSessionState = { client: null, session: null };
    const { queryByTestId } = await render(<SharePackPanel />);
    expect(queryByTestId('pack-publish')).toBeNull();
  });
});
