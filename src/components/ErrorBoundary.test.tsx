import { describe, it, expect, vi, afterEach } from 'vitest'
import { lazy, Suspense } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

// Throws based on external state so a retry can render a non-throwing tree.
let shouldCrash = true
function Boom() {
  if (shouldCrash) throw new Error('kaboom')
  return <p>Recovered</p>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows a recoverable fallback with the error message when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldCrash = true
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('recovers when Try again is clicked and the child no longer throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldCrash = true
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('Recovered')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/**
 * What happens when a lazily-loaded subtree cannot be fetched.
 *
 * The practice and workout hosts are code-split, and the service worker serves
 * the app shell from cache offline — so a first-ever offline "Start review" asks
 * for a chunk that was never downloaded. React caches a rejected `lazy` promise,
 * so the generic screen's "Try again" re-renders straight back into the same
 * error: unguarded, that failure is both fatal to the whole app and permanent.
 * These pin why App wraps each code-split host in a boundary of its own.
 */
describe('ErrorBoundary around a chunk that will not load', () => {
  /** A code-split component whose chunk never arrives, as React sees it. */
  const Unfetchable = lazy(() =>
    Promise.reject(new Error('Failed to fetch dynamically imported module')),
  )

  const inBoundary = (fallback?: () => React.ReactNode) => (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={<div>Loading</div>}>
        <Unfetchable />
      </Suspense>
    </ErrorBoundary>
  )

  it('cannot be recovered by re-rendering, which is why the fallback exists', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(inBoundary())

    await screen.findByText('Something went wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    // React replays the cached rejection, so the generic screen is a dead end.
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows the caller its own fallback instead, so it can offer a way back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onGiveUp = vi.fn()
    render(
      inBoundary(() => (
        <div role="alert">
          <p>Could not load practice</p>
          <button type="button" onClick={onGiveUp}>
            Back to the app
          </button>
        </div>
      )),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load practice')
    expect(screen.queryByText('Something went wrong')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the app' }))
    expect(onGiveUp).toHaveBeenCalled()
  })
})
