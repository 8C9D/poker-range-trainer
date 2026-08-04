import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuildFromMemoryPractice } from './BuildFromMemoryPractice'
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

describe('BuildFromMemoryPractice', () => {
  it('shows the range name and a blank grid with no hand pre-selected', () => {
    render(<BuildFromMemoryPractice range={makeRange({ name: 'BTN Open' })} onExit={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: /Build from memory: BTN Open/ }),
    ).toBeInTheDocument()
    // The full 13x13 grid renders, but the saved range's membership is hidden:
    // representative cells exist and nothing starts selected.
    expect(screen.getByRole('button', { name: 'AA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
  })

  it('updates the selected-hands count as the user paints the grid', async () => {
    const user = userEvent.setup()
    render(<BuildFromMemoryPractice range={makeRange()} onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    expect(screen.getByText('1 hand selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'KK' }))
    expect(screen.getByText('2 hands selected')).toBeInTheDocument()
  })

  it('reports a perfect rebuild when the built range matches exactly', async () => {
    const user = userEvent.setup()
    render(<BuildFromMemoryPractice range={makeRange({ hands: ['AA', 'KK'] })} onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(screen.getByText(/Perfect/)).toBeInTheDocument()
    expect(screen.getByText('Correct: 2 of 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hands you missed')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Hands you added by mistake')).not.toBeInTheDocument()
  })

  it('lists missed and added-by-mistake hands for an imperfect rebuild', async () => {
    const user = userEvent.setup()
    // Target AA, KK; build AA, QQ -> KK missed, QQ added by mistake, AA correct.
    render(<BuildFromMemoryPractice range={makeRange({ hands: ['AA', 'KK'] })} onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'QQ' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(screen.getByText('Correct: 1 of 2')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Hands you got right')).getByText('AA')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Hands you missed')).getByText('KK')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Hands you added by mistake')).getByText('QQ'),
    ).toBeInTheDocument()
  })

  it('clears the grid and returns to building when "Try again" is clicked', async () => {
    const user = userEvent.setup()
    render(<BuildFromMemoryPractice range={makeRange()} onExit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    // Back on the build screen with a fresh, empty grid.
    expect(screen.getByRole('button', { name: 'Check my range' })).toBeInTheDocument()
    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('calls onExit when "Back to library" is clicked', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<BuildFromMemoryPractice range={makeRange()} onExit={onExit} />)

    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('reports the checked build as a scored session', async () => {
    const user = userEvent.setup()
    const onScored = vi.fn().mockReturnValue(null)
    // Target AA, KK; build AA, QQ -> one right, one forgotten, one added.
    render(
      <BuildFromMemoryPractice
        range={makeRange({ hands: ['AA', 'KK'] })}
        onExit={vi.fn()}
        onScored={onScored}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'QQ' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(onScored).toHaveBeenCalledTimes(1)
    expect(onScored).toHaveBeenCalledWith({
      totalQuestions: 3,
      correctAnswers: 1,
      accuracyPercentage: (1 / 3) * 100,
    })
  })

  it('does not score a check on a blank grid, and says so', async () => {
    const user = userEvent.setup()
    const onScored = vi.fn().mockReturnValue(null)
    render(
      <BuildFromMemoryPractice range={makeRange()} onExit={vi.fn()} onScored={onScored} />,
    )

    // Checking an empty build is how you ask to be shown the answer, so the
    // results still render — they just do not count as a session.
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(onScored).not.toHaveBeenCalled()
    expect(screen.getByText('Correct: 0 of 2')).toBeInTheDocument()
    expect(screen.getByText(/Nothing logged/)).toBeInTheDocument()
    expect(screen.queryByText(/Logged as a practice session/)).not.toBeInTheDocument()
  })

  it('says a scored build counted, and stops saying it after "Try again"', async () => {
    const user = userEvent.setup()
    render(
      <BuildFromMemoryPractice
        range={makeRange({ hands: ['AA', 'KK'] })}
        onExit={vi.fn()}
        onScored={() => null}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))
    // One of the two hands right, one forgotten.
    expect(screen.getByText('Logged as a practice session · 50%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByText(/Logged as a practice session/)).not.toBeInTheDocument()
  })

  it('does not claim a build was logged when the save failed', async () => {
    const user = userEvent.setup()
    render(
      <BuildFromMemoryPractice
        range={makeRange()}
        onExit={vi.fn()}
        onScored={() => 'Storage is full.'}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(screen.queryByText(/Logged as a practice session/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is full.')
  })

  it('shows why the checked build could not be saved, and clears it on "Try again"', async () => {
    const user = userEvent.setup()
    render(
      <BuildFromMemoryPractice
        range={makeRange()}
        onExit={vi.fn()}
        onScored={() => 'Storage is full.'}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Check my range' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is full.')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
