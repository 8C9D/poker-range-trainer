import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useSwipe } from './useSwipe'

function SwipeArea(props: Parameters<typeof useSwipe>[0]) {
  const swipe = useSwipe(props)
  return (
    <div data-testid="area" {...swipe}>
      swipe me
    </div>
  )
}

function swipeBy(dx: number, dy = 0) {
  const area = screen.getByTestId('area')
  fireEvent.pointerDown(area, { clientX: 100, clientY: 100 })
  fireEvent.pointerUp(area, { clientX: 100 + dx, clientY: 100 + dy })
}

describe('useSwipe', () => {
  it('fires onSwipeRight past the threshold to the right', () => {
    const onSwipeRight = vi.fn()
    render(<SwipeArea onSwipeRight={onSwipeRight} />)
    swipeBy(80)
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
  })

  it('fires onSwipeLeft past the threshold to the left', () => {
    const onSwipeLeft = vi.fn()
    render(<SwipeArea onSwipeLeft={onSwipeLeft} />)
    swipeBy(-80)
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it('ignores short horizontal movement below the threshold', () => {
    const onSwipeRight = vi.fn()
    const onSwipeLeft = vi.fn()
    render(<SwipeArea onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />)
    swipeBy(20)
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores horizontal swipes with too much vertical drift', () => {
    const onSwipeRight = vi.fn()
    render(<SwipeArea onSwipeRight={onSwipeRight} />)
    swipeBy(80, 100)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('does nothing on pointerup without a preceding pointerdown', () => {
    const onSwipeRight = vi.fn()
    render(<SwipeArea onSwipeRight={onSwipeRight} />)
    fireEvent.pointerUp(screen.getByTestId('area'), { clientX: 200, clientY: 100 })
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
