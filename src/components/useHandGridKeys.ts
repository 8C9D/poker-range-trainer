import { useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'

/**
 * Keyboard navigation for the 13x13 hand grids.
 *
 * Every grid in the app paints all 169 hands as buttons, which makes each one a
 * tab stop: reaching 22 from the top of the page costs 169 presses, and there is
 * no way to move down a column at all. This is the standard grid remedy, a roving
 * tabindex — the grid holds ONE tab stop, and the arrow keys move it — so the
 * grid costs a keyboard user one Tab, like every other control.
 *
 * The index math is exported separately so it can be tested without a DOM.
 */

/** Columns (and rows) in a starting-hand matrix. */
const COLUMNS = 13
const CELLS = COLUMNS * COLUMNS

/**
 * What the roving tab stop below does, in words, for the grids to hang off
 * `aria-describedby`. The keys are worth having but invisible: a keyboard user
 * lands on one cell out of 169 with no way to guess that anything but Tab works.
 */
export const HAND_GRID_KEY_HINT =
  'Use the arrow keys to move between hands. Home and End jump to the ends of the row, Page Up and Page Down to the ends of the column.'

/**
 * The cell index a key press moves to, or `null` when the key does not navigate.
 *
 * Movement clamps at the edges rather than wrapping: the matrix is a chart, and
 * falling off the end of the ace row into the king row would misread as a jump.
 * Home/End work on the current row, and with Ctrl/Cmd on the whole grid;
 * PageUp/PageDown jump to the top and bottom of the current column.
 */
export function nextHandGridIndex(
  key: string,
  index: number,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {},
): number | null {
  const row = Math.floor(index / COLUMNS)
  const column = index % COLUMNS
  const rowStart = row * COLUMNS
  const wholeGrid = Boolean(modifiers.ctrlKey || modifiers.metaKey)

  switch (key) {
    case 'ArrowLeft':
      return Math.max(index - 1, rowStart)
    case 'ArrowRight':
      return Math.min(index + 1, rowStart + COLUMNS - 1)
    case 'ArrowUp':
      return row === 0 ? index : index - COLUMNS
    case 'ArrowDown':
      return row === COLUMNS - 1 ? index : index + COLUMNS
    case 'Home':
      return wholeGrid ? 0 : rowStart
    case 'End':
      return wholeGrid ? CELLS - 1 : rowStart + COLUMNS - 1
    case 'PageUp':
      return column
    case 'PageDown':
      return CELLS - COLUMNS + column
    default:
      return null
  }
}

export interface HandGridKeys {
  /** Attach to the element that directly wraps the 169 cell buttons. */
  gridRef: RefObject<HTMLDivElement | null>
  /** The one cell currently in the tab order. */
  focusedIndex: number
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onFocus: (event: FocusEvent<HTMLDivElement>) => void
}

/**
 * Roving-tabindex state for a 13x13 grid of buttons.
 *
 * The tab stop follows focus rather than being pushed there, so clicking a cell
 * and then tabbing away and back returns to the cell the user last touched.
 */
export function useHandGridKeys(): HandGridKeys {
  const gridRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Typed as HTMLElement, not HTMLButtonElement, so a focus/keydown event's
  // `target` (which React types against the container) compares without a cast
  // through `unknown`.
  function cells(): HTMLElement[] {
    return gridRef.current ? Array.from(gridRef.current.querySelectorAll('button')) : []
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const all = cells()
    // Read the origin off the event rather than off `focusedIndex`: state updates
    // are async, so a held-down arrow key could otherwise move from a cell the
    // user has already left.
    const current = all.indexOf(event.target as HTMLElement)
    if (current === -1) return

    const next = nextHandGridIndex(event.key, current, event)
    if (next === null) return
    // Claim the key even when movement clamps, so an arrow at the edge of the
    // grid never scrolls the page out from under the user.
    event.preventDefault()
    // `onFocus` below records the new index; focusing is the single source of truth.
    all[next]?.focus()
  }

  function onFocus(event: FocusEvent<HTMLDivElement>) {
    const index = cells().indexOf(event.target as HTMLElement)
    if (index !== -1) setFocusedIndex(index)
  }

  return { gridRef, focusedIndex, onKeyDown, onFocus }
}
