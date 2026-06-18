import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { SavedRange } from '../types/range'
import { buildRangePack, type RangePack } from '../domain/rangeTransfer'
import { SharedPackPage } from './SharedPackPage'

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

function makePack(): RangePack {
  return buildRangePack('Cash openers', [
    makeRange({ id: 'r1', name: 'BTN open' }),
    makeRange({ id: 'r2', name: 'CO open' }),
  ])
}

const configured = () => true

describe('SharedPackPage', () => {
  it('shows the local-only message when cloud is unconfigured', () => {
    render(<SharedPackPage id="x" fetchSharedPack={vi.fn()} cloudConfigured={() => false} />)
    expect(screen.getByText(/local-only mode/i)).toBeInTheDocument()
  })

  it('renders the pack name and each range once loaded', async () => {
    render(
      <SharedPackPage
        id="abc"
        token="tok"
        fetchSharedPack={vi.fn().mockResolvedValue(makePack())}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Cash openers' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CO open' })).toBeInTheDocument()
    expect(screen.getByText('2 ranges')).toBeInTheDocument()
    expect(screen.getByText(/Read-only shared pack/)).toBeInTheDocument()
  })

  it('passes the id and token to the fetcher', async () => {
    const fetchSharedPack = vi.fn().mockResolvedValue(makePack())
    render(
      <SharedPackPage
        id="abc"
        token="tok"
        fetchSharedPack={fetchSharedPack}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(fetchSharedPack).toHaveBeenCalledWith('abc', 'tok'))
  })

  it('shows a not-found message when nothing matches', async () => {
    render(
      <SharedPackPage
        id="missing"
        fetchSharedPack={vi.fn().mockResolvedValue(null)}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(screen.getByText(/was not found/i)).toBeInTheDocument())
  })

  it('shows an error message when the fetch rejects', async () => {
    render(
      <SharedPackPage
        id="x"
        fetchSharedPack={vi.fn().mockRejectedValue(new Error('db down'))}
        cloudConfigured={configured}
      />,
    )
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('db down'))
  })
})
