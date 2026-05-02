import { useState } from 'react'
import { HandGrid } from './components/HandGrid'
import { calculateRangePercentage, countSelectedCombos } from './domain/rangeMath'
import type { PokerHand } from './domain/pokerHands'
import './App.css'

function App() {
  const [selected, setSelected] = useState<Set<PokerHand>>(new Set())

  function toggleHand(hand: PokerHand) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(hand)) {
        next.delete(hand)
      } else {
        next.add(hand)
      }
      return next
    })
  }

  const selectedHands = Array.from(selected)
  const combos = countSelectedCombos(selectedHands)
  const percentage = calculateRangePercentage(selectedHands)

  return (
    <main className="app">
      <header className="app-header">
        <h1>Poker Range Trainer</h1>
        <p>Click hands to build a Texas Hold'em preflop range.</p>
      </header>

      <HandGrid selected={selected} onToggle={toggleHand} />

      <section className="range-summary" aria-label="Range summary">
        <span>{selectedHands.length} hands selected</span>
        <span>{combos} combos</span>
        <span>{percentage.toFixed(1)}% of all hands</span>
      </section>
    </main>
  )
}

export default App
