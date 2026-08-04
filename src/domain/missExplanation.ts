import { HAND_CLASS_NOUNS, classifyHandClass, type HandClass } from './handClass'
import { RANKS, generateHandMatrix, isValidHand, type PokerHand } from './pokerHands'
import type { SavedRange } from '../types/range'

/**
 * Why a hand is (or is not) in a range (v7.1 "explain every miss").
 *
 * Feedback that only says "wrong" teaches nothing. This puts the hand in
 * context: how much of its hand class the range plays, how its immediate grid
 * neighbours are treated, and whether it sits on the range's edge — the three
 * things a player would look at on the chart. Pure: hand + range in, facts and
 * a sentence out.
 */

const MATRIX = generateHandMatrix()
const POSITIONS = new Map<PokerHand, [number, number]>()
MATRIX.forEach((row, rowIndex) =>
  row.forEach((hand, colIndex) => POSITIONS.set(hand, [rowIndex, colIndex])),
)

/** Every hand of each class, cached once (the matrix never changes). */
const CLASS_MEMBERS = new Map<HandClass, PokerHand[]>()
for (const hand of MATRIX.flat()) {
  const handClass = classifyHandClass(hand)
  const members = CLASS_MEMBERS.get(handClass) ?? []
  members.push(hand)
  CLASS_MEMBERS.set(handClass, members)
}

export interface HandExplanation {
  hand: PokerHand
  handClass: HandClass
  inRange: boolean
  /** How many hands of this class the range plays, out of the class total. */
  classInRange: number
  classTotal: number
  /** Up/down/left/right neighbours on the 13x13 grid (2–4 of them). */
  neighbours: PokerHand[]
  neighboursInRange: number
  /** True when at least one neighbour is treated the opposite way. */
  borderline: boolean
  /** One-line, user-facing summary of the facts above. */
  line: string
}

/** The hands directly above/below/left/right of `hand` on the 13x13 grid. */
export function gridNeighbours(hand: PokerHand): PokerHand[] {
  const position = POSITIONS.get(hand)
  if (!position) throw new Error(`Invalid hand: ${hand}`)
  const [row, col] = position
  const offsets: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  return offsets
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r, c]) => r >= 0 && r < RANKS.length && c >= 0 && c < RANKS.length)
    .map(([r, c]) => MATRIX[r][c])
}

/**
 * Explain `hand`'s membership in the range made of `rangeHands`. Throws on a
 * non-canonical hand, like the rest of the domain.
 */
export function explainHand(hand: PokerHand, rangeHands: PokerHand[]): HandExplanation {
  if (!isValidHand(hand)) throw new Error(`Invalid hand: ${hand}`)
  const inSet = new Set(rangeHands)
  const handClass = classifyHandClass(hand)
  const members = CLASS_MEMBERS.get(handClass) ?? []
  const classInRange = members.filter((member) => inSet.has(member)).length
  const neighbours = gridNeighbours(hand)
  const neighboursInRange = neighbours.filter((neighbour) => inSet.has(neighbour)).length
  const inRange = inSet.has(hand)
  const borderline = neighbours.some((neighbour) => inSet.has(neighbour) !== inRange)

  const noun = HAND_CLASS_NOUNS[handClass]
  const classPart = `this range plays ${classInRange} of ${members.length} ${noun}`
  const neighbourPart = `${neighboursInRange} of its ${neighbours.length} neighbours ${
    neighboursInRange === 1 ? 'is' : 'are'
  } in`
  const edgePart = borderline ? ' It sits right on the range edge.' : ''
  const opening = `${hand} is ${inRange ? 'in' : 'out'}`

  return {
    hand,
    handClass,
    inRange,
    classInRange,
    classTotal: members.length,
    neighbours,
    neighboursInRange,
    borderline,
    line: `${opening}: ${classPart}, and ${neighbourPart}.${edgePart}`,
  }
}

/** How much of a note a drill shows before cutting it down to a glance. */
const NOTE_DISPLAY_LIMIT = 140

/**
 * The note the user wrote about `hand` on this chart, ready to show in a drill,
 * or null when they wrote none.
 *
 * Per-hand notes were only ever visible in the editor — the one place the answer
 * is already on screen. The moment they earn their keep is a miss: the note was
 * written to remember exactly this hand, in the user's own words, and it beats
 * anything the app can derive. A drill has room for a reminder rather than an
 * essay, so an over-long note is cut back to the last whole word and ellipsed.
 *
 * Notes are only stored for hands the chart plays, so a hand wrongly PLAYED
 * never has one to show; a hand wrongly folded usually does.
 */
export function handNoteFor(
  range: Pick<SavedRange, 'handNotes'>,
  hand: PokerHand,
  limit: number = NOTE_DISPLAY_LIMIT,
): string | null {
  const note = range.handNotes?.[hand]?.trim()
  if (!note) return null
  if (note.length <= limit) return note
  const cut = note.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  // Only break at a space that leaves most of the allowance used; one very long
  // word would otherwise cut the note to almost nothing.
  const kept = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${kept.trimEnd()}…`
}
