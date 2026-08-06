import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('treats a payload with non-canonical hands as not-found instead of crashing', async () => {
    const malicious = makeRange({ hands: ['ZZ', 'AA'] as unknown as SavedRange['hands'] })
    render(
      <SharedRangePage
        id="abc"
        fetchSharedRange={vi.fn().mockResolvedValue(malicious)}
        cloudConfigured={configured}
        onForkRange={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText(/was not found/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
  })

  it.each([
    ['a name that is not a string', { name: { toString: 1 } }],
    ['no id', { id: '' }],
    ['an unparseable createdAt', { createdAt: 'whenever' }],
    // The page counts combos off this before anything saves the payload, so a
    // number where a combo list belongs threw out of `new Set(...)` mid-render.
    ['an unreadable comboSelections entry', { comboSelections: { AA: 5 } }],
    ['a mixedStrategies entry that is not a list', { mixedStrategies: { AA: {} } }],
  ])('treats a payload with %s as not-found instead of crashing', async (_label, broken) => {
    // Canonical hands are not enough: the name lands in <h1>{range.name}</h1>,
    // where a non-string takes the whole page down as an invalid React child.
    const malicious = { ...makeRange(), ...broken } as unknown as SavedRange
    render(
      <SharedRangePage
        id="abc"
        fetchSharedRange={vi.fn().mockResolvedValue(malicious)}
        cloudConfigured={configured}
        onForkRange={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText(/was not found/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
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

  it('forks the range to the local library and then confirms', async () => {
    const user = userEvent.setup()
    const range = makeRange()
    const onForkRange = vi.fn()
    render(
      <SharedRangePage
        id="abc"
        fetchSharedRange={vi.fn().mockResolvedValue(range)}
        cloudConfigured={configured}
        onForkRange={onForkRange}
      />,
    )

    const button = await screen.findByRole('button', { name: 'Save to my library' })
    await user.click(button)

    expect(onForkRange).toHaveBeenCalledExactlyOnceWith(range)
    expect(screen.getByText('Saved to your library.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
  })

  it('reports a fork the local store refused instead of confirming it', async () => {
    const user = userEvent.setup()
    render(
      <SharedRangePage
        id="abc"
        fetchSharedRange={vi.fn().mockResolvedValue(makeRange())}
        cloudConfigured={configured}
        onForkRange={() => {
          throw new Error('Could not save: storage is full or unavailable.')
        }}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Save to my library' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    expect(screen.queryByText('Saved to your library.')).not.toBeInTheDocument()
    // The button stays, so the viewer can retry after freeing space.
    expect(screen.getByRole('button', { name: 'Save to my library' })).toBeInTheDocument()
  })

  it('shows no fork button when onForkRange is not provided', async () => {
    render(
      <SharedRangePage
        id="abc"
        fetchSharedRange={vi.fn().mockResolvedValue(makeRange())}
        cloudConfigured={configured}
      />,
    )
    await screen.findByRole('heading', { name: 'BTN open' })
    expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
  })

  it('shows no fork button when the range is not found', async () => {
    render(
      <SharedRangePage
        id="missing"
        fetchSharedRange={vi.fn().mockResolvedValue(null)}
        cloudConfigured={configured}
        onForkRange={vi.fn()}
      />,
    )
    await screen.findByText(/was not found/i)
    expect(screen.queryByRole('button', { name: 'Save to my library' })).not.toBeInTheDocument()
  })
})
