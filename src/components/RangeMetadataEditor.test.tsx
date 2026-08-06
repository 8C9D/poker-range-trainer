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
    gameType: '',
    tableSize: '',
    stackDepth: '',
    position: '',
    versusPosition: '',
    actionType: '',
    notes: '',
    onGameTypeChange: vi.fn(),
    onTableSizeChange: vi.fn(),
    onStackDepthChange: vi.fn(),
    onPositionChange: vi.fn(),
    onVersusPositionChange: vi.fn(),
    onActionTypeChange: vi.fn(),
    onNotesChange: vi.fn(),
    onUseScenarioFromName: vi.fn(),
    ...overrides,
  }
  render(<RangeMetadataEditor {...props} />)
  return props
}

function section() {
  return screen.getByRole('region', { name: 'Scenario details' })
}

describe('RangeMetadataEditor', () => {
  it('renders a Scenario details section with all metadata controls', () => {
    renderEditor()

    const scenario = within(section())
    expect(scenario.getByLabelText('Game type')).toBeInTheDocument()
    expect(scenario.getByLabelText('Table size')).toBeInTheDocument()
    expect(scenario.getByLabelText('Stack depth')).toBeInTheDocument()
    expect(scenario.getByLabelText('Position')).toBeInTheDocument()
    expect(scenario.getByLabelText('Versus position')).toBeInTheDocument()
    expect(scenario.getByLabelText('Action type')).toBeInTheDocument()
    expect(scenario.getByLabelText('Notes')).toBeInTheDocument()
  })

  it('defaults every dropdown to a blank option so metadata is optional', () => {
    renderEditor()

    // The blank option is selected and its labeled choices are still offered.
    expect(screen.getByLabelText('Game type')).toHaveValue('')
    expect(screen.getByLabelText('Table size')).toHaveValue('')
    expect(screen.getByLabelText('Stack depth')).toHaveValue(null)
    expect(screen.getByLabelText('Position')).toHaveValue('')
    expect(screen.getByLabelText('Versus position')).toHaveValue('')
    expect(screen.getByLabelText('Action type')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Cash' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '6-max' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '3-bet' })).toBeInTheDocument()
    // BTN appears in both the Position and Versus position dropdowns.
    expect(screen.getAllByRole('option', { name: 'BTN' })).toHaveLength(2)
  })

  it('reflects the provided metadata values', () => {
    renderEditor({
      gameType: 'cash',
      tableSize: 'sixMax',
      stackDepth: '100',
      position: 'btn',
      versusPosition: 'co',
      actionType: 'open',
      notes: 'Standard open',
    })

    expect(screen.getByLabelText('Game type')).toHaveValue('cash')
    expect(screen.getByLabelText('Table size')).toHaveValue('sixMax')
    expect(screen.getByLabelText('Stack depth')).toHaveValue(100)
    expect(screen.getByLabelText('Position')).toHaveValue('btn')
    expect(screen.getByLabelText('Versus position')).toHaveValue('co')
    expect(screen.getByLabelText('Action type')).toHaveValue('open')
    expect(screen.getByLabelText('Notes')).toHaveValue('Standard open')
  })

  it('reports a game type change', async () => {
    const user = userEvent.setup()
    const { onGameTypeChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Game type'), 'tournament')

    expect(onGameTypeChange).toHaveBeenCalledExactlyOnceWith('tournament')
  })

  it('reports a table size change', async () => {
    const user = userEvent.setup()
    const { onTableSizeChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Table size'), 'nineMax')

    expect(onTableSizeChange).toHaveBeenCalledExactlyOnceWith('nineMax')
  })

  it('reports a stack depth change', async () => {
    const user = userEvent.setup()
    const { onStackDepthChange } = renderEditor()

    await user.type(screen.getByLabelText('Stack depth'), '4')

    expect(onStackDepthChange).toHaveBeenCalledExactlyOnceWith('4')
  })

  it('reports a position change', async () => {
    const user = userEvent.setup()
    const { onPositionChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Position'), 'co')

    expect(onPositionChange).toHaveBeenCalledExactlyOnceWith('co')
  })

  it('reports a versus position change', async () => {
    const user = userEvent.setup()
    const { onVersusPositionChange } = renderEditor()

    await user.selectOptions(screen.getByLabelText('Versus position'), 'bb')

    expect(onVersusPositionChange).toHaveBeenCalledExactlyOnceWith('bb')
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

  it('shows a stack depth validation message when one is provided', () => {
    renderEditor({ stackDepth: '0', stackDepthError: 'Stack depth must be a positive number.' })

    const input = screen.getByLabelText('Stack depth')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Stack depth must be a positive number.')
  })

  it('shows no stack depth validation message when valid', () => {
    renderEditor({ stackDepth: '100' })

    expect(screen.getByLabelText('Stack depth')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers the scenario read out of the range name', async () => {
    const user = userEvent.setup()
    const props = renderEditor({ scenarioFromName: 'SB · 3-bet · vs BTN' })

    expect(within(section()).getByText('SB · 3-bet · vs BTN')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Use this' }))
    expect(props.onUseScenarioFromName).toHaveBeenCalledTimes(1)
  })

  it('offers nothing when the name adds nothing', () => {
    renderEditor({ scenarioFromName: null })

    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull()
  })
})
