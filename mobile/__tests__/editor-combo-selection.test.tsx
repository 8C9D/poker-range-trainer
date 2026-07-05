import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import EditorScreen from '../app/editor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native module stubs + an expo-router mock that opens range "r1" for editing.
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

function seedRange() {
  saveSavedRange({
    id: 'r1',
    name: 'Test',
    hands: ['AKs', 'AA'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('EditorScreen combo selection', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    seedRange();
  });

  it('persists a refined hand\'s remaining combos on save', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<EditorScreen />);

    // Open AKs's combo editor and deselect the AhKh combo.
    await user.press(getByTestId('refine-hand-AKs'));
    await user.press(getByTestId('combo-cell-AhKh'));

    await waitFor(() => {
      const saved = findSavedRangeById('r1');
      const aks = saved?.comboSelections?.AKs;
      expect(aks).toBeDefined();
      expect(aks).toHaveLength(3);
      expect(aks).toEqual(expect.arrayContaining(['AsKs', 'AdKd', 'AcKc']));
      expect(aks).not.toContain('AhKh');
    });
  });

  it('writes no entry for a fully-selected hand', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<EditorScreen />);

    // Refine AKs so a save fires; AA is never touched and stays all-on.
    await user.press(getByTestId('refine-hand-AKs'));
    await user.press(getByTestId('combo-cell-AhKh'));

    await waitFor(() => {
      const saved = findSavedRangeById('r1');
      expect(saved?.comboSelections?.AKs).toBeDefined();
      expect(saved?.comboSelections?.AA).toBeUndefined();
    });
  });

  it('drops a hand\'s refinement when it leaves the range', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<EditorScreen />);

    await user.press(getByTestId('refine-hand-AKs'));
    await user.press(getByTestId('combo-cell-AhKh'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.comboSelections?.AKs).toBeDefined();
    });

    // Remove AKs from the binary grid; its refinement must not persist.
    await user.press(getByTestId('hand-cell-AKs'));
    await waitFor(() => {
      const saved = findSavedRangeById('r1');
      expect(saved?.hands).not.toContain('AKs');
      expect(saved?.comboSelections?.AKs).toBeUndefined();
    });
  });
});
