/**
 * Pure mapping from a horizontal swipe distance to a recognition-practice answer, so
 * the gesture-to-answer decision is unit-testable without React or a real gesture
 * (mirroring how `HandGrid`'s `handAtPoint` is extracted and tested while the gesture
 * itself is not).
 *
 * A swipe right (positive `translationX`) past the threshold means "in range"; a swipe
 * left (negative) past the threshold means "out of range"; anything short of the
 * threshold is too small to count as an answer and returns `null`.
 */
export type SwipeAnswer = 'in' | 'out';

export function resolveSwipeAnswer(
  translationX: number,
  threshold = 60,
): SwipeAnswer | null {
  if (translationX >= threshold) return 'in';
  if (translationX <= -threshold) return 'out';
  return null;
}
