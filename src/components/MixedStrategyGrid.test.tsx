import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MixedStrategyGrid } from './MixedStrategyGrid'

describe('MixedStrategyGrid', () => {
  it('colors a hand by its primary action', () => {
    render(
      <MixedStrategyGrid
        mixedStrategies={{
          AA: [
            { action: 'fourBet', frequency: 70 },
            { action: 'fold', frequency: 30 },
          ],
        }}
      />,
    )
    expect(screen.getByText('AA')).toHaveAttribute('data-primary', 'fourBet')
  })

  it('renders hands without a strategy as muted (no primary)', () => {
    render(<MixedStrategyGrid mixedStrategies={{}} />)
    const cell = screen.getByText('KK')
    expect(cell).toHaveAttribute('data-primary', 'none')
    expect(cell).toHaveClass('is-muted')
  })
})
