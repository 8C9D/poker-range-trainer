import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpotCoverage } from './SpotCoverage'
import type { RangeMetadata, SavedRange } from '../types/range'

function makeRange(name: string, metadata: RangeMetadata): SavedRange {
  return {
    id: name,
    name,
    hands: ['AA'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    metadata,
  }
}

const btnOpenCell = 'BTN folded to you: 1 of 1 covered'

describe('SpotCoverage', () => {
  it('summarizes an uncovered library', () => {
    render(<SpotCoverage ranges={[]} />)

    expect(screen.getByRole('button', { name: 'BTN folded to you: 0 of 1 covered' })).toBeVisible()
    expect(screen.getByText(/of 65 standard spots covered · 0%/)).toBeVisible()
  })

  it('counts a covering range in its seat and situation cell', () => {
    render(<SpotCoverage ranges={[makeRange('BTN open', { position: 'btn', actionType: 'open' })]} />)

    expect(screen.getByRole('button', { name: btnOpenCell })).toBeVisible()
    expect(screen.getByText(/1 of 65 standard spots covered/)).toBeVisible()
  })

  it('lists the covering range for a cell when it is selected', async () => {
    const user = userEvent.setup()
    render(<SpotCoverage ranges={[makeRange('BTN open', { position: 'btn', actionType: 'open' })]} />)
    await user.click(screen.getByRole('button', { name: btnOpenCell }))

    const detail = screen.getByRole('list', { name: 'Spots in the selected cell' })
    expect(within(detail).getByText('6-max, 100bb. Folded to you on the BTN.')).toBeVisible()
    expect(within(detail).getByRole('link', { name: 'BTN open' })).toHaveAttribute(
      'href',
      '#/library/BTN%20open',
    )
  })

  it('links a missing spot into a pre-filled new range', async () => {
    const user = userEvent.setup()
    render(<SpotCoverage ranges={[]} />)
    await user.click(screen.getByRole('button', { name: 'BB facing an open: 0 of 5 covered' }))

    const detail = screen.getByRole('list', { name: 'Spots in the selected cell' })
    const links = within(detail).getAllByRole('link', { name: 'Create' })
    expect(links[0]).toHaveAttribute(
      'href',
      '#/library/new?position=bb&action=defend&vs=utg&table=sixMax&stack=100',
    )
  })

  it('closes the detail list when the open cell is clicked again', async () => {
    const user = userEvent.setup()
    render(<SpotCoverage ranges={[]} />)
    const cell = screen.getByRole('button', { name: 'BTN folded to you: 0 of 1 covered' })

    await user.click(cell)
    expect(screen.getByRole('list', { name: 'Spots in the selected cell' })).toBeVisible()
    await user.click(cell)
    expect(screen.queryByRole('list', { name: 'Spots in the selected cell' })).toBeNull()
  })

  it('opens on the format the library is mostly written for', () => {
    render(
      <SpotCoverage
        ranges={[makeRange('hu btn', { position: 'btn', tableSize: 'headsUp', stackDepthBb: 20 })]}
      />,
    )

    expect(screen.getByLabelText('Table size for spot coverage')).toHaveValue('headsUp')
    expect(screen.getByLabelText('Stack depth for spot coverage')).toHaveValue('20')
  })

  it('redraws the map for another table size', async () => {
    const user = userEvent.setup()
    render(<SpotCoverage ranges={[]} />)

    await user.selectOptions(screen.getByLabelText('Table size for spot coverage'), 'headsUp')

    expect(screen.queryByRole('row', { name: /^CO/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'BTN folded to you: 0 of 1 covered' })).toBeVisible()
  })

  it('offers to play the covered spots at the shown format', async () => {
    const user = userEvent.setup()
    const onPlaySpots = vi.fn()
    render(
      <SpotCoverage
        ranges={[makeRange('BTN open', { position: 'btn', actionType: 'open' })]}
        onPlaySpots={onPlaySpots}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Stack depth for spot coverage'), '40')
    await user.click(screen.getByRole('button', { name: 'Play these spots' }))

    expect(onPlaySpots).toHaveBeenCalledWith({ tableSize: 'sixMax', stackDepthBb: 40 })
  })

  it('hides the play button when nothing is covered', () => {
    render(<SpotCoverage ranges={[]} onPlaySpots={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Play these spots' })).toBeNull()
  })

  it('marks a seat and situation that has no standard spot', () => {
    render(<SpotCoverage ranges={[]} />)
    const utgRow = screen.getAllByRole('row')[1]

    expect(within(utgRow).getAllByLabelText('No spot').length).toBeGreaterThan(0)
  })
})
