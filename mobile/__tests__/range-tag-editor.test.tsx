import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { RangeEditor } from '../components/RangeEditor';
import { RangeTagEditor } from '../components/RangeTagEditor';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// Native module stubs for the RangeEditor integration test.
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

/** Type into the tag input and wait for the controlled value to commit (RNTL v14 async). */
async function typeTag(getByTestId: (id: string) => any, text: string) {
  fireEvent.changeText(getByTestId('tag-input'), text);
  await waitFor(() => expect(getByTestId('tag-input').props.value).toBe(text));
}

describe('RangeTagEditor', () => {
  it('adds a trimmed tag via the Add button', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeTagEditor tags={['MTT']} onChange={onChange} />);

    await typeTag(getByTestId, '  Cash ');
    fireEvent.press(getByTestId('add-tag'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['MTT', 'Cash']));
  });

  it('adds a tag on submit', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeTagEditor tags={[]} onChange={onChange} />);

    await typeTag(getByTestId, 'MTT');
    fireEvent(getByTestId('tag-input'), 'submitEditing');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['MTT']));
  });

  it('does not add a case-insensitive duplicate', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(<RangeTagEditor tags={['MTT']} onChange={onChange} />);

    await typeTag(getByTestId, 'mtt');
    fireEvent.press(getByTestId('add-tag'));

    // The draft clears (the add ran) but no change is reported.
    await waitFor(() => expect(getByTestId('tag-input').props.value).toBe(''));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a tag via its remove control', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <RangeTagEditor tags={['MTT', 'Cash']} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('remove-tag-MTT'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['Cash']));
  });
});

describe('RangeEditor tags', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('live-saves an added tag and keeps stored tags on unrelated edits', async () => {
    saveSavedRange({
      id: 'r1',
      name: 'UTG Open',
      hands: ['AA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      tags: ['MTT'],
    });

    const user = userEvent.setup();
    const { getByTestId } = await render(<RangeEditor id="r1" />);

    // An unrelated grid edit keeps the stored tag.
    await user.press(getByTestId('hand-cell-KK'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.tags).toEqual(['MTT']);
    });

    await typeTag(getByTestId, 'Cash');
    fireEvent.press(getByTestId('add-tag'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.tags).toEqual(['MTT', 'Cash']);
    });

    // Removing the last tags drops the field entirely.
    fireEvent.press(getByTestId('remove-tag-MTT'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.tags).toEqual(['Cash']);
    });
    fireEvent.press(getByTestId('remove-tag-Cash'));
    await waitFor(() => {
      expect(findSavedRangeById('r1')?.tags).toBeUndefined();
    });
  });
});
