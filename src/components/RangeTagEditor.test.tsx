import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeTagEditor } from './RangeTagEditor'

describe('RangeTagEditor', () => {
  it('titles its section at the same level as the other editor blocks', () => {
    render(<RangeTagEditor tags={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Tags', level: 2 })).toBeInTheDocument()
  })

  it('adds a typed tag on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RangeTagEditor tags={[]} onChange={onChange} />)
    await user.type(screen.getByLabelText('Add a tag'), 'MTT{Enter}')
    expect(onChange).toHaveBeenCalledWith(['MTT'])
  })

  it('adds and trims a tag via the Add button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RangeTagEditor tags={['MTT']} onChange={onChange} />)
    await user.type(screen.getByLabelText('Add a tag'), '  Cash ')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith(['MTT', 'Cash'])
  })

  it('does not add a case-insensitive duplicate', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RangeTagEditor tags={['MTT']} onChange={onChange} />)
    await user.type(screen.getByLabelText('Add a tag'), 'mtt{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a tag via its remove button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RangeTagEditor tags={['MTT', 'Cash']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Remove tag MTT' }))
    expect(onChange).toHaveBeenCalledWith(['Cash'])
  })

  it('disables Add for a blank draft', () => {
    render(<RangeTagEditor tags={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})
