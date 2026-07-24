import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';

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

import { ComboSelector } from './ComboSelector';
import { HandGrid } from './HandGrid';
import { RangeCsv } from './RangeCsv';
import { RangeMetadataEditor } from './RangeMetadataEditor';
import { RangeNotation } from './RangeNotation';
import { RangeShortcuts } from './RangeShortcuts';
import { RangeStatsBar } from './RangeStatsBar';
import { RangeTagEditor } from './RangeTagEditor';
import { createRangeId } from '../platform/createRangeId';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

interface RangeEditorProps {
  /** Existing range id to edit, or undefined to start a fresh draft. */
  id?: string;
  /** Show the per-hand notes link (hidden when notes live in a sibling tab). */
  showNotesLink?: boolean;
}

/**
 * The range editor body: name, live stats, shortcuts, 13x13 tap + drag-paint grid,
 * per-hand-class combo refinement, notation import/export, CSV, scenario metadata, and
 * a clear action. Name + hand selection are live-saved through the reused `@core/storage`
 * (no explicit save step). Extracted from the old editor route so both the flat editor
 * screen and the Range page's Edit tab share one implementation.
 */
export function RangeEditor({ id: idParam, showNotesLink = true }: RangeEditorProps) {
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
        comboSelections: existing.comboSelections,
        tags: existing.tags ?? [],
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
      tags: [] as string[],
    };
  });

  const [name, setName] = useState(draft.name);
  const [selected, setSelected] = useState<Set<PokerHand>>(() => new Set(draft.hands));
  const [metadata, setMetadata] = useState<RangeMetadata>(draft.metadata);
  const [tags, setTags] = useState<string[]>(draft.tags);
  const [comboDraft, setComboDraft] = useState<Record<PokerHand, ComboSelection>>(() => {
    const seed: Record<PokerHand, ComboSelection> = {};
    for (const hand of draft.hands) {
      const saved = draft.comboSelections?.[hand];
      if (saved) seed[hand] = deserializeComboSelection(saved);
    }
    return seed;
  });
  const [activeComboHand, setActiveComboHand] = useState<PokerHand | null>(null);

  // Skip the first effect run so merely opening an existing range does not rewrite its
  // updatedAt; every later change live-saves.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    // Merge the edited fields onto the *current stored* range (read fresh each save) so
    // overlay fields this screen doesn't edit — handActions, favorite, archived, source,
    // mixedStrategies, handNotes — are preserved.
    const existing = findSavedRangeById(draft.id);
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
      // Overrides the spread's stored tags; storage drops the field when empty.
      tags,
    });
  }, [name, selected, metadata, comboDraft, tags, draft]);

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

  const onImportCsv = useCallback((result: { name?: string; hands: PokerHand[] }) => {
    if (result.name !== undefined) setName(result.name);
    setSelected(new Set(result.hands));
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
    <View style={styles.content}>
      <TextInput
        testID="range-name-input"
        style={styles.nameInput}
        placeholder="Range name"
        placeholderTextColor={theme.ink3}
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
      <RangeCsv name={name} hands={[...selected]} onImport={onImportCsv} />
      <RangeMetadataEditor value={metadata} onChange={setMetadata} />
      <RangeTagEditor tags={tags} onChange={setTags} />
      {showNotesLink ? (
        <Link href={{ pathname: '/notes-editor', params: { id: draft.id } }} asChild>
          <Pressable testID="edit-notes" accessibilityRole="button" style={styles.actionsLink}>
            <Text style={styles.actionsLinkText}>Edit hand notes →</Text>
          </Pressable>
        </Link>
      ) : null}
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
    combosSection: {
      gap: 10,
    },
    sectionTitle: {
      color: theme.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    sectionHint: {
      color: theme.ink2,
      fontSize: 13,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipRefined: {
      borderColor: theme.accent,
    },
    chipActive: {
      backgroundColor: theme.goldFill,
      borderColor: theme.goldFill,
    },
    chipText: {
      color: theme.ink2,
      fontSize: 13,
      fontWeight: '600',
    },
    chipTextActive: {
      color: theme.onAccent,
    },
    actionsLink: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    actionsLinkText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '600',
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
