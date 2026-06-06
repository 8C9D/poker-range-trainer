import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FlopTexture } from './FlopTexture'

describe('FlopTexture', () => {
  it('renders the cards and texture tags for a valid flop', () => {
    render(<FlopTexture board="AsKs2s" />)
    expect(screen.getByLabelText('Flop')).toHaveTextContent('As')
    expect(screen.getByText('Ace high')).toBeInTheDocument()
    expect(screen.getByText('Monotone')).toBeInTheDocument()
    expect(screen.getByText('Wet')).toBeInTheDocument()
  })

  it('shows an inline error for an invalid flop', () => {
    render(<FlopTexture board="AsKd" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/exactly three/i)
  })

  it('shows an inline error for a malformed card', () => {
    render(<FlopTexture board="AsKdXx" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid card/i)
  })
})
