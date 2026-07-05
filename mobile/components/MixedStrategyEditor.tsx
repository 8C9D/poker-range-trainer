import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isValidMixedStrategy,
  totalFrequency,
  type HandMixedStrategy,
} from '@core/domain/mixedStrategy';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { ACTION_COLORS } from '../theme/actionColors';
import { colors } from '../theme/colors';
import { stepMixedFrequency } from './mixedStrategyStep';

interface MixedStrategyEditorProps {
  /** The current mixed strategy (controlled; the parent owns it). */
  strategy: HandMixedStrategy;
  /** Fired with the next normalized strategy whenever a stepper is pressed. */
  onChange: (next: HandMixedStrategy) => void;
}

/**
 * Controlled, presentational editor for ONE hand's mixed strategy — the RN parallel of the web
 * `MixedStrategyEditor`, using −/+ steppers instead of sliders. Each `RangeAction` row nudges
 * its frequency; the result is rebuilt + normalized by `stepMixedFrequency` (over `@core`) and
 * reported via `onChange`. Shows the live total and whether it sums to 100. Holds no state.
 */
export function MixedStrategyEditor({ strategy, onChange }: MixedStrategyEditorProps) {
  const byAction = new Map<RangeAction, number>();
  for (const entry of strategy) byAction.set(entry.action, entry.frequency);

  const total = totalFrequency(strategy);
  const valid = isValidMixedStrategy(strategy);

  return (
    <View style={styles.container}>
      {RANGE_ACTIONS.map((action) => {
        const value = byAction.get(action) ?? 0;
        return (
          <View key={action} testID={`mixed-row-${action}`} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: ACTION_COLORS[action] }]} />
            <Text style={styles.label}>{RANGE_ACTION_LABELS[action]}</Text>
            <Pressable
              testID={`mixed-dec-${action}`}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${RANGE_ACTION_LABELS[action]}`}
              style={styles.stepper}
              onPress={() => onChange(stepMixedFrequency(strategy, action, -1))}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <Text testID={`mixed-value-${action}`} style={styles.value}>
              {value}%
            </Text>
            <Pressable
              testID={`mixed-inc-${action}`}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${RANGE_ACTION_LABELS[action]}`}
              style={styles.stepper}
              onPress={() => onChange(stepMixedFrequency(strategy, action, 1))}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>
        );
      })}
      <Text testID="mixed-total" style={[styles.total, valid && styles.totalValid]}>
        Total: {total}% {valid ? '✓' : '(must total 100%)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    color: colors.textStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  stepper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepperText: {
    color: colors.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  value: {
    minWidth: 48,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  total: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  totalValid: {
    color: colors.accent,
  },
});
