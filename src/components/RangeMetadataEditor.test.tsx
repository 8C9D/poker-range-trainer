import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RangeMetadataEditor } from './RangeMetadataEditor'

type Props = ComponentProps<typeof RangeMetadataEditor>

// Render with sensible "unset" defaults; each test overrides what it needs and
// gets the spy handlers back for assertions.
function renderEditor(overrides: Partial<Props> = {}): Props {
  const props: Props = {
    position: '',
    actionType: '',
    notes: '',
    onPositionChange: vi.fn(),
    onActionTypeChange: vi.fn(),
    onNotesChange: vi.fn(),
    ...overrides,
  }
  render(<RangeMetadataEditor {...props} />)
  return props
}

function section() {
  return screen.getByRole('region', { name: 'Scenario details' })
}

describe('RangeMetadataEditor', () => {
  it('renders a Scenario details section with the three controls', () => {
    renderEditor()

    const scenario = within(section())
    expect(scenario.getByLabelText('Position')).toBeInTheDocument()
    expect(scenario.getByLabelText('Action type')).toBeInTheDocument()
    expect(scenario.getByLabelText('Notes')).toBeInTheDocument()
  })

  it('defaults both dropdowns to a blank option so metadata is optional', () => {
    renderEditor()

    // The blank option is selected and its labeled choices are still offered.
    expect(screen.getByLabelText('Position')).toHaveValue('')
    expect(screen.getByLabelText('Action type')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'BTN' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '3-bet' })).toBeInTheDocument()
  })

  it('reflects the provided metadata values', () => {
    renderEditor({ position: 'btn', actionType: 'open', notes: 'Standard open' })

    expect(screen.getByLabelText('Position')).toHaveValue('btn')
    expect(screen.getByLabelText('Action type')).toHaveValue('open')
    expect(screen.getByLabelText('Notes')).toHaveValue('Standard open')
  })

  it('reports a position change', async () => {
    const user = userEvent.setup()
    const { onPositionChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Position'), 'co')

    expect(onPositionChange).toHaveBeenCalledExactlyOnceWith('co')
  })

  it('reports an action type change', async () => {
    const user = userEvent.setup()
    const { onActionTypeChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Action type'), 'threeBet')

    expect(onActionTypeChange).toHaveBeenCalledExactlyOnceWith('threeBet')
  })

  it('reports notes input', async () => {
    const user = userEvent.setup()
    const { onNotesChange } = renderEditor()

    await user.type(screen.getByLabelText('Notes'), 'x')

    expect(onNotesChange).toHaveBeenCalledExactlyOnceWith('x')
  })
})
