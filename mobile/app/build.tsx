import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { PokerHand } from '@core/domain/pokerHands';
import { compareBuiltRange } from '@core/domain/practice';
import { findSavedRangeById } from '@core/storage/rangeStorage';

import { HandGrid } from '../components/HandGrid';
import { colors } from '../theme/colors';

type BuildResult = ReturnType<typeof compareBuiltRange>;

/**
 * Build-from-memory practice for one saved range: the user rebuilds the range on a
 * blank 13×13 grid, then checks their guess against the target. The comparison
 * (correct / missed / extra) reuses `@core/domain/practice` `compareBuiltRange`; the
 * grid is the same controlled `HandGrid` used by the editor.
 */
export default function BuildScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const [built, setBuilt] = useState<Set<PokerHand>>(() => new Set());
  const [result, setResult] = useState<BuildResult | null>(null);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setBuilt((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return next;
    });
    // Editing the guess invalidates a prior check until the user checks again.
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
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Build from memory' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Build from memory' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>
      <Text style={styles.hint}>Rebuild this range from memory, then check your answer.</Text>

      <HandGrid selected={built} onSetSelected={handleSetSelected} />

      <View style={styles.actions}>
        <Pressable
          testID="build-check"
          accessibilityRole="button"
          style={[styles.button, styles.checkButton]}
          onPress={check}
        >
          <Text style={styles.checkText}>Check</Text>
        </Pressable>
        <Pressable
          testID="build-reset"
          accessibilityRole="button"
          style={[styles.button, styles.resetButton]}
          onPress={reset}
        >
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      {result ? (
        <View style={styles.results}>
          <ResultGroup
            label="Correct"
            testID="build-correct"
            hands={result.correct}
            labelStyle={styles.labelCorrect}
          />
          <ResultGroup
            label="Missed"
            testID="build-missed"
            hands={result.missed}
            labelStyle={styles.labelMissed}
          />
          <ResultGroup
            label="Extra"
            testID="build-extra"
            hands={result.extra}
            labelStyle={styles.labelExtra}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

interface ResultGroupProps {
  label: string;
  testID: string;
  hands: PokerHand[];
  labelStyle: object;
}

/** One labelled, counted row of result chips; renders nothing when the group is empty. */
function ResultGroup({ label, testID, hands, labelStyle }: ResultGroupProps) {
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  notFound: {
    color: colors.text,
    fontSize: 16,
    marginTop: 48,
    textAlign: 'center',
  },
  rangeName: {
    color: colors.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: colors.text,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkButton: {
    backgroundColor: colors.accent,
  },
  checkText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  resetText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    gap: 12,
  },
  group: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  labelCorrect: {
    color: colors.accent,
  },
  labelMissed: {
    color: colors.danger,
  },
  labelExtra: {
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
