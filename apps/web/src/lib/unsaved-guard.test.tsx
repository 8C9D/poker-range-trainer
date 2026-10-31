import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useUnsavedGuard } from './unsaved-guard'

function Editor() {
  const [dirty, setDirty] = useState(false)
  const navigate = useNavigate()
  const guard = useUnsavedGuard(dirty, 'Discard?')
  return (
    <>
      <h1>Editor</h1>
      <button type="button" onClick={() => setDirty(true)}>
        Change
      </button>
      <button
        type="button"
        onClick={() => {
          guard.release()
          setDirty(false)
          navigate('/other')
        }}
      >
        Save and leave
      </button>
      <Link to="/other">Elsewhere</Link>
    </>
  )
}

function open() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Start</h1> },
      { path: '/edit', element: <Editor /> },
      { path: '/other', element: <h1>Other</h1> },
    ],
    { initialEntries: ['/', '/edit'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('useUnsavedGuard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('leaves clean screens alone', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    open()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Elsewhere' }))
    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('keeps the screen when the user declines to discard a link click', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }))
    expect(confirm).toHaveBeenCalledWith('Discard?')
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument()
  })

  it('leaves once the user agrees', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }))
    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument()
  })

  it('also stops the browser Back button', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const router = open()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Change' }))
    await act(async () => {
      await router.navigate(-1)
    })
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument()
  })

  it('lets a save navigate in the same tick it clears its state', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks the browser to confirm an unload only while work is unsaved', async () => {
    open()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Change' }))
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })
})
