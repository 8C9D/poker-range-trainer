import { useMemo, useState } from 'react'
import { formatCard, parseBoard, type Card } from '../domain/cards'
import { availablePracticeCombos, drawPracticeCombo } from '../domain/blockerPractice'
import type { ComboSelection } from '../domain/comboSelection'
import type { PokerHand } from '../domain/pokerHands'
import './ComboBlockerDrill.css'

interface ComboBlockerDrillProps {
  /** The preflop hand classes of the range to deal from. */
  hands: PokerHand[]
  /** Optional starting board string (dead cards), e.g. "AsKd7h". */
  board?: string
  /** Optional range-wide combo selection; absent = every combo eligible. */
  selection?: ComboSelection
  /** Back action. */
  onExit: () => void
}

/**
 * Self-graded blocker-aware combo drill: type a board (dead cards) and deal a
 * concrete combo from the range that those cards do not block. Exploratory, no
 * persisted stats — it surfaces which combos remain available given the board.
 */
export function ComboBlockerDrill({
  hands,
  board: initialBoard = '',
  selection,
  onExit,
}: ComboBlockerDrillProps) {
  const [board, setBoard] = useState(initialBoard)
  const [combo, setCombo] = useState<Card[] | null>(null)

  const parsed = useMemo<{ dead: Card[]; remaining: number } | { error: string }>(() => {
    try {
      const dead = board.trim() === '' ? [] : parseBoard(board)
      return { dead, remaining: availablePracticeCombos(hands, dead, selection).length }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid board.' }
    }
  }, [board, hands, selection])

  const deal = () => {
    if ('error' in parsed) return
    try {
      setCombo(drawPracticeCombo(hands, parsed.dead, selection))
    } catch {
      setCombo(null)
    }
  }

  return (
    <div className="combo-blocker-drill">
      <label className="combo-blocker-board">
        Board (dead cards)
        <input
          type="text"
          value={board}
          placeholder="e.g. AsKd7h"
          onChange={(event) => {
            setBoard(event.target.value)
            setCombo(null)
          }}
        />
      </label>

      {'error' in parsed ? (
        <p className="combo-blocker-error" role="alert">
          {parsed.error}
        </p>
      ) : parsed.remaining === 0 ? (
        <p className="combo-blocker-empty">No combos available — every combo is blocked.</p>
      ) : (
        <>
          <p className="combo-blocker-remaining">{parsed.remaining} combos available</p>
          <button type="button" className="combo-blocker-deal" onClick={deal}>
            Deal a combo
          </button>
          {combo && (
            <div className="combo-blocker-combo" aria-label="Dealt combo">
              {combo.map((card) => (
                <span key={formatCard(card)} className={`combo-card suit-${card.suit}`}>
                  {formatCard(card)}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <button type="button" className="combo-blocker-back" onClick={onExit}>
        Back
      </button>
    </div>
  )
}
