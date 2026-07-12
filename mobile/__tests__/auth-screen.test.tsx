import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import { getCurrentSession, onAuthChange, signIn } from '@core/cloud/auth';
import { deleteBackup, pullBackup, pushBackup } from '@core/cloud/backupRepo';
import { buildBackup, restoreBackup } from '@core/storage/backup';

import { AuthPanel } from '../components/AuthPanel';
import { getMobileSupabaseClient } from '../platform/supabaseClient';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Link: ({ children }: { children: ReactNode }) => children,
}));
// Replace the client factory + cloud/storage modules so no real Supabase client/network is involved.
jest.mock('../platform/supabaseClient', () => ({ getMobileSupabaseClient: jest.fn() }));
jest.mock('@core/cloud/auth', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  getCurrentSession: jest.fn(),
  onAuthChange: jest.fn(),
}));
jest.mock('@core/cloud/backupRepo', () => ({
  pushBackup: jest.fn(),
  pullBackup: jest.fn(),
  deleteBackup: jest.fn(),
}));
jest.mock('@core/storage/backup', () => ({ buildBackup: jest.fn(), restoreBackup: jest.fn() }));

const mockGetClient = getMobileSupabaseClient as jest.Mock;
const mockSignIn = signIn as jest.Mock;
const mockGetSession = getCurrentSession as jest.Mock;
const mockOnAuthChange = onAuthChange as jest.Mock;
const mockPush = pushBackup as jest.Mock;
const mockPull = pullBackup as jest.Mock;
const mockDelete = deleteBackup as jest.Mock;
const mockBuild = buildBackup as jest.Mock;
const mockRestore = restoreBackup as jest.Mock;

describe('AuthPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthChange.mockResolvedValue(() => {});
    mockGetSession.mockResolvedValue(null);
    mockBuild.mockReturnValue({ ranges: [] });
    mockPush.mockResolvedValue(undefined);
    mockPull.mockResolvedValue(null);
  });

  it('shows the offline message and no form when cloud is unconfigured', async () => {
    mockGetClient.mockResolvedValue(null);

    const { getByTestId, queryByTestId } = await render(<AuthPanel />);

    await waitFor(() => expect(getByTestId('auth-offline')).toBeTruthy());
    expect(queryByTestId('auth-email')).toBeNull();
  });

  it('signs in with the entered credentials when configured', async () => {
    const fakeClient = { id: 'client' };
    mockGetClient.mockResolvedValue(fakeClient);
    mockSignIn.mockResolvedValue({ user: { email: 'you@example.com' } });

    const user = userEvent.setup();
    const { getByTestId } = await render(<AuthPanel />);

    // The signed-out form appears once the client resolves and there is no session.
    await waitFor(() => expect(getByTestId('auth-email')).toBeTruthy());

    await user.type(getByTestId('auth-email'), 'you@example.com');
    await user.type(getByTestId('auth-password'), 'secret123');
    await user.press(getByTestId('auth-signin'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('you@example.com', 'secret123', fakeClient),
    );
  });

  it('pushes and pulls the library when signed in', async () => {
    const fakeClient = { id: 'client' };
    mockGetClient.mockResolvedValue(fakeClient);
    mockGetSession.mockResolvedValue({ user: { email: 'you@example.com' } });
    const backup = { ranges: [{ id: 'r1' }, { id: 'r2' }] };
    mockBuild.mockReturnValue(backup);
    mockPull.mockResolvedValue(backup);

    // Pull confirms before overwriting local — auto-accept the destructive confirm.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<AuthPanel />);

    // The signed-in view (with sync controls) appears once a session is present.
    await waitFor(() => expect(getByTestId('sync-push')).toBeTruthy());

    await user.press(getByTestId('sync-push'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(backup, { client: fakeClient }));

    await user.press(getByTestId('sync-pull'));
    await waitFor(() => {
      expect(mockPull).toHaveBeenCalledWith({ client: fakeClient });
      expect(mockRestore).toHaveBeenCalledWith(backup);
    });

    alertSpy.mockRestore();
  });

  it('deletes cloud data after confirming', async () => {
    const fakeClient = { id: 'client' };
    mockGetClient.mockResolvedValue(fakeClient);
    mockGetSession.mockResolvedValue({ user: { email: 'you@example.com' } });
    mockDelete.mockResolvedValue(undefined);
    // Auto-accept the destructive confirm (like editor-screen.test.tsx).
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<AuthPanel />);
    await waitFor(() => expect(getByTestId('sync-delete')).toBeTruthy());

    await user.press(getByTestId('sync-delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ client: fakeClient }));

    alertSpy.mockRestore();
  });
});
