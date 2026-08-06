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

  it('announces each cell\'s accuracy to assistive tech via an accessible name', () => {
    const accuracy: RangeHandAccuracy = { AA: stat('AA', { attempts: 5, correct: 4 }) }
    render(<HandHeatmap accuracy={accuracy} />)
    expect(screen.getByRole('img', { name: 'AA: 80% (5 attempts)' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '72o: untested' })).toBeInTheDocument()
  })

  it('counts a single attempt in the singular', () => {
    // The colour is the whole cell to everyone else; this name is the only place
    // the number is said, so it is the one that has to read as English.
    const accuracy: RangeHandAccuracy = { AA: stat('AA', { attempts: 1, correct: 0 }) }
    render(<HandHeatmap accuracy={accuracy} />)
    expect(screen.getByRole('img', { name: 'AA: 0% (1 attempt)' })).toBeInTheDocument()
  })
})
