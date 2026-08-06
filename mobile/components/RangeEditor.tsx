import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { HandMixedStrategy } from '@core/domain/mixedStrategy';
import {
  createHandSelectionHistory,
  recordHandSelection,
  redoHandSelection,
  undoHandSelection,
} from '@core/domain/handSelectionHistory';
import type { PokerHand } from '@core/domain/pokerHands';
import { mergeShortcutHands } from '@core/domain/rangeShortcuts';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';
import type { RangeMetadata } from '@core/types/range';

import { HandGrid } from './HandGrid';
import { SaveErrorBanner, useLiveSave } from './liveSave';
import { RangeMetadataEditor } from './RangeMetadataEditor';
import { RangeShortcuts } from './RangeShortcuts';
import { RangeStatsBar } from './RangeStatsBar';
import { createRangeId } from '../platform/createRangeId';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

interface RangeEditorProps {
  /** Existing range id to edit, or undefined to start a fresh draft. */
  id?: string;
}

/**
 * The range editor body: name, live stats, shortcuts, 13x13 tap + drag-paint grid,
 * scenario metadata, and a clear action. Name + hand selection are live-saved through
 * the reused `@core/storage` (no explicit save step). Extracted from the old editor
 * route so both the flat editor screen and the Range page's Edit tab share one
 * implementation.
 */
export function RangeEditor({ id: idParam }: RangeEditorProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  // Resolve the range (or a new draft) exactly once; id + createdAt stay stable across
  // re-renders and live saves.
  const [draft] = useState(() => {
    const existing = idParam ? findSavedRangeById(idParam) : undefined;
    if (existing) {
      return {
        id: existing.id,
        createdAt: existing.createdAt,
        name: existing.name,
        hands: existing.hands,
        metadata: existing.metadata ?? {},
      };
    }
    const now = new Date().toISOString();
    return {
      id: idParam ?? createRangeId(),
      createdAt: now,
      name: '',
      hands: [] as PokerHand[],
      metadata: {} as RangeMetadata,
    };
  });

  const [name, setName] = useState(draft.name);
  const [selectionHistory, setSelectionHistory] = useState(() =>
    createHandSelectionHistory(draft.hands),
  );
  const selected = useMemo(() => new Set(selectionHistory.present), [selectionHistory.present]);
  const [metadata, setMetadata] = useState<RangeMetadata>(draft.metadata);
  const [saveError, runSave] = useLiveSave();

  // Skip the first effect run so merely opening an existing range does not rewrite its
  // updatedAt; every later change live-saves.
  const hydratedRef = useRef(false);
  // Storage scopes the per-hand overlay maps (notes, frequencies, combo selections)
  // to the range's hands on every save, so a transient deselect (e.g. a drag-paint
  // slip) would silently destroy data whose editors are out of v1. Remember what a
  // save scoped out and re-attach it when the hand is re-selected in this session.
  const prunedNotesRef = useRef<Record<PokerHand, string>>({});
  const prunedStrategiesRef = useRef<Record<PokerHand, HandMixedStrategy>>({});
  const prunedCombosRef = useRef<Record<PokerHand, string[]>>({});
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    // Merge the edited fields onto the *current stored* range (read fresh each save) so
    // every stored field this screen doesn't edit — handActions, favorite, archived,
    // source, tags, per-hand notes, frequencies, combo selections — is preserved.
    // Their editors are out of v1, but the data must survive an edit.
    const existing = findSavedRangeById(draft.id);
    function scopedWithRestore<T>(
      stored: Record<PokerHand, T>,
      pruned: { current: Record<PokerHand, T> },
    ): Record<PokerHand, T> | undefined {
      const kept: Record<PokerHand, T> = {};
      for (const hand of selected) {
        const value = stored[hand] ?? pruned.current[hand];
        if (value !== undefined) kept[hand] = value;
      }
      for (const [hand, value] of Object.entries(stored)) {
        if (!selected.has(hand as PokerHand)) pruned.current[hand as PokerHand] = value as T;
      }
      return Object.keys(kept).length > 0 ? kept : undefined;
    }
    const handNotes = scopedWithRestore(existing?.handNotes ?? {}, prunedNotesRef);
    const mixedStrategies = scopedWithRestore(existing?.mixedStrategies ?? {}, prunedStrategiesRef);
    const comboSelections = scopedWithRestore(existing?.comboSelections ?? {}, prunedCombosRef);
    runSave(() =>
      saveSavedRange({
        ...(existing ?? {}),
        id: draft.id,
        name,
        hands: [...selected],
        createdAt: draft.createdAt,
        updatedAt: new Date().toISOString(),
        metadata,
        handNotes,
        mixedStrategies,
        comboSelections,
      }),
    );
  }, [name, selected, metadata, draft, runSave]);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setSelectionHistory((history) => {
      const prev = new Set(history.present);
      if (prev.has(hand) === isSelected) return history;
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return recordHandSelection(history, next);
    });
  }, []);

  const applyShortcut = useCallback((hands: PokerHand[]) => {
    setSelectionHistory((history) =>
      recordHandSelection(history, mergeShortcutHands(history.present, hands)),
    );
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('Clear range', 'Remove all selected hands?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setSelectionHistory((history) => recordHandSelection(history, [])),
      },
    ]);
  }, []);

  return (
    <View style={styles.content}>
      <TextInput
        testID="range-name-input"
        style={styles.nameInput}
        placeholder="Range name"
        placeholderTextColor={theme.ink3}
        value={name}
        onChangeText={setName}
      />
      <SaveErrorBanner error={saveError} />
      <RangeStatsBar hands={[...selected]} />
      <View style={styles.historyActions}>
        <Pressable
          testID="undo-selection"
          accessibilityRole="button"
          accessibilityState={{ disabled: selectionHistory.past.length === 0 }}
          disabled={selectionHistory.past.length === 0}
          style={[styles.historyButton, selectionHistory.past.length === 0 && styles.disabled]}
          onPress={() => setSelectionHistory(undoHandSelection)}
        >
          <Text style={styles.historyText}>Undo</Text>
        </Pressable>
        <Pressable
          testID="redo-selection"
          accessibilityRole="button"
          accessibilityState={{ disabled: selectionHistory.future.length === 0 }}
          disabled={selectionHistory.future.length === 0}
          style={[styles.historyButton, selectionHistory.future.length === 0 && styles.disabled]}
          onPress={() => setSelectionHistory(redoHandSelection)}
        >
          <Text style={styles.historyText}>Redo</Text>
        </Pressable>
      </View>
      <RangeShortcuts onAddHands={applyShortcut} />
      <HandGrid selected={selected} onSetSelected={handleSetSelected} />
      <RangeMetadataEditor value={metadata} onChange={setMetadata} name={name} />
      <Pressable
        testID="clear-range"
        accessibilityRole="button"
        style={styles.clearButton}
        onPress={handleClear}
      >
        <Text style={styles.clearText}>Clear range</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 16,
    },
    nameInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.ink,
      backgroundColor: theme.card,
    },
    historyActions: {
      flexDirection: 'row',
      gap: 8,
    },
    historyButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.card,
    },
    historyText: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '600',
    },
    disabled: {
      opacity: 0.4,
    },
    clearButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    clearText: {
      color: theme.bad,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
