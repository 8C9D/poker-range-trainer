import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import NotesEditorScreen from '../app/notes-editor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

function seedRange(handNotes?: Record<PokerHand, string>): void {
  saveSavedRange({
    id: 'r1',
    name: 'UTG Open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    handActions: { AA: 'call' },
    ...(handNotes ? { handNotes } : {}),
  });
}

describe('NotesEditorScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('live-saves a per-hand note and preserves other overlays', async () => {
    seedRange();
    const { getByTestId } = await render(<NotesEditorScreen />);

    // The first hand (AA) is active by default.
    await act(async () => {
      fireEvent.changeText(getByTestId('note-input'), 'open-raise from UTG');
    });

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.handNotes?.AA).toBe('open-raise from UTG');
    });
    // The action overlay survives the notes save.
    expect(findSavedRangeById('r1')?.handActions?.AA).toBe('call');
  });

  it('removes a note when it is cleared', async () => {
    seedRange({ AA: 'a note' });
    const { getByTestId } = await render(<NotesEditorScreen />);

    expect(getByTestId('note-input').props.value).toBe('a note');

    await act(async () => {
      fireEvent.changeText(getByTestId('note-input'), '');
    });

    await waitFor(() => {
      expect(findSavedRangeById('r1')?.handNotes?.AA).toBeUndefined();
    });
  });
});
