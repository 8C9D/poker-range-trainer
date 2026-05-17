import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HandHeatmap } from './HandHeatmap'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'

function stat(hand: string, over: Partial<HandAccuracyStat> = {}): HandAccuracyStat {
  return { hand, attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0, ...over }
}

describe('HandHeatmap', () => {
  it('renders all 169 hands as read-only cells', () => {
    const { container } = render(<HandHeatmap accuracy={{}} />)
    expect(container.querySelectorAll('.heat-cell')).toHaveLength(169)
    // Read-only: no buttons.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('colors cells by accuracy level and marks untested hands', () => {
    const accuracy: RangeHandAccuracy = {
      AA: stat('AA', { attempts: 4, correct: 4 }), // 100% -> high
      KK: stat('KK', { attempts: 4, correct: 1 }), // 25% -> low
      QQ: stat('QQ', { attempts: 4, correct: 3 }), // 75% -> medium
    }
    render(<HandHeatmap accuracy={accuracy} />)

    expect(screen.getByText('AA').getAttribute('data-heat')).toBe('high')
    expect(screen.getByText('KK').getAttribute('data-heat')).toBe('low')
    expect(screen.getByText('QQ').getAttribute('data-heat')).toBe('medium')
    // A hand with no recorded stats reads as untested.
    expect(screen.getByText('72o').getAttribute('data-heat')).toBe('untested')
  })
})
