import { StyleSheet, Text, View } from 'react-native';

import type { Card } from '@core/domain/cards';

import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';

const SUIT_GLYPHS: Record<Card['suit'], string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAMES: Record<Card['suit'], string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

/**
 * Two concrete playing-card faces for a drill prompt, using the 4-color deck tokens.
 *
 * Each face is one element with its own label ("A of spades"): the suit is drawn as a
 * glyph, which VoiceOver reads as punctuation or skips, so without the label the prompt
 * announced two bare ranks and the suits — half of what makes a hand suited — were lost.
 */
export function PlayingCards({ cards }: { cards: Card[] }) {
  const theme = useTheme();
  const suitColor: Record<Card['suit'], string> = {
    s: theme.spade,
    h: theme.heart,
    d: theme.diamond,
    c: theme.club,
  };
  return (
    <View testID="playing-cards" style={styles.row}>
      {cards.map((card) => (
        <View
          key={card.rank + card.suit}
          testID={`card-${card.rank}${card.suit}`}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
          style={[styles.card, { backgroundColor: theme.cardface, borderColor: theme.line2 }]}
        >
          <Text style={[styles.rank, { color: suitColor[card.suit] }]}>{card.rank}</Text>
          <Text style={[styles.suit, { color: suitColor[card.suit] }]}>{SUIT_GLYPHS[card.suit]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  card: {
    width: 92,
    height: 130,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  rank: { fontFamily: fonts.display, fontSize: 44 },
  suit: { fontSize: 34, lineHeight: 36 },
});
