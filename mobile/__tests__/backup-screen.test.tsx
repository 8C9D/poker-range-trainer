import { render, userEvent, waitFor } from '@testing-library/react-native';

import { buildBackup, parseBackup, restoreBackup, serializeBackup } from '@core/storage/backup';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import BackupScreen from '../app/backup';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@core/storage/backup', () => ({
  buildBackup: jest.fn(),
  serializeBackup: jest.fn(),
  parseBackup: jest.fn(),
  restoreBackup: jest.fn(),
}));

const mockWrite = writeAsStringAsync as jest.Mock;
const mockRead = readAsStringAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockPick = DocumentPicker.getDocumentAsync as jest.Mock;
const mockBuild = buildBackup as jest.Mock;
const mockSerialize = serializeBackup as jest.Mock;
const mockParse = parseBackup as jest.Mock;
const mockRestore = restoreBackup as jest.Mock;

describe('BackupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuild.mockReturnValue({ ranges: [] });
    mockSerialize.mockReturnValue('{"backup":true}');
  });

  it('exports the library to a file and shares it', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupScreen />);

    await user.press(getByTestId('backup-export'));

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith('file:///docs/poker-ranges-backup.json', '{"backup":true}');
      expect(mockShare).toHaveBeenCalledWith('file:///docs/poker-ranges-backup.json');
    });
  });

  it('imports a picked file and restores it', async () => {
    const backup = { ranges: [{ id: 'r1' }, { id: 'r2' }] };
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pick.json' }] });
    mockRead.mockResolvedValue('{"ranges":[]}');
    mockParse.mockReturnValue(backup);

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupScreen />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => {
      expect(mockRead).toHaveBeenCalledWith('file:///pick.json');
      expect(mockRestore).toHaveBeenCalledWith(backup);
      expect(getByTestId('backup-status')).toHaveTextContent(/Restored 2 ranges/);
    });
  });

  it('surfaces a parse error and does not restore', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///bad.json' }] });
    mockRead.mockResolvedValue('not json');
    mockParse.mockImplementation(() => {
      throw new Error('Backup file is not valid JSON.');
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<BackupScreen />);

    await user.press(getByTestId('backup-import'));

    await waitFor(() => expect(getByTestId('backup-error')).toBeTruthy());
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
