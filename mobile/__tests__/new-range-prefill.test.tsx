import { render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { loadSavedRanges } from '@core/storage/rangeStorage';

import { RangeEditor } from '../components/RangeEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

// The v8.1 coverage map opens the editor with a missing spot's metadata attached.
describe('RangeEditor scenario pre-fill', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('starts a new draft from the supplied scenario metadata and saves it', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(
      <RangeEditor
        prefill={{
          position: 'bb',
          actionType: 'defend',
          versusPosition: 'co',
          tableSize: 'sixMax',
          stackDepthBb: 40,
        }}
      />,
    );

    expect(getByTestId('meta-position-bb').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('meta-action-defend').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('meta-versus-co').props.accessibilityState.selected).toBe(true);

    // A live save carries the pre-filled metadata through untouched.
    await user.type(getByTestId('range-name-input'), 'BB defend vs CO');

    await waitFor(() => expect(loadSavedRanges()).toHaveLength(1));
    expect(loadSavedRanges()[0].metadata).toMatchObject({
      position: 'bb',
      actionType: 'defend',
      versusPosition: 'co',
      tableSize: 'sixMax',
      stackDepthBb: 40,
    });
  });

  it('leaves the scenario blank without a pre-fill', async () => {
    const { getByTestId } = await render(<RangeEditor />);

    expect(getByTestId('meta-position-bb').props.accessibilityState.selected).toBe(false);
  });
});
