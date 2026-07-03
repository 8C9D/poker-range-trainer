import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import {
  formatCard,
  RANKS,
  SUITS,
  type Card,
  type Rank,
  type Suit,
} from '@core/domain/cards';
import {
  FLOP_TEXTURE_TAGS,
  tagFlopTexture,
  type FlopTextureTag,
} from '@core/domain/boardTexture';

import { colors } from '../theme/colors';

/** Display labels for the flop texture tags (UI only — @core has no labels). */
const TAG_LABELS: Record<FlopTextureTag, string> = {
  aceHigh: 'Ace-high',
  paired: 'Paired',
  monotone: 'Monotone',
  twoTone: 'Two-tone',
  rainbow: 'Rainbow',
  connected: 'Connected',
  wet: 'Wet',
  dry: 'Dry',
};

const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

interface Slot {
  rank: Rank | null;
  suit: Suit | null;
}

const EMPTY_SLOTS: Slot[] = [
  { rank: null, suit: null },
  { rank: null, suit: null },
  { rank: null, suit: null },
];

function isComplete(slot: Slot): slot is { rank: Rank; suit: Suit } {
  return slot.rank !== null && slot.suit !== null;
}

/**
 * Board explorer (M6): enter a three-card flop with rank + suit tiles and see its texture
 * tags. The first incomplete slot is the active one; tapping a rank then a suit fills it and
 * the next slot becomes active. All texture logic reuses `@core/domain/boardTexture`
 * (`tagFlopTexture`) over the reused `Card` type — the screen only gathers the cards.
 */
export default function BoardScreen() {
  const [slots, setSlots] = useState<Slot[]>(EMPTY_SLOTS);

  const activeIndex = slots.findIndex((slot) => !isComplete(slot));

  const setActiveRank = useCallback((rank: Rank) => {
    setSlots((prev) => {
      const index = prev.findIndex((slot) => !isComplete(slot));
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = { ...next[index], rank };
      return next;
    });
  }, []);

  const setActiveSuit = useCallback((suit: Suit) => {
    setSlots((prev) => {
      const index = prev.findIndex((slot) => !isComplete(slot));
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = { ...next[index], suit };
      return next;
    });
  }, []);

  const clearSlot = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { rank: null, suit: null };
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSlots(EMPTY_SLOTS), []);

  // Assemble the completed cards and derive the texture once the flop is full and distinct.
  const cards = useMemo<Card[]>(
    () => slots.filter(isComplete).map((slot) => ({ rank: slot.rank, suit: slot.suit })),
    [slots],
  );
  const full = cards.length === 3;
  const duplicate = full && new Set(cards.map(formatCard)).size < 3;
  const tags = useMemo<FlopTextureTag[]>(
    () => (full && !duplicate ? tagFlopTexture(cards) : []),
    [cards, full, duplicate],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Board explorer' }} />
      <Text style={styles.hint}>Tap a rank and a suit to fill each card.</Text>

      <View style={styles.slots}>
        {slots.map((slot, index) => {
          const label = isComplete(slot)
            ? `${slot.rank}${SUIT_SYMBOLS[slot.suit]}`
            : `${slot.rank ?? ''}${slot.suit ? SUIT_SYMBOLS[slot.suit] : ''}` || '—';
          return (
            <Pressable
              key={index}
              testID={`board-slot-${index}`}
              accessibilityRole="button"
              onPress={() => clearSlot(index)}
              style={[styles.slot, index === activeIndex && styles.slotActive]}
            >
              <Text style={styles.slotText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.pickerRow}>
        {RANKS.map((rank) => (
          <Pressable
            key={rank}
            testID={`rank-${rank}`}
            accessibilityRole="button"
            style={styles.pickChip}
            onPress={() => setActiveRank(rank)}
          >
            <Text style={styles.pickText}>{rank}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pickerRow}>
        {SUITS.map((suit) => (
          <Pressable
            key={suit}
            testID={`suit-${suit}`}
            accessibilityRole="button"
            style={styles.pickChip}
            onPress={() => setActiveSuit(suit)}
          >
            <Text style={[styles.pickText, (suit === 'h' || suit === 'd') && styles.redSuit]}>
              {SUIT_SYMBOLS[suit]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable testID="board-clear" accessibilityRole="button" style={styles.clear} onPress={clearAll}>
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>

      {duplicate ? (
        <Text testID="board-error" style={styles.error}>
          Duplicate card — each card must be different.
        </Text>
      ) : null}

      {tags.length > 0 ? (
        <View testID="board-texture" style={styles.texture}>
          <Text style={styles.textureTitle}>Texture</Text>
          <View style={styles.tags}>
            {FLOP_TEXTURE_TAGS.filter((tag) => tags.includes(tag)).map((tag) => (
              <Text key={tag} testID={`texture-tag-${tag}`} style={styles.tag}>
                {TAG_LABELS[tag]}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 20,
  },
  hint: {
    color: colors.text,
    fontSize: 14,
  },
  slots: {
    flexDirection: 'row',
    gap: 12,
  },
  slot: {
    width: 64,
    height: 88,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  slotText: {
    color: colors.textStrong,
    fontSize: 24,
    fontWeight: '700',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickChip: {
    minWidth: 36,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickText: {
    color: colors.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  redSuit: {
    color: '#f87171',
  },
  clear: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  clearText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  texture: {
    gap: 8,
  },
  textureTitle: {
    color: colors.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    color: colors.textStrong,
    fontSize: 13,
    fontWeight: '600',
  },
});
