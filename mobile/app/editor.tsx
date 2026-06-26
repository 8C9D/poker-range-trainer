import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { PokerHand } from '@core/domain/pokerHands';
import { mergeShortcutHands } from '@core/domain/rangeShortcuts';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { HandGrid } from '../components/HandGrid';
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
      return { id: existing.id, createdAt: existing.createdAt, name: existing.name, hands: existing.hands };
    }
    const now = new Date().toISOString();
    return { id: idParam ?? createRangeId(), createdAt: now, name: '', hands: [] as PokerHand[] };
  });

  const [name, setName] = useState(draft.name);
  const [selected, setSelected] = useState<Set<PokerHand>>(() => new Set(draft.hands));

  // Skip the first effect run so merely opening an existing range does not rewrite
  // its updatedAt; every later change live-saves.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveSavedRange({
      id: draft.id,
      name,
      hands: [...selected],
      createdAt: draft.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }, [name, selected, draft]);

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
      <RangeNotation selectedHands={[...selected]} onReplaceHands={onReplaceHands} />
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
