import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MixedNotation } from './MixedNotation'
import type { HandMixedStrategy } from '../domain/mixedStrategy'

const chart: Record<string, HandMixedStrategy> = {
  AA: [
    { action: 'fold', frequency: 40 },
    { action: 'raise', frequency: 60 },
  ],
}

describe('MixedNotation', () => {
  it('mirrors the current chart as read-only notation', () => {
    render(<MixedNotation mixedStrategies={chart} onReplace={vi.fn()} />)
    expect(screen.getByLabelText('Current frequencies')).toHaveValue('AA: fold 40, raise 60')
  })

  it('applies pasted notation via onReplace', async () => {
    const user = userEvent.setup()
    const onReplace = vi.fn()
    render(<MixedNotation mixedStrategies={{}} onReplace={onReplace} />)

    await user.type(screen.getByLabelText('Paste or type frequency notation'), 'KK: raise 100')
    await user.click(screen.getByRole('button', { name: 'Apply Frequency Notation' }))

    expect(onReplace).toHaveBeenCalledWith({ KK: [{ action: 'raise', frequency: 100 }] })
  })

  it('shows an error for invalid notation', async () => {
    const user = userEvent.setup()
    render(<MixedNotation mixedStrategies={{}} onReplace={vi.fn()} />)

    await user.type(screen.getByLabelText('Paste or type frequency notation'), 'ZZ: fold 100')
    await user.click(screen.getByRole('button', { name: 'Apply Frequency Notation' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid hand/)
  })
})
