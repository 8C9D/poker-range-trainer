import { render, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { RANGE_TABS } from '@core/app/routes';
import { generateHandMatrix } from '@core/domain/pokerHands';
import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { recordPracticeSessionHistory } from '@core/storage/sessionHistoryStorage';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import TodayScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import ProgressScreen from '../app/(tabs)/progress';
import DiffScreen from '../app/diff';
import RangeScreen from '../app/range/[id]';
import PracticeScreen from '../app/practice';
import { installLocalStorage, localStorageShim } from '../platform/localStorageShim';

/**
 * The mobile mirror of the web app's `accessibleNames` sweep, and it catches the
 * same mistake for a different reason. On the web an `aria-label` is dropped
 * because a `<div>` has no role to hang a name on; on iOS a `<View>` is simply
 * not an accessibility element unless it is `accessible`, so VoiceOver walks
 * straight past the label and reads whatever text happens to be inside.
 *
 * That is worse than no label, because the fallback text is the part the label
 * existed to add to: the heatmap cells read "AA" instead of "AA 67%", the week
 * chart read the bare bar value instead of "Mon: 20 hands". Four grids and
 * charts had drifted that way, each looking labelled in the source.
 *
 * Pressables set `accessible` themselves, so this only flags the plain
 * containers.
 */

// In-memory MMKV + a superset expo-router stub covering every screen swept here.
jest.mock('react-native-mmkv');
jest.mock('expo-crypto');
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `poker-range-trainer://${path}`),
  openURL: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'r1' })),
  useFocusEffect: () => {},
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  Link: ({ children }: { children: ReactNode }) => children,
  Stack: { Screen: () => null },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockParams = require('expo-router').useLocalSearchParams as jest.Mock;

interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
}

/** Every host element in the rendered tree, in document order. */
function hosts(node: HostNode | string | null): HostNode[] {
  if (!node || typeof node === 'string') return [];
  return [node, ...(node.children ?? []).flatMap(hosts)];
}

/** Every labelled container iOS would refuse to name. */
function droppedLabels(tree: unknown): string[] {
  return hosts(tree as HostNode)
    .filter((n) => n.type === 'View' && n.props.accessibilityLabel && n.props.accessible !== true)
    .map((n) => `View: "${String(n.props.accessibilityLabel)}"`);
}

function seed(id: string, name: string, hands: string[] = ['AA', 'KK', 'AKs']): SavedRange {
  const range = {
    id,
    name,
    hands,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { position: 'btn', actionType: 'open', tableSize: 'sixMax', stackDepthBb: 100 },
  } as SavedRange;
  saveSavedRange(range);
  return range;
}

/** Practice history, so the charts and the heatmap have something to label. */
function seedHistory(): void {
  const summary = { totalQuestions: 10, correctAnswers: 6 };
  recordPracticeSession('r1', summary);
  recordPracticeSessionHistory('r1', summary, new Date().toISOString());
  recordHandAccuracy('r1', [
    { hand: 'AA', attempts: 3, correct: 1, falsePositives: 0, falseNegatives: 2 },
  ]);
}

describe('accessible names', () => {
  beforeAll(() => {
    installLocalStorage();
  });

  beforeEach(() => {
    localStorageShim.clear();
    mockParams.mockReturnValue({ id: 'r1' });
  });

  it('has something to check', async () => {
    // Guards the guard: a screen that rendered nothing would pass every case.
    seed('r1', 'BTN open');
    seedHistory();
    const { toJSON } = await render(<ProgressScreen />);
    const labelled = hosts(toJSON() as unknown as HostNode).filter(
      (n) => n.props.accessibilityLabel,
    );
    expect(labelled.length).toBeGreaterThan(3);
  });

  it('never labels a container that cannot carry a name on Today', async () => {
    seed('r1', 'BTN open');
    seedHistory();
    const { toJSON } = await render(<TodayScreen />);
    expect(droppedLabels(toJSON())).toEqual([]);
  });

  it('never labels a container that cannot carry a name on Library', async () => {
    seed('r1', 'BTN open');
    const { toJSON } = await render(<LibraryScreen />);
    expect(droppedLabels(toJSON())).toEqual([]);
  });

  it('never labels a container that cannot carry a name on Progress', async () => {
    seed('r1', 'BTN open');
    seedHistory();
    const { toJSON } = await render(<ProgressScreen />);
    expect(droppedLabels(toJSON())).toEqual([]);
  });

  it.each(RANGE_TABS)('never labels a container that cannot carry a name on the %s tab', async (tab) => {
    seed('r1', 'BTN open');
    seedHistory();
    const user = userEvent.setup();
    const { getByTestId, toJSON } = await render(<RangeScreen />);

    await user.press(getByTestId(`range-tab-${tab}`));

    expect(droppedLabels(toJSON())).toEqual([]);
  });

  it('never labels a container that cannot carry a name on the diff', async () => {
    seed('r1', 'Range One');
    seed('r2', 'Range Two', ['KK', 'QQ']);
    const user = userEvent.setup();
    const { getByTestId, toJSON } = await render(<DiffScreen />);

    // The grid only exists once both sides are chosen.
    await user.press(getByTestId('diff-a-r1'));
    await user.press(getByTestId('diff-b-r2'));

    expect(droppedLabels(toJSON())).toEqual([]);
  });

  it('never labels a container that cannot carry a name in a drill', async () => {
    seed('r1', 'Everything', generateHandMatrix().flat());
    mockParams.mockReturnValue({ id: 'r1', mode: 'recognize' });
    const { getByTestId, toJSON } = await render(<PracticeScreen />);

    expect(getByTestId('drill-hand')).toBeTruthy();
    expect(droppedLabels(toJSON())).toEqual([]);
  });

  /**
   * A Text is the mirror image of the problem above: it takes a label fine, but
   * the label *replaces* what is written there. The clock read "Time remaining"
   * with the seconds gone, which is the one thing a timed drill has to say.
   */
  it('never hides the timer behind a label that omits the seconds', async () => {
    seed('r1', 'Everything', generateHandMatrix().flat());
    mockParams.mockReturnValue({ id: 'r1', mode: 'timed' });
    const { getByText } = await render(<PracticeScreen />);

    const timer = getByText(/\d+s left/);
    expect(timer.props.accessibilityLabel).toBeUndefined();
  });
});
