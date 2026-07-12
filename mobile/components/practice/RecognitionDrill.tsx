import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { drawPracticeCombo } from '@core/domain/blockerPractice';
import type { Card } from '@core/domain/cards';
import { createPracticeAttempt, getRandomHandFrom, getRandomPracticeHand } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { DEFAULT_DRILL_SECONDS, getRemainingSeconds, isDrillOver } from '@core/domain/timedDrill';
import { getWeaknessFocusedHand } from '@core/domain/weaknessDrill';
import type { PracticeAttempt } from '@core/types/practice';
import type { SavedRange } from '@core/types/range';

import { resolveSwipeAnswer } from '../swipeAnswer';
import { OverlayFrame } from './OverlayFrame';
import { PlayingCards } from './PlayingCards';
import { answerVerbs, feedbackLine, scenarioLine } from '../../lib/scenario';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

/** Questions per (non-timed) drill: short sessions with a visible end. */
export const DRILL_QUESTION_COUNT = 20;
/** Correct answers advance quickly; misses hold so the explanation is read. */
export const HIT_DWELL_MS = 900;
export const MISS_DWELL_MS = 1600;
/** Under the clock, feedback flashes faster. */
export const TIMED_HIT_DWELL_MS = 500;
export const TIMED_MISS_DWELL_MS = 1000;

interface Prompt {
  hand: PokerHand;
  cards: Card[];
}

interface RecognitionDrillProps {
  range: SavedRange;
  /** standard = random hands (or handPool); weakness = mistakes weighted; timed = against the clock. */
  variant: 'standard' | 'weakness' | 'timed';
  /** When non-empty, standard prompts are drawn only from these hands. */
  handPool?: PokerHand[];
  durationSeconds?: number;
  questionCount?: number;
  /** Queue position, e.g. "2/5"; shown in the top bar. */
  position?: string | null;
  /** Called with the scored attempts when the session ends (answered out, timer, or close). */
  onFinish: (attempts: PracticeAttempt[]) => void;
}

/**
 * The full-screen recognition drill: concrete playing cards, a scenario line, and two
 * fixed-position answer buttons using the range's action verb. Every answer scores
 * instantly with explanatory feedback; misses dwell longer than hits before auto-advancing.
 * Swipe right = in range, left = fold, each confirmed with a light haptic. The mobile port
 * of the web RecognitionDrill.
 */
