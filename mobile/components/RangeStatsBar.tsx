import { StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import { countRangeCombos, rangeComboPercentage } from '@core/domain/comboSelection';
import { TOTAL_HOLDEM_COMBOS } from '@core/domain/rangeMath';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

export interface RangeStatsBarProps {
  /** The selected hands to summarize. */
  hands: PokerHand[];
  /** Per-hand combo narrowing, when the range has any; absence = all combos on. */
  comboSelections?: Record<PokerHand, string[]>;
}

/**
 * Live summary of a range: hand count, specific combos (of 1326), and the share of
 * all Hold'em combos it covers. Combos narrowed per hand count as narrowed, so the
 * figures match what the range actually holds.
 */
export function RangeStatsBar({ hands, comboSelections }: RangeStatsBarProps) {
  const theme = useTheme();
  const combos = countRangeCombos(hands, comboSelections);
  const percent = rangeComboPercentage(hands, comboSelections);
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
