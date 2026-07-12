import {
  ACTION_TYPE_LABELS,
  POSITION_LABELS,
  type ActionType,
  type SavedRange,
} from '../types/range'

/**
 * The drill's answer button labels: the range's action verb vs Fold. A range
 * without an action type falls back to the generic "In range" verb. The labels
 * never change mid-session, so the buttons stay fixed in place and meaning.
 */
export function answerVerbs(range: SavedRange): { yes: string; no: string } {
  const actionType = range.metadata?.actionType
  return { yes: actionType ? ACTION_TYPE_LABELS[actionType] : 'In range', no: 'Fold' }
}

/**
 * A one-line scenario context for drill prompts, built from the range's
 * metadata, e.g. "You are UTG, 100bb. First to act — open or fold." Returns
 * null when there is no metadata to describe.
 */
export function scenarioLine(range: SavedRange): string | null {
  const meta = range.metadata
  if (!meta) return null
  const parts: string[] = []

  if (meta.position) {
    let seat = `You are ${POSITION_LABELS[meta.position]}`
    if (meta.stackDepthBb !== undefined) seat += `, ${meta.stackDepthBb}bb`
    parts.push(`${seat}.`)
  } else if (meta.stackDepthBb !== undefined) {
    parts.push(`${meta.stackDepthBb}bb effective.`)
  }

  if (meta.actionType) {
    const vs = meta.versusPosition ? POSITION_LABELS[meta.versusPosition] : null
    const sentences: Record<ActionType, string> = {
      open: 'First to act — open or fold.',
      call: vs ? `Facing a raise from ${vs}.` : 'Facing a raise.',
      threeBet: vs ? `Facing an open from ${vs}.` : 'Facing an open.',
      fourBet: vs ? `Facing a 3-bet from ${vs}.` : 'Facing a 3-bet.',
      defend: vs ? `Defending against ${vs}.` : 'Defending your seat.',
      jam: 'Shove or fold.',
      callJam: vs ? `Facing a jam from ${vs}.` : 'Facing a jam.',
    }
    parts.push(sentences[meta.actionType])
  }

  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Explanatory feedback for a scored answer: misses explain what the hand
 * actually is and what to do about it; hits confirm briefly.
 */
export function feedbackLine(
  hand: string,
  expectedInRange: boolean,
  correct: boolean,
  verbs: { yes: string; no: string },
): string {
  if (correct) {
    return expectedInRange ? `Correct — ${verbs.yes.toLowerCase()} ${hand}.` : `Correct — ${hand} is a fold.`
  }
  return expectedInRange
    ? `${hand} is in this range — ${verbs.yes.toLowerCase()} it.`
    : `${hand} isn't in this range — fold it.`
}
