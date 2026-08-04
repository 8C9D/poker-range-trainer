import { render } from '@testing-library/react-native';

import { saveSavedRange } from '@core/storage/rangeStorage';

import { ComboDrill } from '../components/practice/ComboDrill';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

jest.mock('react-native-mmkv');
jest.mock('expo-crypto');

describe('ComboDrill', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    saveSavedRange({
      id: 'r1',
      name: 'Aces',
      // Narrowed to a single combo, which is what the count has to read out.
      hands: ['AKs'],
      comboSelections: { AKs: ['AhKh'] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('counts a single surviving combo in the singular', async () => {
    const { getByTestId } = await render(<ComboDrill id="r1" />);

    expect(getByTestId('blocker-remaining')).toHaveTextContent('1 combo available');
  });

  it('counts the rest in the plural', async () => {
    saveSavedRange({
      id: 'r2',
      name: 'Aces',
      hands: ['AKs'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { getByTestId } = await render(<ComboDrill id="r2" />);

    expect(getByTestId('blocker-remaining')).toHaveTextContent('4 combos available');
  });
});
