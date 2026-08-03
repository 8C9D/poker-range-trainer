import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandNotesEditor } from './HandNotesEditor'

describe('HandNotesEditor', () => {
  it('shows a message when the range has no hands', () => {
    render(<HandNotesEditor hands={[]} notes={{}} onChange={vi.fn()} />)
    expect(screen.getByText(/add hands to the range/i)).toBeInTheDocument()
  })

  it('is a titled landmark so the notes are reachable without hunting for the picker', () => {
    render(<HandNotesEditor hands={['AA']} notes={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Hand notes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hand notes', level: 2 })).toBeInTheDocument()
  })

  it('keeps the landmark when the range has no hands', () => {
    render(<HandNotesEditor hands={[]} notes={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Hand notes' })).toBeInTheDocument()
  })

  it('renders a hand picker and a note field', () => {
    render(<HandNotesEditor hands={['AA', 'KK']} notes={{}} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Hand')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('orders the hand options canonically regardless of input order', () => {
    render(<HandNotesEditor hands={['KK', 'AA']} notes={{}} onChange={vi.fn()} />)
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['AA', 'KK'])
  })

  it('reflects an existing note for the default (first) hand', () => {
    render(<HandNotesEditor hands={['AA', 'KK']} notes={{ AA: 'open always' }} onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('open always')
  })

  it('reports an updated map when typing a note', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<HandNotesEditor hands={['AA']} notes={{}} onChange={onChange} />)

    await user.type(screen.getByRole('textbox'), 'x')

    expect(onChange).toHaveBeenLastCalledWith({ AA: 'x' })
  })

  it('removes the hand key when the note is cleared', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<HandNotesEditor hands={['AA']} notes={{ AA: 'note' }} onChange={onChange} />)

    await user.clear(screen.getByRole('textbox'))

    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it("shows the active hand's note after switching hands", async () => {
    const user = userEvent.setup()
    render(
      <HandNotesEditor
        hands={['AA', 'KK']}
        notes={{ AA: 'aces note', KK: 'kings note' }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('textbox')).toHaveValue('aces note')

    await user.selectOptions(screen.getByLabelText('Hand'), 'KK')

    expect(screen.getByRole('textbox')).toHaveValue('kings note')
  })
})
