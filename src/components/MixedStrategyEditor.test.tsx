import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { MixedStrategyEditor } from './MixedStrategyEditor'
import type { HandMixedStrategy } from '../domain/mixedStrategy'

describe('MixedStrategyEditor', () => {
  it('renders a slider for every action with the right initial values', () => {
    const strategy: HandMixedStrategy = [
      { action: 'fourBet', frequency: 60 },
      { action: 'fold', frequency: 40 },
    ]
    render(<MixedStrategyEditor strategy={strategy} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Fold')).toHaveValue('40')
    expect(screen.getByLabelText('4-bet')).toHaveValue('60')
    expect(screen.getByLabelText('Call')).toHaveValue('0')
  })

  it('shows the total and validity indicator', () => {
    render(
      <MixedStrategyEditor
        strategy={[
          { action: 'fourBet', frequency: 50 },
          { action: 'fold', frequency: 50 },
        ]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Total: 100%/)).toHaveTextContent('✓')
  })

  it('fires onChange with the updated frequency when a slider moves', () => {
    const onChange = vi.fn()
    render(
      <MixedStrategyEditor
        strategy={[{ action: 'fold', frequency: 100 }]}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Raise'), { target: { value: '30' } })

    expect(onChange).toHaveBeenCalledWith([
      { action: 'fold', frequency: 100 },
      { action: 'raise', frequency: 30 },
    ])
  })
})
