import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GettingStarted } from './GettingStarted'

describe('GettingStarted', () => {
  it('renders a welcome heading and getting-started steps', () => {
    render(<GettingStarted />)
    const panel = within(screen.getByRole('region', { name: 'Getting started' }))
    expect(panel.getByRole('heading', { name: /Welcome to Poker Range Trainer/i })).toBeInTheDocument()
    expect(panel.getByText(/Save Range/)).toBeInTheDocument()
    expect(panel.getByText(/Practice/)).toBeInTheDocument()
    // One ordered list of steps.
    expect(panel.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  })
})
