/**
 * How long a drill dwells on feedback before moving on.
 *
 * Shared by every drill so the rhythm is one decision in one place rather than a
 * constant copied per screen. Lives outside the components because a module that
 * exports both a component and a helper breaks fast refresh.
 */

/**
 * Why a drill handed its answers back.
 *
 * A run that used up its questions and a run the user closed both report the
 * attempts so far — and after the last answer those are the SAME list. A host
 * that told the two apart by counting therefore read a deliberate exit as a
 * finished segment and started the next one, so the close button did not close.
 * Saying which it was is the only thing that separates them.
 */
export type DrillEnd = 'completed' | 'closed'

/** Questions per (non-timed) drill: short sessions with a visible end. */
export const DRILL_QUESTION_COUNT = 20

/** Correct answers advance on their own; there is nothing to read. */
export const HIT_DWELL_MS = 900

/**
 * Under the clock, feedback only flashes: the whole point of the timed variant is
 * that it does not stop for you, so a miss auto-advances there too.
 */
export const TIMED_HIT_DWELL_MS = 500
export const TIMED_MISS_DWELL_MS = 1000

/**
 * Whether a scored answer stops the drill until the user continues.
 *
 * A miss is the one moment the drill has something to teach, and the explanation
 * runs to a couple of dozen words: no auto-advance delay is both long enough to
 * read it and short enough not to drag on every other question. So an untimed
 * miss waits for an explicit Next instead of guessing at a duration.
 */
export function holdsForAcknowledgement(timed: boolean, correct: boolean): boolean {
  return !timed && !correct
}
