import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import EditorScreen from '../app/editor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native module stubs + an expo-router mock that opens range "r1" (editing an existing
// range, unlike editor-screen.test.tsx which starts a new draft).
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));
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
    const { getByTestId } = await render(<EditorScreen />);

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
