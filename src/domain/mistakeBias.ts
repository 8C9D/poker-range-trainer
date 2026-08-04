import { POSITIONS, type Position, type SavedRange } from '../types/range'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'

/**
 * Which way the user's mistakes lean.
 *
 * Every stored per-hand record already splits its misses into `falsePositives`
 * (played a hand the chart folds) and `falseNegatives` (folded a hand the chart
 * plays), but nothing ever read them back. Accuracy answers how often you are
 * wrong; this answers *which way* — the difference between a player who has to
 * fold more and one who has to open up, which is the first correction a coach
 * would make. Pure — callers pass the loaded accuracy map.
 */

/** Direction of a set of mistakes. `unknown` means too few misses to call it. */
export type MistakeBias = 'loose' | 'tight' | 'balanced' | 'unknown'

/**
 * A lean is only called when it holds this share of the misses (in percent), so
 * a near-even split reports `balanced` rather than a direction the data does
 * not support.
 */
const DECISIVE_SHARE = 60

/** How many recorded misses a direction has to rest on before it is reported. */
const MIN_MISTAKES = 6

export interface MistakeBiasSummary {
  /** Misses that played a hand the chart folds. */
  loose: number
  /** Misses that folded a hand the chart plays. */
  tight: number
  /** `loose + tight`. */
  mistakes: number
  /** Share of the misses in the loose direction, 0–100 (0 when there are none). */
  loosePercentage: number
  bias: MistakeBias
}

/** One seat's lean, for the by-seat cut. */
export interface PositionMistakeBias {
  position: Position
  summary: MistakeBiasSummary
}

/** Tally the two miss directions over a set of per-hand records. */
function tally(stats: Iterable<HandAccuracyStat>): { loose: number; tight: number } {
  let loose = 0
  let tight = 0
  for (const stat of stats) {
    loose += stat.falsePositives
    tight += stat.falseNegatives
  }
  return { loose, tight }
}

/** Turn a tally into a summary, applying the evidence floor and the lean cutoff. */
function verdict(loose: number, tight: number, minMistakes: number): MistakeBiasSummary {
  const mistakes = loose + tight
  const loosePercentage = mistakes > 0 ? (loose / mistakes) * 100 : 0
  let bias: MistakeBias = 'balanced'
  if (mistakes < minMistakes) {
    bias = 'unknown'
  } else if (loosePercentage >= DECISIVE_SHARE) {
    bias = 'loose'
  } else if (100 - loosePercentage >= DECISIVE_SHARE) {
    bias = 'tight'
  }
  return { loose, tight, mistakes, loosePercentage, bias }
}

/**
 * The library-wide lean over every recorded miss.
 *
 * The caller scopes `handAccuracy` to the live library, exactly as the other
 * Progress reports do — a deleted range's misses would describe a leak in a
 * chart that no longer exists.
 */
export function summarizeMistakeBias(
  handAccuracy: Record<string, RangeHandAccuracy>,
  minMistakes = MIN_MISTAKES,
): MistakeBiasSummary {
  const { loose, tight } = tally(
    Object.values(handAccuracy).flatMap((hands) => Object.values(hands)),
  )
  return verdict(loose, tight, minMistakes)
}

/**
 * The seats where the lean is decisive, most lopsided first.
 *
 * Cut by the range's declared seat (skipping archived charts), like
 * `accuracyByPosition`. Only `loose` and `tight` seats are returned: a balanced
 * seat has no correction to offer, and an under-evidenced one has no claim to
 * make. Ties break toward more misses, then canonical seat order.
 */
export function mistakeBiasByPosition(
  ranges: SavedRange[],
  handAccuracy: Record<string, RangeHandAccuracy>,
  minMistakes = MIN_MISTAKES,
): PositionMistakeBias[] {
  const buckets = new Map<Position, { loose: number; tight: number }>(
    POSITIONS.map((position) => [position, { loose: 0, tight: 0 }]),
  )

  for (const range of ranges) {
    if (range.archived) continue
    const position = range.metadata?.position
    const hands = position ? handAccuracy[range.id] : undefined
    const bucket = position ? buckets.get(position) : undefined
    if (!hands || !bucket) continue
    const counts = tally(Object.values(hands))
    bucket.loose += counts.loose
    bucket.tight += counts.tight
  }

  const leans: PositionMistakeBias[] = []
  for (const position of POSITIONS) {
    const bucket = buckets.get(position)
    if (!bucket) continue
    const summary = verdict(bucket.loose, bucket.tight, minMistakes)
    if (summary.bias === 'loose' || summary.bias === 'tight') leans.push({ position, summary })
  }
  return leans.sort(
    (a, b) =>
      Math.abs(b.summary.loosePercentage - 50) - Math.abs(a.summary.loosePercentage - 50) ||
      b.summary.mistakes - a.summary.mistakes ||
      POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position),
  )
}

/** The lean in plain words, shared by both platforms. */
export function describeMistakeBias(summary: MistakeBiasSummary): string {
  switch (summary.bias) {
    case 'loose':
      return 'You lean loose: most of your misses play a hand the chart folds.'
    case 'tight':
      return 'You lean tight: most of your misses fold a hand the chart plays.'
    case 'balanced':
      return 'Your misses split evenly between playing too much and folding too much.'
    case 'unknown':
      return 'Practice a little more and which way you miss will show up here.'
  }
}

/** A seat's lean as one short phrase, e.g. "too loose from UTG". */
export function describePositionBias(lean: PositionMistakeBias): string {
  return lean.summary.bias === 'loose' ? 'plays too many hands' : 'folds too many hands'
}
