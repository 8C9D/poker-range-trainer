import { generateHandMatrix, isValidHand, type PokerHand } from './pokerHands'
import { normalizeMixedStrategy, type HandMixedStrategy } from './mixedStrategy'
import { RANGE_ACTIONS, type RangeAction } from '../types/range'

/**
 * Textual notation for mixed-frequency charts (v4.2 "frequency export/import").
 *
 * One line per hand, e.g. `AA: raise 60, fold 40`. The action token is the
 * stable lowercase `RangeAction` id (not the display label) so the format round-
 * trips. Pure and dependency-free; mirrors the `actionRange` notation helpers.
 */

/** The 13x13 matrix order, built once for canonical line ordering. */
const MATRIX_HANDS = generateHandMatrix().flat()

function isRangeAction(value: string): value is RangeAction {
  return (RANGE_ACTIONS as readonly string[]).includes(value)
}

/**
 * Emit one `"{hand}: {action} {freq}, ..."` line per hand that has a non-empty
 * strategy, in canonical matrix order. Returns `""` for an empty map.
 */
export function formatMixedNotation(
  mixedStrategies: Record<PokerHand, HandMixedStrategy>,
): string {
  const lines: string[] = []
  for (const hand of MATRIX_HANDS) {
    const strategy = mixedStrategies[hand]
    if (!strategy) continue
    const normalized = normalizeMixedStrategy(strategy)
    if (normalized.length === 0) continue
    const parts = normalized.map(({ action, frequency }) => `${action} ${frequency}`)
    lines.push(`${hand}: ${parts.join(', ')}`)
  }
  return lines.join('\n')
}

/**
 * Parse mixed-frequency notation back into a per-hand strategy map. Throws a
 * clear `Error` on a malformed line, invalid hand, unknown action, or non-numeric
 * frequency. Blank lines are ignored.
 */
export function parseMixedNotation(input: string): Record<PokerHand, HandMixedStrategy> {
  const result: Record<PokerHand, HandMixedStrategy> = {}
  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim()
    if (line === '') continue

    const colon = line.indexOf(':')
    if (colon === -1) {
      throw new Error(`Invalid line (missing ":"): "${line}".`)
    }
    const hand = line.slice(0, colon).trim()
    if (!isValidHand(hand)) {
      throw new Error(`Invalid hand: "${hand}".`)
    }

    const strategy: HandMixedStrategy = []
    for (const part of line.slice(colon + 1).split(',')) {
      const tokens = part.trim().split(/\s+/)
      if (tokens.length !== 2) {
        throw new Error(`Invalid action/frequency: "${part.trim()}".`)
      }
      const [action, freqText] = tokens
      if (!isRangeAction(action)) {
        throw new Error(`Unknown action: "${action}".`)
      }
      const frequency = Number(freqText)
      if (!Number.isFinite(frequency)) {
        throw new Error(`Invalid frequency: "${freqText}".`)
      }
      strategy.push({ action, frequency })
    }

    const normalized = normalizeMixedStrategy(strategy)
    if (normalized.length > 0) result[hand] = normalized
  }
  return result
}
