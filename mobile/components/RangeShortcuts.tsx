import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import {
  selectAllBroadways,
  selectAllPairs,
  selectOffsuitBroadways,
  selectPairsAtOrAbove,
  selectSuitedBroadways,
} from '@core/domain/rangeShortcuts';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

export interface RangeShortcutsProps {
  /** Merge the shortcut's hands into the current selection. */
  onAddHands: (hands: PokerHand[]) => void;
}

// Label -> hand-group helper. The membership rules live entirely in the domain
// helpers (mirrors the web RangeShortcuts), so the UI never duplicates them.
const SHORTCUTS: readonly { label: string; testID: string; getHands: () => PokerHand[] }[] = [
  { label: 'All pairs', testID: 'shortcut-all-pairs', getHands: selectAllPairs },
  { label: '77+', testID: 'shortcut-77-plus', getHands: () => selectPairsAtOrAbove('77') },
  { label: 'Suited broadways', testID: 'shortcut-suited-broadways', getHands: selectSuitedBroadways },
  { label: 'Offsuit broadways', testID: 'shortcut-offsuit-broadways', getHands: selectOffsuitBroadways },
  { label: 'All broadways', testID: 'shortcut-all-broadways', getHands: selectAllBroadways },
];

/** Buttons that add common hand groups to the current selection (never remove). */
export function RangeShortcuts({ onAddHands }: RangeShortcutsProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.container}>
      {SHORTCUTS.map(({ label, testID, getHands }) => (
        <Pressable
          key={testID}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          style={styles.button}
          onPress={() => onAddHands(getHands())}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    button: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    buttonText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
