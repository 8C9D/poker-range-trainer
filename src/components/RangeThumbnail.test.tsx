import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RangeThumbnail } from './RangeThumbnail'

describe('RangeThumbnail', () => {
  it('renders one cell per selected hand', () => {
    render(<RangeThumbnail hands={['AA', 'AKs', 'AKo']} />)
    const svg = screen.getByTestId('range-thumbnail')
    expect(svg.querySelectorAll('rect')).toHaveLength(3)
  })

  it('is decorative and skips unknown hands', () => {
    render(<RangeThumbnail hands={['AA', 'XX']} />)
    const svg = screen.getByTestId('range-thumbnail')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelectorAll('rect')).toHaveLength(1)
  })

  it('places pairs on the diagonal', () => {
    render(<RangeThumbnail hands={['AA']} />)
    const cell = screen.getByTestId('range-thumbnail').querySelector('rect')!
    expect(cell.getAttribute('x')).toBe(cell.getAttribute('y'))
  })
})
