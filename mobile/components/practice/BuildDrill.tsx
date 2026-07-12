import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import { compareBuiltRange } from '@core/domain/practice';
import { findSavedRangeById } from '@core/storage/rangeStorage';

import { HandGrid } from '../HandGrid';
import { colors } from '../../theme/colors';

type BuildResult = ReturnType<typeof compareBuiltRange>;

/**
 * Build-from-memory drill body: rebuild the range on a blank grid, then check the guess
 * against the target (`compareBuiltRange`). Shared by the flat build route and the practice
 * overlay's build mode.
 */
export function BuildDrill({ id }: { id?: string }) {
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [built, setBuilt] = useState<Set<PokerHand>>(() => new Set());
  const [result, setResult] = useState<BuildResult | null>(null);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setBuilt((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return next;
    });
    setResult(null);
  }, []);

  const check = useCallback(() => {
    if (!range) return;
    setResult(compareBuiltRange(range.hands, [...built]));
  }, [range, built]);

  const reset = useCallback(() => {
    setBuilt(new Set());
    setResult(null);
  }, []);

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>Rebuild this range from memory, then check your answer.</Text>
      <HandGrid selected={built} onSetSelected={handleSetSelected} />
      <View style={styles.actions}>
        <Pressable testID="build-check" accessibilityRole="button" style={[styles.button, styles.checkButton]} onPress={check}>
          <Text style={styles.checkText}>Check</Text>
        </Pressable>
        <Pressable testID="build-reset" accessibilityRole="button" style={[styles.button, styles.resetButton]} onPress={reset}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>
      {result ? (
        <View style={styles.results}>
          <ResultGroup label="Correct" testID="build-correct" hands={result.correct} labelStyle={styles.labelCorrect} />
          <ResultGroup label="Missed" testID="build-missed" hands={result.missed} labelStyle={styles.labelMissed} />
          <ResultGroup label="Extra" testID="build-extra" hands={result.extra} labelStyle={styles.labelExtra} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function ResultGroup({
  label,
  testID,
  hands,
  labelStyle,
}: {
  label: string;
  testID: string;
  hands: PokerHand[];
  labelStyle: object;
}) {
  if (hands.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, labelStyle]}>
        {label} ({hands.length})
      </Text>
      <View testID={testID} style={styles.chips}>
        {hands.map((hand) => (
          <Text key={hand} style={styles.chip}>
            {hand}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  notFound: { color: colors.text, fontSize: 16, marginTop: 32, textAlign: 'center' },
  hint: { color: colors.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  checkButton: { backgroundColor: colors.accent },
  checkText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
  resetButton: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  resetText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  results: { gap: 12 },
  group: { gap: 6 },
  groupLabel: { fontSize: 14, fontWeight: '700' },
  labelCorrect: { color: colors.accent },
  labelMissed: { color: colors.danger },
  labelExtra: { color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    color: colors.textStrong,
    fontSize: 13,
    fontWeight: '600',
  },
});
