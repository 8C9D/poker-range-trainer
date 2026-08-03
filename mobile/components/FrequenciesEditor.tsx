import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  incompleteMixedHands,
  primaryAction,
  type HandMixedStrategy,
} from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { MixedNotation } from './MixedNotation';
import { MixedStrategyEditor } from './MixedStrategyEditor';
import { SaveErrorBanner, useLiveSave } from './liveSave';
import { actionColors } from '../theme/actionColors';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/** How many unfinished hands the warning names before summarizing the rest. */
const MAX_LISTED_INCOMPLETE = 6;

/**
 * Mixed-frequency editor body for one saved range: pick an in-range hand, then set how
 * often it takes each action. Strategies live-save onto the range as the `mixedStrategies`
 * overlay through the reused `@core/storage` (which normalizes + drops empties), preserving
 * the range's other fields. Shared by the flat frequency-editor route and the Frequencies tab.
 */
export function FrequenciesEditor({ id }: { id?: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ACTION_COLORS = actionColors(theme);
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [mixedStrategies, setMixedStrategies] = useState<Record<PokerHand, HandMixedStrategy>>(
    () => range?.mixedStrategies ?? {},
  );
  const [activeHand, setActiveHand] = useState<PokerHand | null>(() => range?.hands[0] ?? null);
  const [saveError, runSave] = useLiveSave();
  const incomplete = incompleteMixedHands(mixedStrategies);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!range) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    runSave(() =>
      saveSavedRange({ ...range, mixedStrategies, updatedAt: new Date().toISOString() }),
    );
  }, [mixedStrategies, range, runSave]);

  const setStrategy = useCallback((hand: PokerHand, next: HandMixedStrategy) => {
    setMixedStrategies((prev) => ({ ...prev, [hand]: next }));
  }, [setMixedStrategies]);

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
      <SaveErrorBanner error={saveError} />
      <Text style={styles.hint}>Pick a hand, then set how often it takes each action.</Text>
      {/* The editor only ever shows one hand's total, so a mix left short is invisible the
          moment you pick another hand. Name them here, where the whole range is in view. */}
      {incomplete.length > 0 ? (
        <Pressable
          testID="freq-incomplete"
          accessibilityRole="button"
          onPress={() => setActiveHand(incomplete[0])}
        >
          <Text style={styles.incomplete}>
            {incomplete.length} hand{incomplete.length === 1 ? '' : 's'} not at 100%:{' '}
            {incomplete.slice(0, MAX_LISTED_INCOMPLETE).join(', ')}
            {incomplete.length > MAX_LISTED_INCOMPLETE
              ? ` and ${incomplete.length - MAX_LISTED_INCOMPLETE} more`
              : ''}
            . Tap to fix {incomplete[0]}.
          </Text>
        </Pressable>
      ) : null}
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

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { gap: 16 },
    notFound: { color: theme.ink2, fontSize: 16, marginTop: 32, textAlign: 'center' },
    hint: { color: theme.ink2, fontSize: 14 },
    incomplete: { color: theme.accent, fontSize: 14, lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: theme.goldFill, borderColor: theme.goldFill },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { color: theme.ink2, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: theme.onAccent },
  });
}
