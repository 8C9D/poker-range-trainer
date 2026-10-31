import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import {
  classifyHand,
  generateHandMatrix,
  type PokerHand,
} from '@poker-range-trainer/domain/domain/pokerHands'

const COLUMNS = 13

/** Row-major 13×13 matrix: pairs on the diagonal, suited above it, offsuit below. */
export const handMatrix: readonly PokerHand[] = generateHandMatrix().flat()

interface HandGridProps {
  selectedHands: ReadonlySet<string>
  onChange: (hands: Set<string>) => void
}

interface ActivePaint {
  /** Whether this drag adds hands or removes them, fixed by the cell it began on. */
  selecting: boolean
  hands: Set<string>
  x: number
  y: number
}

/** Floor on the walk along a drag, for a grid with no measured width yet. */
const MIN_SAMPLE_SPACING_PX = 4

/**
 * Controlled 13×13 selection grid: click or drag to paint, one roving tab stop
 * moved with the arrow keys, Space/Enter to toggle. Cells are toggle buttons
 * (`aria-pressed`) so the selected state is exposed without an ARIA grid's
 * row/cell requirements.
 */
export function HandGrid({ selectedHands, onChange }: HandGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const [activeIndex, setActiveIndex] = useState(0)
  /**
   * The drag in progress. It keeps its own set because pointer moves are batched:
   * several can land before a render, and each must build on the one before it
   * rather than on the `selectedHands` of the last render.
   */
  const paint = useRef<ActivePaint | undefined>(undefined)

  function changeHand(hand: string, selected: boolean): void {
    if (selectedHands.has(hand) === selected) return
    const next = new Set(selectedHands)
    if (selected) next.add(hand)
    else next.delete(hand)
    onChange(next)
  }

  function setActive(index: number): void {
    const bounded = Math.max(0, Math.min(handMatrix.length - 1, index))
    setActiveIndex(bounded)
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-index="${bounded}"]`)?.focus()
    })
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, hand: string): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        setActive(index % COLUMNS === COLUMNS - 1 ? index : index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        setActive(index % COLUMNS === 0 ? index : index - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        setActive(index + COLUMNS)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(index - COLUMNS)
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(handMatrix.length - 1)
        break
      case ' ':
      case 'Enter':
        event.preventDefault()
        changeHand(hand, !selectedHands.has(hand))
        break
    }
  }

  function handAtPoint(event: PointerEvent<HTMLDivElement>): string | undefined {
    const element = document.elementFromPoint?.(event.clientX, event.clientY)
    const target = event.target instanceof Element ? event.target : undefined
    const button =
      element?.closest<HTMLButtonElement>('[data-hand]') ??
      target?.closest<HTMLButtonElement>('[data-hand]')
    return button?.dataset.hand
  }

  /**
   * The cells along a straight line. A quick drag moves many cells between two
   * pointer events, so the events alone would leave gaps in a selection the grid
   * promises is continuous.
   */
  function handsAlong(fromX: number, fromY: number, toX: number, toY: number): string[] {
    const cell = gridRef.current?.querySelector('[data-hand]')?.getBoundingClientRect().width ?? 0
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const samples = Math.ceil(distance / Math.max(cell / 2, MIN_SAMPLE_SPACING_PX))
    const hands: string[] = []
    for (let sample = 1; sample <= samples; sample += 1) {
      const progress = sample / samples
      const element = document.elementFromPoint?.(
        fromX + (toX - fromX) * progress,
        fromY + (toY - fromY) * progress,
      )
      const hand = element?.closest<HTMLButtonElement>('[data-hand]')?.dataset.hand
      if (hand) hands.push(hand)
    }
    return hands
  }

  function applyPaint(active: ActivePaint, hands: readonly string[]): void {
    let changed = false
    for (const hand of hands) {
      if (active.hands.has(hand) === active.selecting) continue
      if (active.selecting) active.hands.add(hand)
      else active.hands.delete(hand)
      changed = true
    }
    if (changed) onChange(new Set(active.hands))
  }

  function beginPaint(event: PointerEvent<HTMLDivElement>): void {
    const hand = handAtPoint(event)
    if (!hand) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const active = {
      selecting: !selectedHands.has(hand),
      hands: new Set(selectedHands),
      x: event.clientX,
      y: event.clientY,
    }
    paint.current = active
    applyPaint(active, [hand])
  }

  function continuePaint(event: PointerEvent<HTMLDivElement>): void {
    const active = paint.current
    if (active === undefined) return
    const crossed = handsAlong(active.x, active.y, event.clientX, event.clientY)
    const hand = handAtPoint(event)
    active.x = event.clientX
    active.y = event.clientY
    applyPaint(active, hand === undefined ? crossed : [...crossed, hand])
  }

  function finishPaint(): void {
    paint.current = undefined
  }

  return (
    <section className="hand-grid-section" aria-labelledby="hand-grid-title">
      <div className="section-heading">
        <div>
          <h2 id="hand-grid-title">Starting hands</h2>
          <p id={helpId} className="quiet">
            Select at least one hand. Drag to paint a continuous selection; keyboard users can use
            arrow keys, Home/End, and Space or Enter.
          </p>
        </div>
        <p className="hand-count" aria-live="polite">
          {selectedHands.size} of 169 hand classes selected
        </p>
      </div>
      <div
        ref={gridRef}
        className="hand-grid"
        role="group"
        aria-label="Starting hand grid"
        aria-describedby={helpId}
        onPointerDown={beginPaint}
        onPointerMove={continuePaint}
        onPointerUp={finishPaint}
        onPointerCancel={finishPaint}
      >
        {handMatrix.map((hand, index) => {
          const selected = selectedHands.has(hand)
          return (
            <button
              key={hand}
              className={`hand-cell hand-cell-${classifyHand(hand)}`}
              data-hand={hand}
              data-index={index}
              type="button"
              tabIndex={activeIndex === index ? 0 : -1}
              aria-pressed={selected}
              aria-label={hand}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => keyDown(event, index, hand)}
            >
              {hand}
            </button>
          )
        })}
      </div>
    </section>
  )
}
