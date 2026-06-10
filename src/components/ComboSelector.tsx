import { formatCard } from '../domain/cards'
import { comboKey, handClassCombos } from '../domain/combos'
import { isComboSelected, type ComboSelection } from '../domain/comboSelection'
import type { PokerHand } from '../domain/pokerHands'
import type { Card } from '../domain/cards'
import './ComboSelector.css'

interface ComboSelectorProps {
  /** The hand class whose concrete combos are shown (e.g. "AKs"). */
  hand: PokerHand
  /** Current selection (a `Set` of `comboKey`s); the source of truth lives in the parent. */
  selection: ComboSelection
  /** Fired with the toggled combo (two cards). */
  onToggle: (combo: Card[]) => void
}

/**
 * Controlled, presentational grid of the concrete combos for a single hand
 * class. Each combo is a toggle button (two suit-colored cards) reflecting its
 * on/off state via `aria-pressed`; the parent owns the `ComboSelection` and
 * applies the toggle. Order-independent because state is keyed by `comboKey`.
 */
export function ComboSelector({ hand, selection, onToggle }: ComboSelectorProps) {
  const combos = handClassCombos(hand)
  const selected = combos.filter((combo) => isComboSelected(selection, combo)).length

  return (
    <div className="combo-selector">
      <p className="combo-selector-count">
        {selected}/{combos.length} combos
      </p>
      <div className="combo-selector-grid" aria-label={`Combos for ${hand}`}>
        {combos.map((combo) => {
          const key = comboKey(combo)
          const on = isComboSelected(selection, combo)
          return (
            <button
              key={key}
              type="button"
              className={`combo-cell${on ? ' combo-cell-on' : ''}`}
              aria-pressed={on}
              aria-label={key}
              onClick={() => onToggle(combo)}
            >
              {combo.map((card) => (
                <span key={formatCard(card)} className={`combo-card suit-${card.suit}`}>
                  {formatCard(card)}
                </span>
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
