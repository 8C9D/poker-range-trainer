import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RangeDiffView } from './RangeDiffView'

describe('RangeDiffView', () => {
  it('colors each cell by its diff bucket', () => {
    render(<RangeDiffView handsA={['AA', 'KK']} handsB={['KK', 'QQ']} />)
    expect(screen.getByText('KK')).toHaveAttribute('data-bucket', 'common')
    expect(screen.getByText('AA')).toHaveAttribute('data-bucket', 'onlyA')
    expect(screen.getByText('QQ')).toHaveAttribute('data-bucket', 'onlyB')
    expect(screen.getByText('JJ')).toHaveAttribute('data-bucket', 'none')
  })

  it('shows the summary counts with labels', () => {
    render(<RangeDiffView handsA={['AA', 'KK']} handsB={['KK', 'QQ']} labelA="Mine" labelB="Target" />)
    expect(screen.getByText('Both: 1')).toBeInTheDocument()
    expect(screen.getByText('Only Mine: 1')).toBeInTheDocument()
    expect(screen.getByText('Only Target: 1')).toBeInTheDocument()
  })
})
