import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { encodeRangeToHash } from './domain/rangeTransfer'
import { loadReviewStates } from './storage/reviewStateStorage'
import { loadSavedRanges, saveSavedRange } from './storage/rangeStorage'
import type { SavedRange } from './types/range'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

function seedRange(id: string, name: string) {
  saveSavedRange({
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('Routing shell', () => {
  it('opens the Today screen on the default route', () => {
    render(<App />)
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('routes to Library, Progress, and Account', () => {
    window.location.hash = '#/library'
    const first = render(<App />)
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
    first.unmount()

    window.location.hash = '#/progress'
    const second = render(<App />)
    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    second.unmount()

    window.location.hash = '#/account'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('routes to a saved range page', () => {
    seedRange('r1', 'UTG open')
    window.location.hash = '#/library/r1'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'UTG open' })).toBeInTheDocument()
  })
})

describe('Share links', () => {
  it('renders the shared-range viewer for #/r/:id links', () => {
    window.location.hash = '#/r/some-share-id'
    render(<App />)
    // Cloud is unconfigured in tests, so the viewer resolves to not-found;
    // the point is that the share route bypasses the app shell.
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.getByText(/shared range/i)).toBeInTheDocument()
  })

  it('renders the shared-pack viewer for #/p/:id links', () => {
    window.location.hash = '#/p/some-pack-id'
    render(<App />)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.getByText(/shared pack/i)).toBeInTheDocument()
  })

  it('imports a #range= share link into the library at module load', async () => {
    const shared: SavedRange = {
      id: 'src-id',
      name: 'Linked range',
      hands: ['AA', 'AKs'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    window.location.hash = `#range=${encodeRangeToHash(shared)}`
    vi.resetModules()
    const { default: FreshApp } = await import('./App')

    const saved = loadSavedRanges()
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Linked range')
    expect(saved[0].id).not.toBe('src-id')
    // The import hash is replaced so a refresh won't re-import, and it lands on
    // the range that just arrived rather than the default screen — otherwise a
    // working link is indistinguishable from one the app ignored.
    expect(window.location.hash).toBe(`#/library/${saved[0].id}`)
    render(<FreshApp />)
    expect(screen.getByRole('heading', { name: 'Linked range' })).toBeInTheDocument()
  })

  it('clears the hash and says so when a #range= link cannot be read', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    window.location.hash = '#range=not-a-real-payload'
    vi.resetModules()
    await import('./App')

    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/share link|range/i))
    expect(loadSavedRanges()).toHaveLength(0)
    // No range to land on, so the app falls back to its default screen.
    expect(window.location.hash).toBe('')
    alert.mockRestore()
  })
})

describe('Practice overlay', () => {
  it('runs a queued review through every due range and records each session', async () => {
    const user = userEvent.setup()
    seedRange('a', 'UTG open')
    seedRange('b', 'BTN open')
    window.location.hash = '#/today'
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start review' }))

    // First drill of the queue with a visible position and progress bar (the
    // practice subtree loads lazily, so wait for it to mount).
    expect(await screen.findByText('UTG open · 1/2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    // Answer one hand, close early -> peak-end summary, then advance the queue.
    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next range' }))

    expect(screen.getByText('BTN open · 2/2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'In range' }))
    await user.click(screen.getByRole('button', { name: 'Close practice' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // Both schedules advanced, so Today shows the caught-up state.
    expect(screen.getByRole('region', { name: 'All caught up' })).toBeInTheDocument()
    expect(Object.keys(loadReviewStates()).sort()).toEqual(['a', 'b'])
  })

  it('abandons the overlay without recording when closed before any answer', async () => {
    const user = userEvent.setup()
    seedRange('a', 'UTG open')
    window.location.hash = '#/today'
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start review' }))
    await user.click(await screen.findByRole('button', { name: 'Close practice' }))

    expect(loadReviewStates()).toEqual({})
    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument()
  })

  it('reviews a single due range from its row without a queue position', async () => {
    const user = userEvent.setup()
    seedRange('a', 'UTG open')
    seedRange('b', 'BTN open')
    window.location.hash = '#/today'
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Review' })[1])
    expect(await screen.findByRole('dialog', { name: 'BTN open' })).toBeInTheDocument()
    expect(screen.queryByText(/1\/2/)).not.toBeInTheDocument()
  })

  it('leaves the drill when the browser Back button is pressed', async () => {
    const user = userEvent.setup()
    seedRange('a', 'UTG open')
    window.location.hash = '#/today'
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start review' }))
    expect(await screen.findByRole('button', { name: 'Close practice' })).toBeInTheDocument()

    // The session pushed a duplicate entry; popping it is what Back does.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })

    expect(screen.queryByRole('button', { name: 'Close practice' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument()
    // Back exits the session without moving the app off the screen underneath.
    expect(window.location.hash).toBe('#/today')
  })

  it('opens the mode picker from the range page Practice button', async () => {
    const user = userEvent.setup()
    seedRange('a', 'UTG open')
    window.location.hash = '#/library/a'
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Practice' }))
    expect(await screen.findByText('How do you want to train?')).toBeInTheDocument()
    await user.click(screen.getByText('Recognize hands'))
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
  })
})
