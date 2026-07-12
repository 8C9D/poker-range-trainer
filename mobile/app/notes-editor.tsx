import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ALL_HANDS, type PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById, saveSavedRange } from '@core/storage/rangeStorage';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * Per-hand notes editor for one saved range (M6 / web v5): pick an in-range hand, then attach a
 * free-text note to it. Notes live-save onto the range as the `handNotes` overlay through the
 * reused `@core/storage` (which trims, drops blanks, and collapses an empty map to absent),
 * preserving the range's other overlays. Reached from an "Edit notes" link in the binary editor —
 * the notes analogue of the action / frequency editors.
 */
export default function NotesEditorScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const orderedHands = useMemo(() => {
    const handSet = new Set(range?.hands ?? []);
    return ALL_HANDS.filter((hand) => handSet.has(hand));
  }, [range]);

  const [handNotes, setHandNotes] = useState<Record<PokerHand, string>>(
    () => range?.handNotes ?? ({} as Record<PokerHand, string>),
  );
  const [activeHand, setActiveHand] = useState<PokerHand | null>(() => orderedHands[0] ?? null);

  // Live-save the notes overlay, skipping the first run so merely opening the screen does not
  // rewrite updatedAt. Spreads the loaded range so other overlays (handActions, mixedStrategies,
  // comboSelections, favorite, …) survive; storage normalizes/drops blank notes.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!range) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveSavedRange({ ...range, handNotes, updatedAt: new Date().toISOString() });
  }, [handNotes, range]);

  const setNote = useCallback(
    (text: string) => {
      if (!activeHand) return;
      setHandNotes((prev) => {
        const next = { ...prev };
        // A non-blank note sets the entry; a blank one removes it so the map never carries
        // stray keys (storage trims/drops on save too).
        if (text.trim().length > 0) next[activeHand] = text;
        else delete next[activeHand];
        return next;
      });
    },
    [activeHand],
  );

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Edit notes' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit notes' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>

      {orderedHands.length === 0 ? (
        <Text testID="no-hands" style={styles.notFound}>
          Add hands to the range first, then attach notes.
        </Text>
      ) : (
        <>
          <Text style={styles.hint}>Pick a hand, then write a note for it.</Text>
          <View style={styles.chips}>
            {orderedHands.map((hand) => {
              const hasNote = (handNotes[hand] ?? '').trim().length > 0;
              const active = activeHand === hand;
              return (
                <Pressable
                  key={hand}
                  testID={`notes-hand-${hand}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, hasNote && styles.chipHasNote, active && styles.chipActive]}
                  onPress={() => setActiveHand(hand)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{hand}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeHand ? (
            <View style={styles.field}>
              <Text style={styles.label}>Note for {activeHand}</Text>
              <TextInput
                testID="note-input"
                style={styles.input}
                value={handNotes[activeHand] ?? ''}
                onChangeText={setNote}
                placeholder={`Optional note for ${activeHand}`}
                placeholderTextColor={theme.ink3}
                multiline
              />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    notFound: {
      color: theme.ink2,
      fontSize: 16,
      marginTop: 48,
      textAlign: 'center',
    },
    rangeName: {
      color: theme.ink,
      fontSize: 18,
      fontWeight: '700',
    },
    hint: {
      color: theme.ink2,
      fontSize: 14,
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
    chipHasNote: {
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
    field: {
      gap: 6,
    },
    label: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 80,
      fontSize: 15,
      color: theme.ink,
      backgroundColor: theme.card,
      textAlignVertical: 'top',
    },
  });
}
