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

  it('becomes a named image when given a label', () => {
    // Where the chart is the content and not a thumbnail beside a name, keeping
    // it aria-hidden leaves a screen reader with no way to learn the range.
    render(<RangeThumbnail hands={['AA', 'KK']} label="Range chart: AA, KK" />)
    const svg = screen.getByRole('img', { name: 'Range chart: AA, KK' })
    expect(svg).toBe(screen.getByTestId('range-thumbnail'))
    expect(svg).not.toHaveAttribute('aria-hidden')
  })

  it('places pairs on the diagonal', () => {
    render(<RangeThumbnail hands={['AA']} />)
    const cell = screen.getByTestId('range-thumbnail').querySelector('rect')!
    expect(cell.getAttribute('x')).toBe(cell.getAttribute('y'))
  })
})
