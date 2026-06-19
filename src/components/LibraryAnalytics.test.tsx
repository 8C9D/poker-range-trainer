import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LibraryAnalytics } from './LibraryAnalytics'

describe('LibraryAnalytics', () => {
  it('renders nothing when there is no practice data', () => {
    const { container } = render(
      <LibraryAnalytics
        analytics={{ rangesPracticed: 0, totalAttempts: 0, totalCorrect: 0, overallAccuracy: 0 }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the aggregate figures once there is practice data', () => {
    render(
      <LibraryAnalytics
        analytics={{
          rangesPracticed: 3,
          totalAttempts: 40,
          totalCorrect: 30,
          overallAccuracy: 75,
        }}
      />,
    )
    const panel = within(screen.getByRole('region', { name: 'Practice analytics' }))
    expect(panel.getByText('Ranges practiced')).toBeInTheDocument()
    expect(panel.getByText('3')).toBeInTheDocument()
    expect(panel.getByText('40')).toBeInTheDocument()
    expect(panel.getByText('75%')).toBeInTheDocument()
  })
})
