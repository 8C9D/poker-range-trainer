import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  GAME_TYPES,
  GAME_TYPE_LABELS,
  POSITIONS,
  POSITION_LABELS,
  TABLE_SIZES,
  TABLE_SIZE_LABELS,
  type RangeMetadata,
} from '@core/types/range';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';
import { ChipRow } from './ChipRow';

export interface RangeMetadataEditorProps {
  /** Current metadata; the parent owns this state. */
  value: RangeMetadata;
  /** Replace the metadata with the next value. */
  onChange: (next: RangeMetadata) => void;
}

/**
 * Controlled "Scenario details" editor for a range's optional `RangeMetadata`.
 * Owns no state; reads/writes only through `value`/`onChange`. `saveSavedRange`
 * normalizes/drops empty fields, so this only collects values.
 */
export function RangeMetadataEditor({ value, onChange }: RangeMetadataEditorProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  function set<K extends keyof RangeMetadata>(key: K, next: RangeMetadata[K]): void {
    onChange({ ...value, [key]: next });
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>Scenario details</Text>

      <ChipRow
        label="Position"
        testIdPrefix="meta-position"
        options={POSITIONS}
        labels={POSITION_LABELS}
        selected={value.position}
        onSelect={(next) => set('position', next)}
      />
      <ChipRow
        label="Versus"
        testIdPrefix="meta-versus"
        options={POSITIONS}
        labels={POSITION_LABELS}
        selected={value.versusPosition}
        onSelect={(next) => set('versusPosition', next)}
      />
      <ChipRow
        label="Action"
        testIdPrefix="meta-action"
        options={ACTION_TYPES}
        labels={ACTION_TYPE_LABELS}
        selected={value.actionType}
        onSelect={(next) => set('actionType', next)}
      />
      <ChipRow
        label="Game"
        testIdPrefix="meta-game"
        options={GAME_TYPES}
        labels={GAME_TYPE_LABELS}
        selected={value.gameType}
        onSelect={(next) => set('gameType', next)}
      />
      <ChipRow
        label="Table"
        testIdPrefix="meta-table"
        options={TABLE_SIZES}
        labels={TABLE_SIZE_LABELS}
        selected={value.tableSize}
        onSelect={(next) => set('tableSize', next)}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Stack depth (bb)</Text>
        <TextInput
          testID="meta-stack"
          style={styles.input}
          keyboardType="number-pad"
          value={value.stackDepthBb != null ? String(value.stackDepthBb) : ''}
          onChangeText={(text) => {
            const trimmed = text.trim();
            if (trimmed === '') {
              set('stackDepthBb', undefined);
              return;
            }
            const parsed = Number(trimmed);
            if (Number.isFinite(parsed) && parsed > 0) set('stackDepthBb', parsed);
          }}
          placeholder="e.g. 100"
          placeholderTextColor={theme.ink3}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          testID="meta-notes"
          style={[styles.input, styles.notes]}
          value={value.notes ?? ''}
          onChangeText={(text) => set('notes', text)}
          placeholder="Optional notes about this scenario"
          placeholderTextColor={theme.ink3}
          multiline
        />
      </View>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 12,
    },
    heading: {
      color: theme.ink,
      fontSize: 16,
      fontWeight: '600',
    },
    field: {
      gap: 6,
    },
    label: {
      color: theme.ink2,
      fontSize: 13,
      fontWeight: '600',
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.ink,
      backgroundColor: theme.card,
    },
    notes: {
      minHeight: 44,
    },
  });
}
