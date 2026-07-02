import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { assignedHands } from '@core/domain/actionRange';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';
import type { RangeAction } from '@core/types/range';

import { ActionGrid } from '../components/ActionGrid';
import { ActionPalette } from '../components/ActionPalette';
import { colors } from '../theme/colors';

/**
 * Multi-action editor for one saved range: assign a single `RangeAction` per hand (the
 * `handActions` overlay), on top of the binary in/out selection. Pick the active action in
 * the palette, then tap grid cells to assign it. Assignments live-save onto the range
 * through the reused `@core/storage` (preserving the range's other fields). Reached from an
 * "Edit actions" link in the binary editor.
 */
export default function ActionEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const [handActions, setHandActions] = useState<Record<PokerHand, RangeAction>>(
    () => range?.handActions ?? ({} as Record<PokerHand, RangeAction>),
  );
  const [activeAction, setActiveAction] = useState<RangeAction>('raise');

  // Live-save the action overlay onto the range, skipping the first run so merely opening
  // the screen does not rewrite the range's updatedAt. Spreads the full loaded range so all
  // other fields (hands, metadata, favorite, …) are preserved.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!range) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveSavedRange({ ...range, handActions, updatedAt: new Date().toISOString() });
  }, [handActions, range]);

  const assign = useCallback((hand: PokerHand, action: RangeAction | null) => {
    setHandActions((prev) => {
      const next = { ...prev };
      if (action === null) delete next[hand];
      else next[hand] = action;
      return next;
    });
  }, []);

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Edit actions' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit actions' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>
      <ActionPalette active={activeAction} onSelect={setActiveAction} />
      <ActionGrid handActions={handActions} activeAction={activeAction} onAssign={assign} />
      <Text testID="assigned-count" style={styles.count}>
        {assignedHands(handActions).length} hands assigned
      </Text>
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
  },
  rangeName: {
    color: colors.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  count: {
    color: colors.text,
    fontSize: 14,
  },
});
