import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assignedHands } from '@core/domain/actionRange';
import { rangeEdgeHands } from '@core/domain/edgeHands';
import { handsWithMixedStrategy } from '@core/domain/mixedStrategy';
import { DEFAULT_DRILL_SECONDS, DRILL_DURATION_OPTIONS } from '@core/domain/timedDrill';
import type { SavedRange } from '@core/types/range';

import { answerVerbs } from '../../lib/scenario';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

export type PracticeMode =
  | 'recognize'
  | 'spots'
  | 'build'
  | 'timed'
  | 'weakness'
  | 'edges'
  | 'action'
  | 'mixed'
  | 'combo'
  | 'postflop'
  | 'board';

interface ModePickerProps {
  range: SavedRange;
  onPick: (mode: PracticeMode, opts?: { durationSeconds?: number }) => void;
}

/**
 * Lists only the practice modes valid for this range: the action quiz needs assigned hand
 * actions and the frequency quiz needs mixed strategies; the rest always apply. Each option
 * is a labelled card (icons would need labels anyway).
 */
export function ModePicker({ range, onPick }: ModePickerProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DRILL_SECONDS);
  const verbs = answerVerbs(range);
  const hasActions = assignedHands(range).length > 0;
  // An empty range (or one holding every hand) has no boundary to drill.
  const hasEdge = rangeEdgeHands(range.hands).length > 0;
  const hasMixed =
    !!range.mixedStrategies && handsWithMixedStrategy(range.mixedStrategies).length > 0;

  // A render helper (lowercase, called as a function) rather than a nested component,
  // so a fresh component type isn't created on every render.
  const option = (mode: string, title: string, subtitle: string, onPress: () => void) => (
    <Pressable testID={`mode-${mode}`} style={styles.option} onPress={onPress}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>How do you want to train?</Text>
      {option(
        'recognize',
        'Recognize hands',
        `See a hand, decide ${verbs.yes.toLowerCase()} or fold. The core drill.`,
        () => onPick('recognize'),
      )}
      {option(
        'build',
        'Build from memory',
        'Rebuild the whole range on an empty grid, then check it.',
        () => onPick('build'),
      )}
      {option(
        'timed',
        'Timed drill',
        'Answer as many hands as you can before the clock runs out.',
        () => onPick('timed', { durationSeconds }),
      )}
      <View style={styles.durationRow}>
        <Text style={styles.durationLabel}>Timed length</Text>
        <View style={styles.durationSeg}>
          {DRILL_DURATION_OPTIONS.map((seconds) => {
            const active = durationSeconds === seconds;
            return (
              <Pressable
                key={seconds}
                testID={`duration-${seconds}`}
                accessibilityState={{ selected: active }}
                onPress={() => setDurationSeconds(seconds)}
                style={[styles.durationChip, active && { backgroundColor: theme.card }]}
              >
                <Text style={[styles.durationChipText, { color: active ? theme.ink : theme.ink2 }]}>
                  {seconds}s
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {option(
        'weakness',
        'Weakness drill',
        'The hands you miss show up more often until they stick.',
        () => onPick('weakness'),
      )}
      {hasEdge
        ? option(
            'edges',
            'Edge drill',
            'Only the hands on the range boundary — where the real decisions are.',
            () => onPick('edges'),
          )
        : null}
      {hasActions
        ? option(
            'action',
            'Pick the correct action',
            'Name the assigned action for each hand in the chart.',
            () => onPick('action'),
          )
        : null}
      {hasMixed
        ? option(
            'mixed',
            'Frequency quiz',
            'Name the primary action for each mixed-strategy hand.',
            () => onPick('mixed'),
          )
        : null}
      {option(
        'combo',
        'Combo drill',
        'Blocker-aware: deal concrete combos from this range.',
        () => onPick('combo'),
      )}
      {option(
        'postflop',
        'Postflop drill',
        'Set up a flop spot and practice the decision.',
        () => onPick('postflop'),
      )}
      {option(
        'board',
        'Range vs board',
        'Explore how this range hits a flop texture.',
        () => onPick('board'),
      )}
    </ScrollView>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, gap: 10, paddingBottom: 32 },
    heading: { fontFamily: fonts.displaySemibold, fontSize: 22, color: theme.ink, marginBottom: 4 },
    option: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 16,
      gap: 4,
    },
    optionTitle: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink },
    optionSubtitle: { fontFamily: fonts.body, fontSize: 13.5, color: theme.ink2 },
    durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    durationLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.ink3 },
    durationSeg: {
      flexDirection: 'row',
      backgroundColor: theme.well,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      padding: 2,
      gap: 2,
    },
    durationChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    durationChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
  });
}
