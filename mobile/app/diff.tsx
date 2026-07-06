import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';
import { diffRanges, diffSummary } from '@core/domain/rangeDiff';
import { loadSavedRanges } from '@core/storage/rangeStorage';

import { colors } from '../theme/colors';

// The 13×13 grid order from the reused core matrix, built once (same source as HandGrid).
const HAND_MATRIX = generateHandMatrix();

type Bucket = 'common' | 'onlyA' | 'onlyB' | 'none';

const BUCKET_COLORS: Record<Bucket, string> = {
  common: '#22c55e', // green — in both
  onlyA: '#60a5fa', // blue — only A
  onlyB: '#f59e0b', // amber — only B
  none: colors.surface,
};

/**
 * Range diff view (M6 / web v5): compare two saved ranges by membership. Pick range A and range B
 * from the saved ranges; the diff splits hands into both / only-A / only-B via `@core/domain/rangeDiff`
 * (`diffRanges` + `diffSummary`), shown as a count legend and a read-only tri-color 13×13 grid. All
 * comparison logic is reused — this screen only gathers the two ranges and colors the grid.
 */
export default function DiffScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [ranges] = useState(() => loadSavedRanges());

  const [aId, setAId] = useState<string | undefined>(idParam);
  const [bId, setBId] = useState<string | undefined>(undefined);

  const rangeA = ranges.find((range) => range.id === aId);
  const rangeB = ranges.find((range) => range.id === bId);

  const diff = useMemo(
    () => (rangeA && rangeB ? diffRanges(rangeA.hands, rangeB.hands) : null),
    [rangeA, rangeB],
  );
  const summary = diff ? diffSummary(diff) : null;

  const bucketOf = useMemo(() => {
    const map = new Map<PokerHand, Bucket>();
    if (diff) {
      for (const hand of diff.common) map.set(hand, 'common');
      for (const hand of diff.onlyA) map.set(hand, 'onlyA');
      for (const hand of diff.onlyB) map.set(hand, 'onlyB');
    }
    return map;
  }, [diff]);

  if (ranges.length < 2) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Compare ranges' }} />
        <Text style={styles.notFound}>Save at least two ranges to compare them.</Text>
      </View>
    );
  }

  function picker(label: string, side: 'a' | 'b', selectedId: string | undefined, onSelect: (id: string) => void) {
    return (
      <View style={styles.pickerBlock}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.chips}>
          {ranges.map((range) => {
            const selected = range.id === selectedId;
            return (
              <Pressable
                key={range.id}
                testID={`diff-${side}-${range.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => onSelect(range.id)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {range.name || 'Untitled'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Compare ranges' }} />
      {picker('Range A', 'a', aId, setAId)}
      {picker('Range B', 'b', bId, setBId)}

      {summary ? (
        <>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: BUCKET_COLORS.common }]} />
              <Text testID="diff-summary-common" style={styles.legendText}>
                Both: {summary.common}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: BUCKET_COLORS.onlyA }]} />
              <Text testID="diff-summary-onlyA" style={styles.legendText}>
                Only A: {summary.onlyA}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: BUCKET_COLORS.onlyB }]} />
              <Text testID="diff-summary-onlyB" style={styles.legendText}>
                Only B: {summary.onlyB}
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            {HAND_MATRIX.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {row.map((hand) => {
                  const bucket = bucketOf.get(hand) ?? 'none';
                  return (
                    <View
                      key={hand}
                      testID={`diff-cell-${hand}`}
                      accessibilityLabel={`${hand} ${bucket}`}
                      style={[styles.cell, { backgroundColor: BUCKET_COLORS[bucket] }]}
                    >
                      <Text numberOfLines={1} style={styles.cellLabel}>
                        {hand}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.hint}>Pick a range for both A and B to see their difference.</Text>
      )}
    </ScrollView>
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
    paddingHorizontal: 24,
  },
  pickerBlock: {
    gap: 8,
  },
  label: {
    color: colors.textStrong,
    fontSize: 14,
    fontWeight: '700',
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
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.onAccent,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    width: '100%',
    aspectRatio: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.background,
  },
  cellLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0b0b0f',
  },
  hint: {
    color: colors.text,
    fontSize: 14,
  },
});
