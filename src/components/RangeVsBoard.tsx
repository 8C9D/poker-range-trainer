import { useMemo, useState } from 'react'
import { parseBoard } from '../domain/cards'
import { HAND_CATEGORIES, type HandCategory } from '../domain/handCategory'
import { bucketRangeOnBoard } from '../domain/rangeVsBoard'
import { availableComboCount } from '../domain/combos'
import type { PokerHand } from '../domain/pokerHands'
import { FlopTexture } from './FlopTexture'
import './RangeVsBoard.css'

/** Display labels for the hand categories shown in the breakdown. */
const CATEGORY_LABELS: Record<HandCategory, string> = {
  straight: 'Straight',
  set: 'Set',
  trips: 'Trips',
  twoPair: 'Two pair',
  overpair: 'Overpair',
  topPair: 'Top pair',
  middlePair: 'Middle pair',
  bottomPair: 'Bottom pair',
  pair: 'Pair / underpair',
  flushDraw: 'Flush draw',
  straightDraw: 'Straight draw',
  air: 'Air',
}

interface RangeVsBoardProps {
  /** The preflop hand classes of the range to break down. */
  hands: PokerHand[]
}

/**
 * Lets the user type a flop and see how the range hits it: the flop's texture
 * tags plus a combo breakdown by {@link HandCategory}. Self-contained (the board
 * input is local state); shows a clear inline error for an invalid board.
 */
export function RangeVsBoard({ hands }: RangeVsBoardProps) {
  const [board, setBoard] = useState('')

  const result = useMemo<
    | null
    | { error: string }
    | { tally: Record<HandCategory, number>; comboCount: number }
  >(() => {
    if (board.trim() === '') return null
    try {
      const flop = parseBoard(board)
      return {
        tally: bucketRangeOnBoard(hands, flop),
        comboCount: availableComboCount(hands, flop),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid board.' }
    }
  }, [board, hands])

  return (
    <div className="range-vs-board">
      <label className="range-vs-board-input">
        Flop
        <input
          type="text"
          value={board}
          placeholder="e.g. AsKd7h"
          onChange={(event) => setBoard(event.target.value)}
        />
      </label>

      {result && 'error' in result && (
        <p className="range-vs-board-error" role="alert">
          {result.error}
        </p>
      )}

      {result && 'tally' in result && (
        <div className="range-vs-board-result">
          <FlopTexture board={board} />
          <p className="range-vs-board-combos">
            {result.comboCount} combos remaining (after removing board cards)
          </p>
          <table className="range-vs-board-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Combos</th>
              </tr>
            </thead>
            <tbody>
              {HAND_CATEGORIES.map((category) => (
                <tr
                  key={category}
                  className={result.tally[category] === 0 ? 'is-zero' : undefined}
                >
                  <td>{CATEGORY_LABELS[category]}</td>
                  <td>{result.tally[category]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
