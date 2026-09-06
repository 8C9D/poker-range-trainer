'use client'

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
  const paintMode = useRef<boolean | undefined>(undefined)

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

  function beginPaint(event: PointerEvent<HTMLDivElement>): void {
    const hand = handAtPoint(event)
    if (!hand) return
    event.preventDefault()
    paintMode.current = !selectedHands.has(hand)
    event.currentTarget.setPointerCapture(event.pointerId)
    changeHand(hand, paintMode.current)
  }

  function continuePaint(event: PointerEvent<HTMLDivElement>): void {
    if (paintMode.current === undefined) return
    const hand = handAtPoint(event)
    if (hand) changeHand(hand, paintMode.current)
  }

  function finishPaint(): void {
    paintMode.current = undefined
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
