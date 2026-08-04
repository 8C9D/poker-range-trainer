import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import { compareBuiltRange, summarizeBuiltRange } from '@core/domain/practice';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { PracticeSessionSummary } from '@core/types/practice';

import { HandGrid } from '../HandGrid';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

type BuildResult = ReturnType<typeof compareBuiltRange>;

/**
 * Build-from-memory drill body: rebuild the range on a blank grid, then check the guess
 * against the target (`compareBuiltRange`). Shared by the flat build route and the practice
 * overlay's build mode.
 *
 * Checking a non-empty build hands the score to `onScored`, so the run counts as a
 * practice session like every other mode. The web mirror is
 * `src/components/BuildFromMemoryPractice.tsx`.
 */
export function BuildDrill({
  id,
  onScored,
}: {
  id?: string;
  /**
   * Persist the checked build as a practice session, returning the message to show when
   * the write failed and null when it landed.
   */
  onScored?: (summary: PracticeSessionSummary) => string | null;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [built, setBuilt] = useState<Set<PokerHand>>(() => new Set());
  const [result, setResult] = useState<BuildResult | null>(null);
  // Why the checked build could not be saved, or null when it saved (or when there was
  // nothing to save).
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setBuilt((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return next;
    });
    setResult(null);
    setSaveError(null);
  }, []);

  /**
   * Grade the build and record it.
   *
   * Checking again without changing anything re-scores nothing: the guess is already
   * graded, and a second press must not log a second session. An empty grid is not
   * recorded either — "Check" on a blank board is how you ask to be shown the answer,
   * and logging that as a 0% session would punish a peek with a wrecked average and a
   * review pulled forward.
   */
  const check = useCallback(() => {
    if (!range || result) return;
    const comparison = compareBuiltRange(range.hands, [...built]);
    setResult(comparison);
    if (built.size === 0 || !onScored) return;
    setSaveError(onScored(summarizeBuiltRange(comparison)));
  }, [range, built, result, onScored]);

  const reset = useCallback(() => {
    setBuilt(new Set());
    setResult(null);
    setSaveError(null);
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
          <ResultGroup styles={styles} label="Correct" testID="build-correct" hands={result.correct} labelStyle={styles.labelCorrect} />
          <ResultGroup styles={styles} label="Missed" testID="build-missed" hands={result.missed} labelStyle={styles.labelMissed} />
          <ResultGroup styles={styles} label="Extra" testID="build-extra" hands={result.extra} labelStyle={styles.labelExtra} />
        </View>
      ) : null}
      {saveError ? (
        <Text testID="build-save-error" accessibilityRole="alert" style={styles.saveError}>
          {saveError}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function ResultGroup({
  styles,
  label,
  testID,
  hands,
  labelStyle,
}: {
  styles: ReturnType<typeof makeStyles>;
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

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, gap: 16 },
    notFound: { color: theme.ink2, fontSize: 16, marginTop: 32, textAlign: 'center' },
    hint: { color: theme.ink2, fontSize: 14 },
    actions: { flexDirection: 'row', gap: 12 },
    button: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
    checkButton: { backgroundColor: theme.goldFill },
    checkText: { color: theme.onAccent, fontSize: 16, fontWeight: '600' },
    resetButton: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
    resetText: { color: theme.ink2, fontSize: 16, fontWeight: '600' },
    saveError: { color: theme.bad, fontSize: 14, fontWeight: '500' },
    results: { gap: 12 },
    group: { gap: 6 },
    groupLabel: { fontSize: 14, fontWeight: '700' },
    labelCorrect: { color: theme.accentStrong },
    labelMissed: { color: theme.bad },
    labelExtra: { color: theme.ink2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      overflow: 'hidden',
      color: theme.ink,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
