import { render, userEvent, waitFor } from '@testing-library/react-native';

import { saveSavedRange } from '@core/storage/rangeStorage';

import { BuildDrill } from '../components/practice/BuildDrill';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

// In-memory MMKV + expo-router stub pointing at range "r1".
jest.mock('react-native-mmkv');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: () => null },
}));

// Seed a small known range so the build comparison is deterministic.
function seedRange(): void {
  saveSavedRange({
    id: 'r1',
    name: 'Pairs',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('BuildScreen', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
  });

  it('compares the built guess against the target range', async () => {
    seedRange();
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BuildDrill id="r1" />);

    // No result until the user checks.
    expect(queryByTestId('build-correct')).toBeNull();

    // Build only AA (KK forgotten), then check.
    await user.press(getByTestId('hand-cell-AA'));
    await user.press(getByTestId('build-check'));

    await waitFor(() => {
      // AA is correct; KK was missed; nothing extra.
      expect(getByTestId('build-correct')).toHaveTextContent('AA');
      expect(getByTestId('build-missed')).toHaveTextContent('KK');
      expect(queryByTestId('build-extra')).toBeNull();
    });
  });

  it('flags a hand the user added that is not in the range as extra', async () => {
    seedRange();
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = await render(<BuildDrill id="r1" />);

    // Build AA (correct) plus QQ (not in the range) — QQ is extra, KK still missed.
    await user.press(getByTestId('hand-cell-AA'));
    await user.press(getByTestId('hand-cell-QQ'));
    await user.press(getByTestId('build-check'));

    await waitFor(() => {
      expect(getByTestId('build-correct')).toHaveTextContent('AA');
      expect(getByTestId('build-extra')).toHaveTextContent('QQ');
    });

    // Resetting clears the guess and the result.
    await user.press(getByTestId('build-reset'));
    await waitFor(() => expect(queryByTestId('build-correct')).toBeNull());
  });

  it('scores a checked build once, and not at all on a blank grid', async () => {
    seedRange();
    const user = userEvent.setup();
    const onScored = jest.fn().mockReturnValue(null);
    const { getByTestId } = await render(<BuildDrill id="r1" onScored={onScored} />);

    // Checking a blank grid is how you ask to be shown the chart, not a 0% session.
    await user.press(getByTestId('build-check'));
    expect(onScored).not.toHaveBeenCalled();

    await user.press(getByTestId('build-reset'));
    await user.press(getByTestId('hand-cell-AA'));
    await user.press(getByTestId('build-check'));
    // AA right, KK forgotten.
    await waitFor(() =>
      expect(onScored).toHaveBeenCalledWith({
        totalQuestions: 2,
        correctAnswers: 1,
        accuracyPercentage: 50,
      }),
    );

    // Checking again without changing anything must not log a second session.
    await user.press(getByTestId('build-check'));
    expect(onScored).toHaveBeenCalledTimes(1);
  });

  it('shows why a checked build could not be saved', async () => {
    seedRange();
    const user = userEvent.setup();
    const { getByTestId } = await render(
      <BuildDrill id="r1" onScored={() => 'Could not save this session.'} />,
    );

    await user.press(getByTestId('hand-cell-AA'));
    await user.press(getByTestId('build-check'));

    await waitFor(() =>
      expect(getByTestId('build-save-error')).toHaveTextContent('Could not save this session.'),
    );
  });
});
