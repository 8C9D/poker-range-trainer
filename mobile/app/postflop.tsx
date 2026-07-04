import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { formatCard } from '@core/domain/cards';
import { HAND_CATEGORIES, type HandCategory } from '@core/domain/handCategory';
import type { PokerHand } from '@core/domain/pokerHands';
import {
  describeHeroHand,
  POSTFLOP_DECISIONS,
  POSTFLOP_DECISION_LABELS,
  type PostflopDecision,
  type PostflopScenario,
} from '@core/domain/postflopScenario';
import { findSavedRangeById } from '@core/storage/rangeStorage';

import { dealPostflopScenario, scorePostflopDecision, type PostflopScore } from '../components/postflopDrill';
import { colors } from '../theme/colors';

/** Display labels for the made-hand / draw categories (UI only — @core has no labels). */
const CATEGORY_LABELS: Record<HandCategory, string> = {
  set: 'Set',
  trips: 'Trips',
  twoPair: 'Two pair',
  overpair: 'Overpair',
  topPair: 'Top pair',
  middlePair: 'Middle pair',
  bottomPair: 'Bottom pair',
  pair: 'Pair',
  flushDraw: 'Flush draw',
  straightDraw: 'Straight draw',
  air: 'Air',
};

// Stable empty list so a missing range keeps a referentially-stable `hands`.
const EMPTY_HANDS: PokerHand[] = [];

/**
 * Postflop decision practice for one saved range (M6): deal a random spot (a hand from the
 * range on a random flop, facing a random action), let the user pick bet/check/call/raise/
 * fold, and grade it against the `@core` teaching heuristic. Scenario sourcing + scoring
 * reuse `dealPostflopScenario` / `scorePostflopDecision` (over `buildPostflopScenario` +
 * `suggestDecision`); `describeHeroHand` shows what the hero has. Running stats accumulate
 * across spots; no persistence (the heuristic is a guide, not graded truth).
 */
export default function PostflopScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const hands = range?.hands ?? EMPTY_HANDS;
  const [scenario, setScenario] = useState<PostflopScenario | null>(() =>
    hands.length > 0 ? dealPostflopScenario(hands) : null,
  );
  const [lastScore, setLastScore] = useState<PostflopScore | null>(null);
  const [total, setTotal] = useState(0);
  const [correct, setCorrect] = useState(0);

  const answer = useCallback(
    (decision: PostflopDecision) => {
      if (!scenario || lastScore) return;
      const score = scorePostflopDecision(scenario, decision);
      setLastScore(score);
      setTotal((value) => value + 1);
      if (score.correct) setCorrect((value) => value + 1);
    },
    [scenario, lastScore],
  );

  const nextSpot = useCallback(() => {
    setScenario(dealPostflopScenario(hands));
    setLastScore(null);
  }, [hands]);

  const categories = useMemo(
    () => (scenario ? describeHeroHand(scenario) : []),
    [scenario],
  );

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Postflop spot' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  if (!scenario) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Postflop spot' }} />
        <Text testID="no-hands" style={styles.notFound}>
          No hands in this range — add some in the editor first.
        </Text>
      </View>
    );
  }

  const accuracy = accuracyPercentage(correct, total);
  const categoryLabel =
    HAND_CATEGORIES.filter((category) => categories.includes(category))
      .map((category) => CATEGORY_LABELS[category])
      .join(', ') || '—';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Postflop spot' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>

      <View style={styles.spot}>
        <Text testID="postflop-hero" style={styles.hero}>
          {scenario.heroHand.map(formatCard).join(' ')}
        </Text>
        <Text testID="postflop-flop" style={styles.flop}>
          {scenario.flop.map(formatCard).join(' ')}
        </Text>
        <Text testID="postflop-category" style={styles.category}>
          {categoryLabel}
        </Text>
        <Text testID="postflop-context" style={styles.context}>
          Pot {scenario.potSize} · Stack {scenario.stackDepth} · Facing: {scenario.facing}
        </Text>
      </View>

      <View style={styles.decisions}>
        {POSTFLOP_DECISIONS.map((decision) => (
          <Pressable
            key={decision}
            testID={`postflop-decision-${decision}`}
            accessibilityRole="button"
            disabled={lastScore !== null}
            style={[styles.decisionButton, lastScore !== null && styles.decisionButtonDisabled]}
            onPress={() => answer(decision)}
          >
            <Text style={styles.decisionButtonText}>{POSTFLOP_DECISION_LABELS[decision]}</Text>
          </Pressable>
        ))}
      </View>

      {lastScore ? (
        <View style={styles.feedbackCard}>
          <Text
            testID="postflop-feedback"
            style={[styles.feedback, lastScore.correct ? styles.feedbackCorrect : styles.feedbackWrong]}
          >
            {lastScore.correct ? 'Matches the heuristic.' : 'Differs from the heuristic.'} Suggests{' '}
            {POSTFLOP_DECISION_LABELS[lastScore.suggested]}.
          </Text>
          <Text style={styles.rationale}>{lastScore.rationale}</Text>
          <Pressable
            testID="postflop-next"
            accessibilityRole="button"
            style={styles.nextButton}
            onPress={nextSpot}
          >
            <Text style={styles.nextButtonText}>Next spot</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.prompt}>What is your play?</Text>
      )}

      <View style={styles.stats}>
        <Text testID="stat-total" style={styles.stat}>
          Total: {total}
        </Text>
        <Text testID="stat-correct" style={styles.stat}>
          Correct: {correct}
        </Text>
        <Text testID="stat-accuracy" style={styles.stat}>
          Accuracy: {accuracy.toFixed(0)}%
        </Text>
      </View>
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
  notFound: {
    color: colors.text,
    fontSize: 16,
    marginTop: 48,
    textAlign: 'center',
  },
  rangeName: {
    color: colors.text,
    fontSize: 16,
  },
  spot: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: 'center',
  },
  hero: {
    color: colors.textStrong,
    fontSize: 40,
    fontWeight: '700',
  },
  flop: {
    color: colors.textStrong,
    fontSize: 28,
    fontWeight: '600',
  },
  category: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  context: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  decisions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  decisionButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  decisionButtonDisabled: {
    opacity: 0.4,
  },
  decisionButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '600',
  },
  prompt: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  feedback: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackCorrect: {
    color: colors.accent,
  },
  feedbackWrong: {
    color: colors.danger,
  },
  rationale: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  nextButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  nextButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  stat: {
    color: colors.text,
    fontSize: 14,
  },
});
