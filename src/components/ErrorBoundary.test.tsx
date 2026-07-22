import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
