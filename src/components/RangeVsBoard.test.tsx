import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeVsBoard } from './RangeVsBoard'

describe('RangeVsBoard', () => {
  it('shows the texture and category breakdown for a valid flop', async () => {
    render(<RangeVsBoard hands={['AA', 'AKs']} />)
    await userEvent.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    // Texture chip from FlopTexture.
    expect(screen.getByText('Top pair')).toBeInTheDocument()
    // AA = 6 overpair combos appears in the breakdown table.
    const overpairRow = screen.getByText('Overpair').closest('tr')
    expect(overpairRow).toHaveTextContent('6')
  })

  it('shows an inline error for an invalid board', async () => {
    render(<RangeVsBoard hands={['AA']} />)
    await userEvent.type(screen.getByLabelText('Flop'), 'Kd7c')
    expect(screen.getByRole('alert')).toHaveTextContent(/exactly three/i)
  })

  it('renders nothing extra before a board is entered', () => {
    render(<RangeVsBoard hands={['AA']} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Overpair')).not.toBeInTheDocument()
  })
})
