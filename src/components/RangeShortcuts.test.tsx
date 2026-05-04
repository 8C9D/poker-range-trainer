import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeShortcuts } from './RangeShortcuts'
import {
  selectAllBroadways,
  selectAllPairs,
  selectOffsuitBroadways,
  selectPairsAtOrAbove,
  selectSuitedBroadways,
} from '../domain/rangeShortcuts'

function section() {
  return screen.getByRole('region', { name: 'Range shortcuts' })
}

describe('RangeShortcuts', () => {
  it('renders the shortcut section with all shortcut buttons', () => {
    render(<RangeShortcuts onAddHands={vi.fn()} />)

    const buttons = within(section()).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Add all pairs',
      'Add 77+',
      'Add suited broadways',
      'Add offsuit broadways',
      'Add all broadways',
    ])
  })

  it.each([
    ['Add all pairs', selectAllPairs()],
    ['Add 77+', selectPairsAtOrAbove('77')],
    ['Add suited broadways', selectSuitedBroadways()],
    ['Add offsuit broadways', selectOffsuitBroadways()],
    ['Add all broadways', selectAllBroadways()],
  ])('calls onAddHands with the %s group', async (label, expectedHands) => {
    const user = userEvent.setup()
    const onAddHands = vi.fn()
    render(<RangeShortcuts onAddHands={onAddHands} />)

    await user.click(screen.getByRole('button', { name: label }))

    expect(onAddHands).toHaveBeenCalledExactlyOnceWith(expectedHands)
  })
})
