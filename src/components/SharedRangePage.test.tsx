import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { SavedRange } from '../types/range'
import { SharedRangePage } from './SharedRangePage'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'BTN open',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

const configured = () => true

describe('SharedRangePage', () => {
  it('shows the local-only message when cloud is unconfigured', () => {
    render(
      <SharedRangePage id="x" fetchSharedRange={vi.fn()} cloudConfigured={() => false} />,
    )
    expect(screen.getByText(/local-only mode/i)).toBeInTheDocument()
  })

  it('renders the range read-only once loaded', async () => {
    const range = makeRange()
    render(
      <SharedRangePage
        id="abc"
        token="tok"
        fetchSharedRange={vi.fn().mockResolvedValue(range)}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'BTN open' })).toBeInTheDocument())
    expect(screen.getByText(/2 hands/)).toBeInTheDocument()
    expect(screen.getByText(/Read-only shared range/)).toBeInTheDocument()
  })

  it('passes the id and token to the fetcher', async () => {
    const fetchSharedRange = vi.fn().mockResolvedValue(makeRange())
    render(
      <SharedRangePage
        id="abc"
        token="tok"
        fetchSharedRange={fetchSharedRange}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(fetchSharedRange).toHaveBeenCalledWith('abc', 'tok'))
  })

  it('shows a not-found message when nothing matches', async () => {
    render(
      <SharedRangePage
        id="missing"
        fetchSharedRange={vi.fn().mockResolvedValue(null)}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(screen.getByText(/was not found/i)).toBeInTheDocument())
  })

  it('shows an error message when the fetch rejects', async () => {
    render(
      <SharedRangePage
        id="x"
        fetchSharedRange={vi.fn().mockRejectedValue(new Error('db down'))}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('db down'))
  })
})
