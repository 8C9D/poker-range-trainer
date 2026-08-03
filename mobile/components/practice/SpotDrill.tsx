import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { drawPracticeCombo } from '@core/domain/blockerPractice';
import type { Card } from '@core/domain/cards';
import { explainHand } from '@core/domain/missExplanation';
import { createPracticeAttempt } from '@core/domain/practice';
import { describeSpot, spotKey } from '@core/domain/spot';
import {
  coveredSpots,
  drawSpotPrompt,
  nextChainedSpot,
  summarizeSpotSession,
  type AnsweredSpot,
  type SpotPrompt,
  type SpotSessionResult,
} from '@core/domain/spotDrill';
import type { PracticeAttempt } from '@core/types/practice';
import type { SavedRange, TableSize } from '@core/types/range';

import { resolveSwipeAnswer } from '../swipeAnswer';
import { useAnnouncedPrompt } from './announcePrompt';
import { OverlayFrame } from './OverlayFrame';
import { PlayingCards } from './PlayingCards';
import {
  DRILL_QUESTION_COUNT,
  HIT_DWELL_MS,
  holdsForAcknowledgement,
} from '../../lib/drillPacing';
import { answerVerbs, feedbackLine } from '../../lib/scenario';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

/** One dealt question: the spot, its cards, and whether it continues a previous hand. */
type Question = SpotPrompt & { cards: Card[]; chained: boolean };

interface SpotDrillProps {
  /** The whole library; the drill picks the range each spot needs. */
  ranges: SavedRange[];
  tableSize: TableSize;
  stackDepthBb: number;
  /** When set, only these spots are dealt (drilling one weak spot). */
  spotKeys?: string[];
  questionCount?: number;
  /** Called with the finished session, cut by range and by spot. */
  onFinish: (result: SpotSessionResult) => void;
  random?: () => number;
}

/**
 * The v8.2 spot drill (mobile port of the web `SpotDrill`): the table deals the
 * situation, not the range. Each question states a spot in plain words, deals a hand,
 * and grades the answer against whichever saved range covers that spot. Attempts are
 * grouped by range so they fold into the same per-range stats as every other drill.
 */
