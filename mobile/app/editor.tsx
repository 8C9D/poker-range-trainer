import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';

import type { Card } from '@core/domain/cards';
import {
  allCombosForHand,
  deserializeComboSelection,
  serializeComboSelection,
  toggleCombo,
  type ComboSelection,
} from '@core/domain/comboSelection';
import { ALL_HANDS, type PokerHand } from '@core/domain/pokerHands';
import { mergeShortcutHands } from '@core/domain/rangeShortcuts';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';
import type { RangeMetadata } from '@core/types/range';

import { ComboSelector } from '../components/ComboSelector';
import { HandGrid } from '../components/HandGrid';
import { RangeMetadataEditor } from '../components/RangeMetadataEditor';
import { RangeNotation } from '../components/RangeNotation';
import { RangeShortcuts } from '../components/RangeShortcuts';
import { RangeStatsBar } from '../components/RangeStatsBar';
import { createRangeId } from '../platform/createRangeId';
import { colors } from '../theme/colors';

/**
 * Create or edit a single range. With an `id` route param it loads that range to
 * edit; otherwise it starts a fresh draft. Name + hand selection are live-saved
 * through the reused `@core/storage` so there is no explicit save step.
 */
export default function EditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;

  // Resolve the range (or a new draft) exactly once; id + createdAt stay stable
  // across re-renders and live saves.
  const [draft] = useState(() => {
    const existing = idParam ? findSavedRangeById(idParam) : undefined;
    if (existing) {
      return {
        id: existing.id,
        createdAt: existing.createdAt,
        name: existing.name,
        hands: existing.hands,
        metadata: existing.metadata ?? {},
        comboSelections: existing.comboSelections,
      };
    }
    const now = new Date().toISOString();
    return {
      id: idParam ?? createRangeId(),
      createdAt: now,
      name: '',
      hands: [] as PokerHand[],
      metadata: {} as RangeMetadata,
      comboSelections: undefined as Record<PokerHand, string[]> | undefined,
    };
  });

  const [name, setName] = useState(draft.name);
  const [selected, setSelected] = useState<Set<PokerHand>>(() => new Set(draft.hands));
  const [metadata, setMetadata] = useState<RangeMetadata>(draft.metadata);
  // Per-hand-class combo refinements (v4.1). Seed only the hands that have a stored
  // refinement; any in-range hand without an entry defaults to all-on lazily. The active
  // hand is the one whose ComboSelector is currently expanded.
  const [comboDraft, setComboDraft] = useState<Record<PokerHand, ComboSelection>>(() => {
    const seed: Record<PokerHand, ComboSelection> = {};
    for (const hand of draft.hands) {
      const saved = draft.comboSelections?.[hand];
      if (saved) seed[hand] = deserializeComboSelection(saved);
    }
    return seed;
  });
  const [activeComboHand, setActiveComboHand] = useState<PokerHand | null>(null);

  // Skip the first effect run so merely opening an existing range does not rewrite
  // its updatedAt; every later change live-saves.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    // Merge the edited fields onto the *current stored* range (read fresh each save) so
    // overlay fields this screen doesn't edit — handActions, favorite, archived, source,
    // mixedStrategies, handNotes — are preserved instead of being dropped by saveSavedRange
    // replacing the entry. Reading storage each save also picks up overlays written
    // elsewhere (e.g. the action editor) while this screen was open. comboSelections IS
    // edited here, so it is recomputed below and overrides the stored value.
    const existing = findSavedRangeById(draft.id);
    // Persist only in-range hands that are NOT fully selected (absence = all combos on),
    // mirroring the web; an all-on range keeps no field at all.
    const comboSelections: Record<PokerHand, string[]> = {};
    for (const hand of selected) {
      const selection = comboDraft[hand] ?? allCombosForHand(hand);
      if (selection.size < allCombosForHand(hand).size) {
        comboSelections[hand] = serializeComboSelection(selection);
      }
    }
    saveSavedRange({
      ...(existing ?? {}),
      id: draft.id,
      name,
      hands: [...selected],
      createdAt: draft.createdAt,
      updatedAt: new Date().toISOString(),
      metadata,
      comboSelections: Object.keys(comboSelections).length > 0 ? comboSelections : undefined,
    });
  }, [name, selected, metadata, comboDraft, draft]);

  const handleSetSelected = useCallback((hand: PokerHand, isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(hand);
      else next.delete(hand);
      return next;
    });
  }, []);

  const applyShortcut = useCallback((hands: PokerHand[]) => {
    setSelected((prev) => new Set(mergeShortcutHands([...prev], hands)));
  }, []);

  const onReplaceHands = useCallback((hands: PokerHand[]) => {
    setSelected(new Set(hands));
  }, []);

  const onToggleCombo = useCallback(
    (combo: Card[]) => {
      setComboDraft((prev) => {
        if (!activeComboHand) return prev;
        return {
          ...prev,
          [activeComboHand]: toggleCombo(prev[activeComboHand] ?? allCombosForHand(activeComboHand), combo),
        };
      });
    },
    [activeComboHand],
  );

  const handleClear = useCallback(() => {
    Alert.alert('Clear range', 'Remove all selected hands?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setSelected(new Set()) },
    ]);
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: idParam ? 'Edit range' : 'New range' }} />
      <TextInput
        testID="range-name-input"
        style={styles.nameInput}
        placeholder="Range name"
        placeholderTextColor={colors.text}
        value={name}
        onChangeText={setName}
      />
      <RangeStatsBar hands={[...selected]} />
      <RangeShortcuts onAddHands={applyShortcut} />
      <HandGrid selected={selected} onSetSelected={handleSetSelected} />
      {selected.size > 0 ? (
        <View style={styles.combosSection}>
          <Text style={styles.sectionTitle}>Refine combos</Text>
          <Text style={styles.sectionHint}>Tap an in-range hand to pick which combos stay in.</Text>
          <View style={styles.chips}>
            {ALL_HANDS.filter((hand) => selected.has(hand)).map((hand) => {
              const selection = comboDraft[hand];
              const refined = selection ? selection.size < allCombosForHand(hand).size : false;
              const active = activeComboHand === hand;
              return (
                <Pressable
                  key={hand}
                  testID={`refine-hand-${hand}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, refined && styles.chipRefined, active && styles.chipActive]}
                  onPress={() => setActiveComboHand((prev) => (prev === hand ? null : hand))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{hand}</Text>
                </Pressable>
              );
            })}
          </View>
          {activeComboHand && selected.has(activeComboHand) ? (
            <ComboSelector
              hand={activeComboHand}
              selection={comboDraft[activeComboHand] ?? allCombosForHand(activeComboHand)}
              onToggle={onToggleCombo}
            />
          ) : null}
        </View>
      ) : null}
      <RangeNotation selectedHands={[...selected]} onReplaceHands={onReplaceHands} />
      <RangeMetadataEditor value={metadata} onChange={setMetadata} />
      <Link href={{ pathname: '/action-editor', params: { id: draft.id } }} asChild>
        <Pressable testID="edit-actions" accessibilityRole="button" style={styles.actionsLink}>
          <Text style={styles.actionsLinkText}>Edit actions →</Text>
        </Pressable>
      </Link>
      <Link href={{ pathname: '/frequency-editor', params: { id: draft.id } }} asChild>
        <Pressable testID="edit-frequencies" accessibilityRole="button" style={styles.actionsLink}>
          <Text style={styles.actionsLinkText}>Edit frequencies →</Text>
        </Pressable>
      </Link>
      <Pressable
        testID="clear-range"
        accessibilityRole="button"
        style={styles.clearButton}
        onPress={handleClear}
      >
        <Text style={styles.clearText}>Clear range</Text>
      </Pressable>
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
  nameInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
  combosSection: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.text,
    fontSize: 13,
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
  chipRefined: {
    borderColor: colors.accent,
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
  actionsLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  actionsLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  clearText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
