import { render, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { saveSavedRange } from '@core/storage/rangeStorage';
import { publishSharedRange, unpublishSharedRange } from '@core/cloud/sharedRangesRepo';

import RangeScreen from '../app/range/[id]';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// A signed-in session + fake client so the publish/unpublish menu items render; the cloud repo is
// mocked so no network runs, and expo-linking/clipboard are stubbed to assert the built share link.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  useFocusEffect: () => {},
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, opts?: { queryParams?: Record<string, string> }) => {
    const token = opts?.queryParams?.token;
    return `pokerrangetrainer://${path}${token ? `?token=${token}` : ''}`;
  },
}));
jest.mock('../lib/useMobileSession', () => ({
  useMobileSession: () => ({ client: {}, session: { user: { id: 'u1' } } }),
}));
jest.mock('@core/cloud/sharedRangesRepo', () => ({
  publishSharedRange: jest.fn(),
  unpublishSharedRange: jest.fn(),
}));

const publishMock = publishSharedRange as jest.MockedFunction<typeof publishSharedRange>;
const unpublishMock = unpublishSharedRange as jest.MockedFunction<typeof unpublishSharedRange>;

function pressAlertButton(text: string): jest.SpyInstance {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

describe('RangeScreen sharing', () => {
  beforeAll(() => installLocalStorage());
  beforeEach(() => {
    localStorageShim.clear();
    jest.clearAllMocks();
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('publishes a public share link and copies it to the clipboard', async () => {
    publishMock.mockResolvedValue({ id: 'share1', isPublic: true, token: null });
    const alertSpy = pressAlertButton('Public');

    const user = userEvent.setup();
    const { getByTestId, findByTestId, findByText } = await render(<RangeScreen />);
    await user.press(getByTestId('range-menu-button'));
    await user.press(await findByTestId('menu-publish'));

    // Wait for the terminal status so every async state update settles inside act.
    expect(await findByText('Share link copied to clipboard.')).toBeTruthy();
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1' }),
      true,
      expect.objectContaining({ client: expect.anything() }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pokerrangetrainer:///r/share1');
    alertSpy.mockRestore();
  });

  it('copies a token link for a private share, then unpublishes it', async () => {
    publishMock.mockResolvedValue({ id: 'share2', isPublic: false, token: 'secret' });
    unpublishMock.mockResolvedValue(undefined);
    const alertSpy = pressAlertButton('Private');

    const user = userEvent.setup();
    const { getByTestId, findByTestId, findByText } = await render(<RangeScreen />);
    await user.press(getByTestId('range-menu-button'));
    await user.press(await findByTestId('menu-publish'));

    expect(await findByText('Share link copied to clipboard.')).toBeTruthy();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'pokerrangetrainer:///r/share2?token=secret',
    );

    // Re-open the menu — Unpublish now appears because a link is published.
    await user.press(getByTestId('range-menu-button'));
    await user.press(await findByTestId('menu-unpublish'));

    expect(await findByText('Shared link unpublished.')).toBeTruthy();
    expect(unpublishMock).toHaveBeenCalledWith('share2', expect.anything());
    alertSpy.mockRestore();
  });
});