export function SpotDrill({
  ranges,
  tableSize,
  stackDepthBb,
  spotKeys,
  questionCount = DRILL_QUESTION_COUNT,
  onFinish,
  random = Math.random,
}: SpotDrillProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const covered = useMemo(() => {
    const all = coveredSpots(ranges, tableSize, stackDepthBb);
    // A restricted run also has no follow-ups to chain into, which is what
    // drilling one weak spot should do.
    return spotKeys ? all.filter((entry) => spotKeys.includes(spotKey(entry.spot))) : all;
  }, [ranges, tableSize, stackDepthBb, spotKeys]);

  function draw(): Question | null {
    const next = drawSpotPrompt(covered, random);
    if (!next) return null;
    return {
      ...next,
      cards: drawPracticeCombo([next.hand], [], undefined, random),
      chained: false,
    };
  }

  /**
   * The same hand carried into the second decision, when the user played it correctly
   * and the library covers what comes next. Folding — or a wrong answer — ends the hand.
   */
  function chain(current: Question, attempt: PracticeAttempt): Question | null {
    if (!attempt.correct || !attempt.expectedInRange) return null;
    const next = nextChainedSpot(current.spot, covered, random);
    return next ? { ...next, hand: current.hand, cards: current.cards, chained: true } : null;
  }

  const [prompt, setPrompt] = useState(draw);
  useAnnouncedPrompt(prompt ? `${describeSpot(prompt.spot)} ${prompt.hand}` : '');
  const [answered, setAnswered] = useState<AnsweredSpot[]>([]);
  const [feedback, setFeedback] = useState<PracticeAttempt | null>(null);
  const answeredRef = useRef(answered);
  const finishedRef = useRef(false);
  const dwellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current);
    },
    [],
  );

  function finish(final: AnsweredSpot[]) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current);
    onFinish(summarizeSpotSession(final));
  }

  /** Move to the follow-up spot (or a fresh deal), or end a finished session. */
  function advance(from: Question, attempt: PracticeAttempt) {
    if (finishedRef.current) return;
    if (dwellTimeoutRef.current !== null) {
      clearTimeout(dwellTimeoutRef.current);
      dwellTimeoutRef.current = null;
    }
    const played = answeredRef.current;
    if (played.length >= questionCount) {
      finish(played);
      return;
    }
    setFeedback(null);
    setPrompt(chain(from, attempt) ?? draw());
  }

  function answer(userAnsweredInRange: boolean) {
    if (!prompt || feedback !== null || finishedRef.current) return;
    const attempt = createPracticeAttempt(prompt.hand, prompt.range.hands, userAnsweredInRange);
    const next = [
      ...answered,
      { rangeId: prompt.range.id, spotKey: spotKey(prompt.spot), attempt },
    ];
    setAnswered(next);
    answeredRef.current = next;
    setFeedback(attempt);
    // A miss stays up until the user continues; the explanation is the lesson.
    if (holdsForAcknowledgement(false, attempt.correct)) return;
    dwellTimeoutRef.current = setTimeout(() => advance(prompt, attempt), HIT_DWELL_MS);
  }

  const holding = feedback !== null && holdsForAcknowledgement(false, feedback.correct);

  // Keep the latest answer handler in a ref so the long-lived swipe gesture reads it
  // without being rebuilt each render (mirrors RecognitionDrill's pattern).
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  /* eslint-disable react-hooks/refs -- the gesture callback runs at gesture time, never
     during render; it reads answerRef for the latest handler. */
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onEnd((event) => {
          const choice = resolveSwipeAnswer(event.translationX);
          if (choice === null) return;
          answerRef.current(choice === 'in');
          void Haptics.selectionAsync();
        }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  if (!prompt) {
    return (
      <OverlayFrame title="Play the spot" onClose={() => finish([])}>
        <View style={styles.body}>
          <View style={styles.center}>
            <Text testID="spot-drill-empty" style={styles.scenario}>
              None of your saved ranges covers a spot at this table size and stack depth. Fill a
              gap on the coverage map and the table will start dealing.
            </Text>
          </View>
        </View>
      </OverlayFrame>
    );
  }

  const verbs = answerVerbs(prompt.range);

  return (
    <OverlayFrame
      title="Play the spot"
      progress={answered.length / questionCount}
      onClose={() => finish(answeredRef.current)}
    >
      <View style={styles.body}>
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.center}>
            {prompt.chained ? (
              <Text testID="spot-chain" style={styles.chain}>
                Same hand — the action continues.
              </Text>
            ) : null}
            <Text testID="spot-scenario" style={styles.scenario}>
              {describeSpot(prompt.spot)}
            </Text>
            <PlayingCards cards={prompt.cards} />
            <Text testID="drill-hand" style={styles.srOnly}>
              {prompt.hand}
            </Text>
            <View style={styles.feedbackSlot}>
              {feedback ? (
                <>
                  <Text
                    testID="drill-feedback"
                    style={[styles.feedback, { color: feedback.correct ? theme.good : theme.bad }]}
                  >
                    {feedbackLine(feedback.hand, feedback.expectedInRange, feedback.correct, verbs)}
                  </Text>
                  {/* Naming the chart is half the lesson: the spot maps to THIS range. */}
                  <Text testID="drill-why" style={styles.why}>
                    {feedback.correct
                      ? `That spot is your “${prompt.range.name}”.`
                      : `${explainHand(feedback.hand, prompt.range.hands).line} (from “${prompt.range.name}”)`}
                  </Text>
                </>
              ) : (
                <Text style={styles.swipeHint}>
                  Swipe right to {verbs.yes.toLowerCase()}, left to fold
                </Text>
              )}
            </View>
          </View>
        </GestureDetector>
        <View style={styles.answers}>
          {holding && feedback ? (
            <Pressable
              testID="drill-next"
              accessibilityRole="button"
              style={[styles.answer, styles.answerNext]}
              onPress={() => advance(prompt, feedback)}
            >
              <Text style={styles.answerNextText}>Next</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                testID="answer-yes"
                disabled={feedback !== null}
                style={[
                  styles.answer,
                  styles.answerNeutral,
                  feedback !== null && styles.answerDisabled,
                ]}
                onPress={() => answer(true)}
              >
                <Text style={styles.answerNeutralText}>{verbs.yes}</Text>
              </Pressable>
              <Pressable
                testID="answer-no"
                disabled={feedback !== null}
                style={[styles.answer, styles.answerNeutral, feedback !== null && styles.answerDisabled]}
                onPress={() => answer(false)}
              >
                <Text style={styles.answerNeutralText}>{verbs.no}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </OverlayFrame>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1, padding: 20, gap: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
    scenario: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2, textAlign: 'center' },
    // Marks the second decision of a chained spot, so the same cards don't read as
    // a new hand.
    chain: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12.5,
      color: theme.accentStrong,
      textAlign: 'center',
      marginBottom: -12,
    },
    srOnly: { width: 1, height: 1, opacity: 0, position: 'absolute' },
    // Tall enough for the second line, so scoring an answer never shifts the cards.
    feedbackSlot: {
      minHeight: 76,
      gap: 4,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    feedback: { fontFamily: fonts.bodySemibold, fontSize: 17, textAlign: 'center' },
    why: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      color: theme.ink2,
      textAlign: 'center',
    },
    swipeHint: { fontFamily: fonts.body, fontSize: 12.5, color: theme.ink3, textAlign: 'center' },
    answers: { flexDirection: 'row', gap: 12, paddingTop: 8 },
    answer: {
      flex: 1,
      minHeight: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    // The two answers are peers, so they are drawn as peers: gold is the
    // "single primary action" fill, and on the yes button it nudged the very
    // judgement the drill exists to measure.
    answerNeutral: { backgroundColor: theme.card, borderColor: theme.line2 },
    // "Next" replaces both answers, so it IS the single action on the screen.
    answerNext: { backgroundColor: theme.goldFill, borderColor: theme.goldFill },
    answerDisabled: { opacity: 0.85 },
    answerNextText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: theme.onAccent },
    answerNeutralText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: theme.ink },
  });
}
