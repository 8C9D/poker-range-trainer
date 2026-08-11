import { Alert } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import {
  MAX_BACKUP_BYTES,
  buildBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '@core/storage/backup';
import * as DocumentPicker from 'expo-document-picker';
import { getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { BackupPanel } from '../components/BackupPanel';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 1024 })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// The four functions that touch storage are stubbed; the size bound is kept
// real, so the guard below tests the shipped limit rather than a copy of it.
jest.mock('@core/storage/backup', () => ({
  ...jest.requireActual('@core/storage/backup'),
  buildBackup: jest.fn(),
  serializeBackup: jest.fn(),
  parseBackup: jest.fn(),
  restoreBackup: jest.fn(),
}));

const mockWrite = writeAsStringAsync as jest.Mock;
const mockRead = readAsStringAsync as jest.Mock;
const mockInfo = getInfoAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockPick = DocumentPicker.getDocumentAsync as jest.Mock;
const mockBuild = buildBackup as jest.Mock;
const mockSerialize = serializeBackup as jest.Mock;
const mockParse = parseBackup as jest.Mock;
const mockRestore = restoreBackup as jest.Mock;

describe('BackupPanel', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockBuild.mockReturnValue({ ranges: [] });
    mockSerialize.mockReturnValue('{"backup":true}');
    mockInfo.mockResolvedValue({ exists: true, size: 1024 });
  });

  /** Press the Alert's destructive button, as a user confirming would. */
  function confirmAlert(): void {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  }

  /** Press Cancel, as a user backing out would. */
  function cancelAlert(): void {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'cancel')?.onPress?.();
    });
  }

  it('exports the library to a file and shares it', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-export'));

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith('file:///docs/poker-ranges-backup.json', '{"backup":true}');
      expect(mockShare).toHaveBeenCalledWith('file:///docs/poker-ranges-backup.json');
    });
  });

  it('imports a picked file and restores it once the replacement is confirmed', async () => {
    const backup = { ranges: [{ id: 'r1' }, { id: 'r2' }] };
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pick.json' }] });
    mockRead.mockResolvedValue('{"ranges":[]}');
    mockParse.mockReturnValue(backup);
    confirmAlert();

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => {
      expect(mockRead).toHaveBeenCalledWith('file:///pick.json');
      expect(mockRestore).toHaveBeenCalledWith(backup);
      expect(getByTestId('backup-status')).toHaveTextContent(/Restored 2 ranges/);
    });
  });

  /**
   * A restore replaces the library outright, and a merely STALE backup — one
   * `validateBackup` is perfectly happy with — takes every session recorded
   * since it was written. The web path asks first; this is the same gate.
   */
  it('keeps the local library when the replacement is not confirmed', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pick.json' }] });
    mockRead.mockResolvedValue('{"ranges":[]}');
    mockParse.mockReturnValue({ ranges: [] });
    cancelAlert();

    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    expect(queryByTestId('backup-status')).toBeNull();
  });

  it('warns that a restore replaces everything, in the words the web path uses', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pick.json' }] });
    cancelAlert();

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        'Importing a backup REPLACES all your current local data. Continue?',
        expect.arrayContaining([expect.objectContaining({ style: 'destructive' })]),
      ),
    );
  });

  /**
   * Size is the one property `validateBackup` cannot check, because the file is
   * already wholly in memory by the time it runs. So the refusal has to happen
   * before the read, and before the user is asked anything.
   */
  it('refuses an over-large file before reading it into memory', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///huge.json' }] });
    mockInfo.mockResolvedValue({ exists: true, size: MAX_BACKUP_BYTES + 1 });
    confirmAlert();

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => expect(getByTestId('backup-error')).toHaveTextContent(/too large/));
    expect(mockRead).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it('surfaces a parse error and does not restore', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///bad.json' }] });
    mockRead.mockResolvedValue('not json');
    mockParse.mockImplementation(() => {
      throw new Error('Backup file is not valid JSON.');
    });
    confirmAlert();

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupPanel />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => expect(getByTestId('backup-error')).toBeTruthy());
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
