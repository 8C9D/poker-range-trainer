import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBackToClose } from './useBackToClose'

/**
 * jsdom implements the history stack, but `history.back()` resolves on a later
 * task, so pops are simulated directly where the assertion is about our handler
 * rather than about jsdom's queue.
 */
function popTo(state: unknown) {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate', { state }))
  })
}

beforeEach(() => {
  window.history.replaceState(null, '', '#/today')
})

describe('useBackToClose', () => {
  it('pushes a history entry only while the session is open', () => {
    const before = window.history.length
    const { rerender } = renderHook(({ open }) => useBackToClose(open, () => {}), {
      initialProps: { open: false },
    })
    expect(window.history.length).toBe(before)

    rerender({ open: true })
    expect(window.history.length).toBe(before + 1)
  })

  it('keeps the url unchanged when it pushes', () => {
    renderHook(() => useBackToClose(true, () => {}))
    expect(window.location.hash).toBe('#/today')
  })

  it('closes the session when its entry is popped', () => {
    const onClose = vi.fn()
    renderHook(() => useBackToClose(true, onClose))

    popTo(null)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores a pop that lands on another session entry', () => {
    const onClose = vi.fn()
    renderHook(() => useBackToClose(true, onClose))

    popTo({ practiceSession: true })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close a session that is not open', () => {
    const onClose = vi.fn()
    renderHook(() => useBackToClose(false, onClose))

    popTo(null)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls the latest onClose without re-pushing on every render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onClose }) => useBackToClose(true, onClose), {
      initialProps: { onClose: first },
    })
    const afterOpen = window.history.length

    rerender({ onClose: second })
    expect(window.history.length).toBe(afterOpen)

    popTo(null)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('drops its entry when the session closes some other way', async () => {
    const back = vi.spyOn(window.history, 'back')
    const { rerender } = renderHook(({ open }) => useBackToClose(open, () => {}), {
      initialProps: { open: true },
    })

    rerender({ open: false })

    expect(back).toHaveBeenCalledOnce()
    back.mockRestore()
  })

  it('leaves the stack alone when the session was closed by Back', () => {
    const back = vi.spyOn(window.history, 'back')
    const onClose = vi.fn()
    const { rerender } = renderHook(({ open }) => useBackToClose(open, onClose), {
      initialProps: { open: true },
    })

    popTo(null)
    rerender({ open: false })

    expect(back).not.toHaveBeenCalled()
    back.mockRestore()
  })
})