export function RecognitionDrill({
  range,
  variant,
  handPool,
  durationSeconds = DEFAULT_DRILL_SECONDS,
  questionCount = DRILL_QUESTION_COUNT,
  position = null,
  onFinish,
}: RecognitionDrillProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const verbs = answerVerbs(range);
  const scenario = scenarioLine(range);

  function drawPrompt(prevAttempts: PracticeAttempt[]): Prompt {
    const hand =
      variant === 'weakness'
        ? getWeaknessFocusedHand(prevAttempts)
        : handPool && handPool.length > 0
          ? getRandomHandFrom(handPool)
          : getRandomPracticeHand();
    return { hand, cards: drawPracticeCombo([hand]) };
  }

  const [prompt, setPrompt] = useState<Prompt>(() => drawPrompt([]));
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [feedback, setFeedback] = useState<PracticeAttempt | null>(null);
  const attemptsRef = useRef(attempts);
  const finishedRef = useRef(false);
  const dwellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [startMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(startMs);
  useEffect(() => {
    if (variant !== 'timed') return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [variant]);

  function finish(finalAttempts: PracticeAttempt[]) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current);
    onFinish(finalAttempts);
  }

  const timedOver = variant === 'timed' && isDrillOver(startMs, durationSeconds, nowMs);
  useEffect(() => {
    if (timedOver) finish(attemptsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOver]);

  useEffect(
    () => () => {
      if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current);
    },
    [],
  );

  function answer(userAnsweredInRange: boolean) {
    if (feedback !== null || finishedRef.current) return;
    const attempt = createPracticeAttempt(prompt.hand, range.hands, userAnsweredInRange);
    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);
    attemptsRef.current = nextAttempts;
    setFeedback(attempt);
    const dwell =
      variant === 'timed'
        ? attempt.correct
          ? TIMED_HIT_DWELL_MS
          : TIMED_MISS_DWELL_MS
        : attempt.correct
          ? HIT_DWELL_MS
          : MISS_DWELL_MS;
    dwellTimeoutRef.current = setTimeout(() => {
      dwellTimeoutRef.current = null;
      if (finishedRef.current) return;
      if (variant !== 'timed' && nextAttempts.length >= questionCount) {
        finish(nextAttempts);
        return;
      }
      setFeedback(null);
      setPrompt(drawPrompt(nextAttempts));
    }, dwell);
  }

  // Keep the latest answer handler in a ref so the long-lived swipe gesture reads it
  // without being rebuilt each render (mirrors HandGrid's gesture ref pattern).
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

  const remainingSeconds =
    variant === 'timed' ? getRemainingSeconds(startMs, durationSeconds, nowMs) : null;
  const progress =
    variant === 'timed'
      ? 1 - (remainingSeconds ?? 0) / durationSeconds
      : attempts.length / questionCount;

  return (
    <OverlayFrame
      title={range.name || 'Untitled'}
      position={position}
      progress={progress}
      onClose={() => finish(attemptsRef.current)}
    >
      <View style={styles.body}>
        {remainingSeconds !== null ? (
          <Text style={styles.timer} accessibilityLabel="Time remaining">
            {remainingSeconds}s left
          </Text>
        ) : null}
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.center}>
            {scenario ? <Text style={styles.scenario}>{scenario}</Text> : null}
            <PlayingCards cards={prompt.cards} />
            <Text testID="drill-hand" style={styles.srOnly}>
              {prompt.hand}
            </Text>
            <View style={styles.feedbackSlot}>
              {feedback ? (
                <Text
                  testID="drill-feedback"
                  style={[styles.feedback, { color: feedback.correct ? theme.good : theme.bad }]}
                >
                  {feedbackLine(feedback.hand, feedback.expectedInRange, feedback.correct, verbs)}
                </Text>
              ) : (
                <Text style={styles.swipeHint}>
                  Swipe right to {verbs.yes.toLowerCase()}, left to fold
                </Text>
              )}
            </View>
          </View>
        </GestureDetector>
        <View style={styles.answers}>
          <Pressable
            testID="answer-yes"
            disabled={feedback !== null}
            style={[styles.answer, styles.answerYes, feedback !== null && styles.answerDisabled]}
            onPress={() => answer(true)}
          >
            <Text style={styles.answerYesText}>{verbs.yes}</Text>
          </Pressable>
          <Pressable
            testID="answer-no"
            disabled={feedback !== null}
            style={[styles.answer, styles.answerNo, feedback !== null && styles.answerDisabled]}
            onPress={() => answer(false)}
          >
            <Text style={styles.answerNoText}>{verbs.no}</Text>
          </Pressable>
        </View>
      </View>
    </OverlayFrame>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1, padding: 20, gap: 12 },
    timer: {
      textAlign: 'center',
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
    scenario: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2, textAlign: 'center' },
    srOnly: { width: 1, height: 1, opacity: 0, position: 'absolute' },
    feedbackSlot: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    feedback: { fontFamily: fonts.bodySemibold, fontSize: 17, textAlign: 'center' },
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
    answerYes: { backgroundColor: theme.goldFill, borderColor: theme.goldFill },
    answerNo: { backgroundColor: theme.card, borderColor: theme.line2 },
    answerDisabled: { opacity: 0.85 },
    answerYesText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: theme.onAccent },
    answerNoText: { fontFamily: fonts.bodySemibold, fontSize: 17, color: theme.ink },
  });
}
