import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { RangeEditor } from '../components/RangeEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native module stubs + an expo-router mock that opens range "r1" (editing an existing
// range, unlike editor-screen.test.tsx which starts a new draft).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

describe('EditorScreen overlay preservation', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('prunes notes for deselected hands but restores them on re-select in the session', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      handNotes: { AA: 'premium', KK: 'careful vs 3-bets' },
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor id="r1" />);

    // Deselecting KK drops its now-orphaned note but keeps AA's.
    await user.press(getByTestId('hand-cell-KK'));
    await waitFor(() => {
      const saved = findSavedRangeById('r1');
      expect(saved?.hands).toEqual(['AA']);
      expect(saved?.handNotes).toEqual({ AA: 'premium' });
    });

    // Re-selecting KK in the same session restores the note instead of losing it.
    await user.press(getByTestId('hand-cell-KK'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.handNotes).toEqual({
        AA: 'premium',
        KK: 'careful vs 3-bets',
      });
    });
  });

  it('prunes a deselected hand’s mixed strategy but restores it on re-select', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA', 'KK'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mixedStrategies: {
        AA: [{ action: 'raise', frequency: 100 }],
        KK: [{ action: 'call', frequency: 100 }],
      },
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor id="r1" />);

    // Otherwise the frequency quiz keeps drilling KK, which the Frequencies editor
    // can no longer reach because it lists only the range's hands.
    await user.press(getByTestId('hand-cell-KK'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies).toEqual({
        AA: [{ action: 'raise', frequency: 100 }],
      });
    });

    await user.press(getByTestId('hand-cell-KK'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.mixedStrategies).toEqual({
        AA: [{ action: 'raise', frequency: 100 }],
        KK: [{ action: 'call', frequency: 100 }],
      });
    });
  });

  it('keeps favorite and handActions when the binary grid is edited', async () => {
    // A range with overlay fields the binary editor does not edit.
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      favorite: true,
      handActions: { AA: 'raise' },
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor id="r1" />);

    // Toggle a hand in the binary grid → live-save fires.
    await user.press(getByTestId('hand-cell-KK'));

    await waitFor(() => {
      const saved = findSavedRangeById('r1');
      expect(saved?.hands).toContain('KK');
      // Overlay fields survive the edit instead of being stripped.
      expect(saved?.favorite).toBe(true);
      expect(saved?.handActions?.AA).toBe('raise');
    });
  });
});
