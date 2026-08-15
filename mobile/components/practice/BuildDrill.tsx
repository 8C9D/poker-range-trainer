import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';
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
  // The score the checked build was logged as, or null when nothing was logged. Held
  // rather than re-derived so the screen only claims what actually happened.
  const [scored, setScored] = useState<PracticeSessionSummary | null>(null);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setBuilt((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return next;
    });
    setResult(null);
    setSaveError(null);
    setScored(null);
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
    const summary = summarizeBuiltRange(comparison);
    setSaveError(onScored(summary));
    setScored(summary);
  }, [range, built, result, onScored]);

  const reset = useCallback(() => {
    setBuilt(new Set());
    setResult(null);
    setSaveError(null);
    setScored(null);
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
          {/* The same score line the web results screen leads with: how much of the
              chart came back, before the hand lists that say which parts. */}
          <Text testID="build-score" style={styles.score}>
            Correct: {result.correct.length} of {result.correct.length + result.missed.length} ·
            Missed: {result.missed.length} · Added by mistake: {result.extra.length}
          </Text>
          {/* A run that counted says so: the stats, the streak and the review schedule
              all moved, and nothing else on this screen shows that. */}
          {scored && !saveError ? (
            <Text testID="build-logged" style={styles.logged}>
              Logged as a practice session · {Math.round(scored.accuracyPercentage)}%
            </Text>
          ) : null}
          {onScored && built.size === 0 ? (
            <Text testID="build-not-logged" style={styles.hint}>
              Nothing logged — build the range first, then check it.
            </Text>
          ) : null}
          <ResultsGrid styles={styles} theme={theme} result={result} />
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

const RESULT_MATRIX = generateHandMatrix();

type ResultState = 'correct' | 'missed' | 'extra' | null;

/**
 * The checked build shown as the chart itself: a read-only 13×13 grid colored by
 * outcome, with a counted legend. Replaces the flat hand-chip lists, which read
 * as an unstructured pile once a real range put dozens of hands in each group
 * (device-pass feedback, 2026-08-15).
 */
function ResultsGrid({
  styles,
  theme,
  result,
}: {
  styles: ReturnType<typeof makeStyles>;
  theme: ThemeColors;
  result: BuildResult;
}) {
  const correct = new Set<PokerHand>(result.correct);
  const missed = new Set<PokerHand>(result.missed);
  const extra = new Set<PokerHand>(result.extra);
  const stateOf = (hand: PokerHand): ResultState =>
    correct.has(hand) ? 'correct' : missed.has(hand) ? 'missed' : extra.has(hand) ? 'extra' : null;
  const cellStyle = (state: ResultState) => {
    switch (state) {
      case 'correct':
        return { backgroundColor: theme.goldFill, color: theme.onAccent };
      case 'missed':
        return { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.bad, color: theme.bad };
      case 'extra':
        return { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accent, color: theme.accentStrong };
      default:
        return { backgroundColor: theme.cellbg, color: theme.ink2, opacity: 0.45 };
    }
  };
  return (
    <View style={styles.results}>
      <View style={styles.legend}>
        {result.correct.length > 0 ? (
          <Text testID="build-correct" style={[styles.groupLabel, styles.labelCorrect]}>
            Correct {result.correct.length}
          </Text>
        ) : null}
        {result.missed.length > 0 ? (
          <Text testID="build-missed" style={[styles.groupLabel, styles.labelMissed]}>
            Missed {result.missed.length}
          </Text>
        ) : null}
        {result.extra.length > 0 ? (
          <Text testID="build-extra" style={[styles.groupLabel, styles.labelExtra]}>
            Extra {result.extra.length}
          </Text>
        ) : null}
      </View>
      <View testID="build-results-grid" style={styles.resultGrid}>
        {RESULT_MATRIX.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.resultRow}>
            {row.map((hand) => {
              const state = stateOf(hand);
              const { color, ...cell } = cellStyle(state);
              return (
                <Text
                  key={hand}
                  testID={`build-cell-${hand}`}
                  accessibilityLabel={state ? `${hand}, ${state}` : hand}
                  numberOfLines={1}
                  style={[styles.resultCell, cell, { color }]}
                >
                  {hand}
                </Text>
              );
            })}
          </View>
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
    score: { color: theme.ink, fontSize: 15, fontWeight: '600', lineHeight: 21 },
    logged: { color: theme.accentStrong, fontSize: 14, fontWeight: '600' },
    results: { gap: 12 },
    groupLabel: { fontSize: 14, fontWeight: '700' },
    labelCorrect: { color: theme.accentStrong },
    labelMissed: { color: theme.bad },
    labelExtra: { color: theme.ink2 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    resultGrid: { width: '100%', aspectRatio: 1, gap: 2 },
    resultRow: { flex: 1, flexDirection: 'row', gap: 2 },
    resultCell: {
      flex: 1,
      textAlign: 'center',
      textAlignVertical: 'center',
      borderRadius: 3,
      fontSize: 10,
      fontWeight: '600',
      overflow: 'hidden',
    },
  });
}
