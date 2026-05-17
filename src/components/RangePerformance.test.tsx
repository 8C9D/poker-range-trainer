import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangePerformance } from './RangePerformance'
import type { HandAccuracyStat, RangeHandAccuracy } from '../types/practice'
import type { SavedRange } from '../types/range'

function makeRange(overrides: Partial<SavedRange> = {}): SavedRange {
  return {
    id: 'r1',
    name: 'Test Range',
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function stat(hand: string, over: Partial<HandAccuracyStat> = {}): HandAccuracyStat {
  return { hand, attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0, ...over }
}

function dataRows() {
  // Drop the header row.
  return within(screen.getByRole('table', { name: 'Per-hand accuracy' }))
    .getAllByRole('row')
    .slice(1)
}

describe('RangePerformance', () => {
  it('shows the range name and an empty state when there is no data', () => {
    const { container } = render(
      <RangePerformance range={makeRange({ name: 'BTN' })} accuracy={{}} onClose={vi.fn()} onPracticeMistakes={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: /Performance: BTN/ })).toBeInTheDocument()
    expect(screen.getByText(/No practice data yet/)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Per-hand accuracy' })).not.toBeInTheDocument()
    // No heatmap in the empty state.
    expect(container.querySelector('.hand-heatmap')).toBeNull()
  })

  it('lists hands weakest-first with accuracy and attempts', () => {
    const accuracy: RangeHandAccuracy = {
      AA: stat('AA', { attempts: 4, correct: 4 }), // 100%
      KK: stat('KK', { attempts: 4, correct: 1, falseNegatives: 3 }), // 25%
    }
    const { container } = render(
      <RangePerformance range={makeRange()} accuracy={accuracy} onClose={vi.fn()} onPracticeMistakes={vi.fn()} />,
    )

    // The heatmap is shown alongside the table when there is data.
    expect(container.querySelector('.hand-heatmap')).not.toBeNull()

    const rows = dataRows()
    expect(within(rows[0]).getByText('KK')).toBeInTheDocument()
    expect(within(rows[0]).getByText('25%')).toBeInTheDocument()
    expect(within(rows[1]).getByText('AA')).toBeInTheDocument()
    expect(within(rows[1]).getByText('100%')).toBeInTheDocument()
  })

  it('shows the missed and wrongly-included counts per hand', () => {
    const accuracy: RangeHandAccuracy = {
      QQ: stat('QQ', { attempts: 5, correct: 2, falseNegatives: 2, falsePositives: 1 }),
    }
    render(<RangePerformance range={makeRange()} accuracy={accuracy} onClose={vi.fn()} onPracticeMistakes={vi.fn()} />)

    const [row] = dataRows()
    expect(within(row).getByText('QQ')).toBeInTheDocument()
    expect(within(row).getByText('40%')).toBeInTheDocument() // 2/5
    expect(within(row).getByText('5')).toBeInTheDocument() // attempts
    expect(within(row).getByText('2')).toBeInTheDocument() // missed (false negatives)
    expect(within(row).getByText('1')).toBeInTheDocument() // wrongly included (false positives)
  })

  it('calls onClose when "Back to library" is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <RangePerformance
        range={makeRange()}
        accuracy={{}}
        onClose={onClose}
        onPracticeMistakes={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Practice mistakes" only when the range has mistakes', () => {
    const { rerender } = render(
      <RangePerformance
        range={makeRange()}
        accuracy={{ AA: stat('AA', { attempts: 3, correct: 3 }) }} // no mistakes
        onClose={vi.fn()}
        onPracticeMistakes={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Practice mistakes' })).not.toBeInTheDocument()

    rerender(
      <RangePerformance
        range={makeRange()}
        accuracy={{ AA: stat('AA', { attempts: 3, correct: 1, falseNegatives: 2 }) }}
        onClose={vi.fn()}
        onPracticeMistakes={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Practice mistakes' })).toBeInTheDocument()
  })

  it('calls onPracticeMistakes when "Practice mistakes" is clicked', async () => {
    const user = userEvent.setup()
    const onPracticeMistakes = vi.fn()
    render(
      <RangePerformance
        range={makeRange()}
        accuracy={{ KK: stat('KK', { attempts: 4, correct: 1, falseNegatives: 3 }) }}
        onClose={vi.fn()}
        onPracticeMistakes={onPracticeMistakes}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Practice mistakes' }))

    expect(onPracticeMistakes).toHaveBeenCalledTimes(1)
  })
})
