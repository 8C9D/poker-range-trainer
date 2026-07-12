import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { primaryAction, type HandMixedStrategy } from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { MixedNotation } from './MixedNotation';
import { MixedStrategyEditor } from './MixedStrategyEditor';
import { ACTION_COLORS } from '../theme/actionColors';
import { colors } from '../theme/colors';

/**
 * Mixed-frequency editor body for one saved range: pick an in-range hand, then set how
 * often it takes each action. Strategies live-save onto the range as the `mixedStrategies`
 * overlay through the reused `@core/storage` (which normalizes + drops empties), preserving
 * the range's other fields. Shared by the flat frequency-editor route and the Frequencies tab.
 */
export function FrequenciesEditor({ id }: { id?: string }) {
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [mixedStrategies, setMixedStrategies] = useState<Record<PokerHand, HandMixedStrategy>>(
    () => range?.mixedStrategies ?? {},
  );
  const [activeHand, setActiveHand] = useState<PokerHand | null>(() => range?.hands[0] ?? null);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!range) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveSavedRange({ ...range, mixedStrategies, updatedAt: new Date().toISOString() });
  }, [mixedStrategies, range]);

  const setStrategy = useCallback((hand: PokerHand, next: HandMixedStrategy) => {
    setMixedStrategies((prev) => ({ ...prev, [hand]: next }));
  }, []);

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  if (range.hands.length === 0) {
    return (
      <Text testID="no-hands" style={styles.notFound}>
        Add hands to the range first, then set their frequencies.
      </Text>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={styles.hint}>Pick a hand, then set how often it takes each action.</Text>
      <View style={styles.chips}>
        {range.hands.map((hand) => {
          const primary = primaryAction(mixedStrategies[hand] ?? []);
          const active = activeHand === hand;
          return (
            <Pressable
              key={hand}
              testID={`freq-hand-${hand}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveHand(hand)}
            >
              {primary ? <View style={[styles.dot, { backgroundColor: ACTION_COLORS[primary] }]} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{hand}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeHand ? (
        <MixedStrategyEditor
          strategy={mixedStrategies[activeHand] ?? []}
          onChange={(next) => setStrategy(activeHand, next)}
        />
      ) : null}

      <MixedNotation mixedStrategies={mixedStrategies} onReplaceStrategies={setMixedStrategies} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  notFound: { color: colors.text, fontSize: 16, marginTop: 32, textAlign: 'center' },
  hint: { color: colors.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.onAccent },
});
