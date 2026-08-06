import { render, userEvent, waitFor } from '@testing-library/react-native';

import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  formatRangeCsv,
  serializeRangeExport,
  serializeRangePack,
} from '@core/domain/rangeTransfer';
import { loadSavedRanges, saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { RangeFilesPanel } from '../components/RangeFilesPanel';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Only device I/O is stubbed; the envelope building/parsing and storage are the real
// @core code, so these tests exercise the actual round trip.
jest.mock('react-native-mmkv');
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

let mockNextId = 0;
jest.mock('../platform/createRangeId', () => ({ createRangeId: () => `new-${mockNextId++}` }));

const mockWrite = writeAsStringAsync as jest.Mock;
const mockRead = readAsStringAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockPick = DocumentPicker.getDocumentAsync as jest.Mock;

function makeRange(id: string, name: string): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function pickFile(contents: string, name = 'pick.json'): void {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: `file:///${name}`, name }] });
  mockRead.mockResolvedValue(contents);
}

describe('RangeFilesPanel', () => {
  beforeAll(() => installLocalStorage());
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageShim.clear();
    mockNextId = 0;
  });

  it('writes the library to a pack file and shares it', async () => {
    saveSavedRange(makeRange('r1', 'UTG Open'));
    saveSavedRange(makeRange('r2', 'BTN Defend'));

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('pack-export'));

    await waitFor(() => expect(mockShare).toHaveBeenCalledWith('file:///docs/poker-range-pack.json'));
    const [uri, written] = mockWrite.mock.calls[0];
    expect(uri).toBe('file:///docs/poker-range-pack.json');
    expect(JSON.parse(written).ranges.map((r: SavedRange) => r.name)).toEqual([
      'UTG Open',
      'BTN Defend',
    ]);
    expect(getByTestId('range-files-status')).toHaveTextContent(/Exported 2 ranges/);
  });

  it('says there is nothing to export for an empty library', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('pack-export'));

    await waitFor(() => expect(getByTestId('range-files-status')).toHaveTextContent(/No ranges/));
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('adds a picked pack to the library without replacing what is there', async () => {
    saveSavedRange(makeRange('mine', 'My range'));
    pickFile(serializeRangePack('', [makeRange('a', 'Pack A'), makeRange('b', 'Pack B')]));

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('pack-import'));

    await waitFor(() => expect(getByTestId('range-files-status')).toHaveTextContent(/Added 2 ranges/));
    const names = loadSavedRanges().map((range) => range.name);
    expect(names).toEqual(['My range', 'Pack A', 'Pack B']);
    // Fresh ids, so an import never clobbers an existing range.
    expect(loadSavedRanges().map((range) => range.id)).toEqual(['mine', 'new-0', 'new-1']);
  });

  it('adds a picked single-range file', async () => {
    pickFile(serializeRangeExport(makeRange('shared', 'Shared range')));

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('range-import'));

    await waitFor(() =>
      expect(getByTestId('range-files-status')).toHaveTextContent(/Shared range/),
    );
    expect(loadSavedRanges()).toHaveLength(1);
    expect(loadSavedRanges()[0].id).toBe('new-0');
  });

  it('imports a CSV file, naming the range after the file when the CSV has no name', async () => {
    pickFile(formatRangeCsv({ ...makeRange('x', ''), hands: ['AA', 'AKs'] }), 'button-opens.csv');

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('csv-import'));

    await waitFor(() => expect(getByTestId('range-files-status')).toHaveTextContent(/button-opens/));
    expect(loadSavedRanges()[0].hands).toEqual(['AA', 'AKs']);
  });

  it('surfaces a parse error and imports nothing', async () => {
    pickFile('not json at all');

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('pack-import'));

    await waitFor(() => expect(getByTestId('range-files-error')).toBeTruthy());
    expect(loadSavedRanges()).toHaveLength(0);
  });

  it('imports a pack in one write, so a filling store cannot split it', async () => {
    saveSavedRange(makeRange('mine', 'My range'));
    pickFile(serializeRangePack('', [makeRange('a', 'Pack A'), makeRange('b', 'Pack B')]));

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeFilesPanel />);
    // A store with room for exactly one more write. Saving range by range put
    // Pack A in and then lost Pack B; the whole pack is one write, so it lands.
    const real = localStorageShim.setItem.bind(localStorageShim);
    let writes = 0;
    const spy = jest.spyOn(localStorageShim, 'setItem').mockImplementation((key, value) => {
      if (++writes > 1) throw new Error('quota');
      real(key, value);
    });
    await user.press(getByTestId('pack-import'));
    await waitFor(() => expect(getByTestId('range-files-status')).toHaveTextContent(/Added 2/));
    spy.mockRestore();

    expect(loadSavedRanges().map((range) => range.name)).toEqual([
      'My range',
      'Pack A',
      'Pack B',
    ]);
  });

  it('does nothing when the picker is cancelled', async () => {
    mockPick.mockResolvedValue({ canceled: true });

    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<RangeFilesPanel />);

    await user.press(getByTestId('pack-import'));

    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(queryByTestId('range-files-error')).toBeNull();
    expect(loadSavedRanges()).toHaveLength(0);
  });
});
