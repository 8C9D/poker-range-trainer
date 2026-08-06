import { StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import {
  TOTAL_HOLDEM_COMBOS,
  calculateRangePercentage,
  countSelectedCombos,
} from '@core/domain/rangeMath';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

export interface RangeStatsBarProps {
  /** The selected hands to summarize. */
  hands: PokerHand[];
}

/**
 * Live summary of a range: hand count, specific combos (of 1326), and the share of
 * all Hold'em combos it covers. Hand-class model only: stored per-combo selections
 * are ignored, so a range whose AA is narrowed to one combo still counts all six.
 */
export function RangeStatsBar({ hands }: RangeStatsBarProps) {
  const theme = useTheme();
  const combos = countSelectedCombos(hands);
  const percent = calculateRangePercentage(hands);
  return (
    <View style={styles.bar}>
      <Text testID="stat-hands" style={[styles.stat, { color: theme.ink2 }]}>
        {hands.length} {hands.length === 1 ? 'hand' : 'hands'}
      </Text>
      <Text testID="stat-combos" style={[styles.stat, { color: theme.ink2 }]}>
        {combos}/{TOTAL_HOLDEM_COMBOS} combos
      </Text>
      <Text testID="stat-percent" style={[styles.stat, { color: theme.ink2 }]}>
        {percent.toFixed(1)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stat: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
