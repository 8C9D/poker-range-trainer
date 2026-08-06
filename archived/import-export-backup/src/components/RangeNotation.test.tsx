import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeNotation } from './RangeNotation'

function currentField() {
  return screen.getByLabelText('Current range')
}

function inputField() {
  return screen.getByLabelText('Paste or type notation')
}

function applyButton() {
  return screen.getByRole('button', { name: 'Apply Notation' })
}

describe('RangeNotation', () => {
  it('renders the notation section with an apply button', () => {
    render(<RangeNotation selectedHands={[]} onReplaceHands={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Range notation' })).toBeInTheDocument()
    expect(applyButton()).toBeInTheDocument()
  })

  it('shows an empty current range when nothing is selected', () => {
    render(<RangeNotation selectedHands={[]} onReplaceHands={vi.fn()} />)

    expect(currentField()).toHaveValue('')
  })

  it('shows the selected hands as canonical notation', () => {
    // Input order does not matter; the formatter sorts into 13x13 order.
    render(<RangeNotation selectedHands={['22', 'AA', 'AKs']} onReplaceHands={vi.fn()} />)

    expect(currentField()).toHaveValue('AA, AKs, 22')
  })

  it('applies an exact-hand list', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />)

    await user.type(inputField(), 'AA, KK')
    await user.click(applyButton())

    expect(onReplaceHands).toHaveBeenCalledExactlyOnceWith(['AA', 'KK'])
  })

  it('applies plus notation by expanding it', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />)

    await user.type(inputField(), 'TT+')
    await user.click(applyButton())

    expect(onReplaceHands).toHaveBeenCalledExactlyOnceWith(['AA', 'KK', 'QQ', 'JJ', 'TT'])
  })

  it('applies a comma-separated mixed list in canonical order', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />)

    await user.type(inputField(), 'AKs, AKo, AA')
    await user.click(applyButton())

    expect(onReplaceHands).toHaveBeenCalledExactlyOnceWith(['AA', 'AKs', 'AKo'])
  })

  it('applies dash notation by expanding it', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={[]} onReplaceHands={onReplaceHands} />)

    await user.type(inputField(), 'A5s-A2s')
    await user.click(applyButton())

    expect(onReplaceHands).toHaveBeenCalledExactlyOnceWith(['A5s', 'A4s', 'A3s', 'A2s'])
  })

  it('clears the selection when empty notation is applied', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={['AA']} onReplaceHands={onReplaceHands} />)

    // Input is left blank, so applying it parses to an empty range.
    await user.click(applyButton())

    expect(onReplaceHands).toHaveBeenCalledExactlyOnceWith([])
  })

  it('shows an error and does not replace hands for invalid notation', async () => {
    const user = userEvent.setup()
    const onReplaceHands = vi.fn()
    render(<RangeNotation selectedHands={['AA']} onReplaceHands={onReplaceHands} />)

    await user.type(inputField(), 'AK')
    await user.click(applyButton())

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onReplaceHands).not.toHaveBeenCalled()
  })

  it('clears a previous error after a successful apply', async () => {
    const user = userEvent.setup()
    render(<RangeNotation selectedHands={[]} onReplaceHands={vi.fn()} />)

    // Bare rank-pair notation ("AK") is unsupported, so it surfaces an error first.
    await user.type(inputField(), 'AK')
    await user.click(applyButton())
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // A valid apply should clear the previous error.
    await user.clear(inputField())
    await user.type(inputField(), '77+')
    await user.click(applyButton())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
