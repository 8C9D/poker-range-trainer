import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { loadSavedRanges } from './storage/rangeStorage'

// Isolate persistence so each case starts from an empty library.
beforeEach(() => {
  localStorage.clear()
})

function library() {
  return screen.getByRole('region', { name: 'Saved ranges' })
}

describe('Range editor validation', () => {
  it('renders a range name input', () => {
    render(<App />)
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
  })

  it('disables saving when the name is blank', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))

    expect(screen.getByRole('button', { name: 'Save Range' })).toBeDisabled()
  })

  it('treats a whitespace-only name as blank', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.type(screen.getByLabelText('Range name'), '   ')

    expect(screen.getByRole('button', { name: 'Save Range' })).toBeDisabled()
  })

  it('disables saving when no hands are selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'My Range')

    expect(screen.getByRole('button', { name: 'Save Range' })).toBeDisabled()
  })

  it('enables saving once a name and at least one hand are provided', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'My Range')
    await user.click(screen.getByRole('button', { name: 'AA' }))

    expect(screen.getByRole('button', { name: 'Save Range' })).toBeEnabled()
  })
})

describe('Saving and listing ranges', () => {
  it('saves a range and shows it in the library with summary stats', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' })) // pair: 6 combos
    await user.click(screen.getByRole('button', { name: 'KK' })) // pair: 6 combos
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
    // 2 hands, 12 combos, 12/1326 -> 0.9%
    expect(within(library()).getByText(/2 hands.*12 combos.*0\.9%/)).toBeInTheDocument()
    expect(loadSavedRanges()).toHaveLength(1)
  })
})

describe('Loading and updating ranges', () => {
  it('loads a saved range back into the editor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Aces')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'New Range' }))

    // Editor is blank after starting a new range.
    expect(screen.getByLabelText('Range name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Load range Aces' }))

    expect(screen.getByLabelText('Range name')).toHaveValue('Aces')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('updates a loaded range in place instead of creating a duplicate', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Starter')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'New Range' }))

    // Load it back, add a hand, and save the changes.
    await user.click(screen.getByRole('button', { name: 'Load range Starter' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(within(library()).getAllByText('Starter')).toHaveLength(1)
    expect(within(library()).getByText(/2 hands/)).toBeInTheDocument()
  })
})

describe('Clearing and deleting ranges', () => {
  it('clears name and selection with the New Range button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Temp')
    await user.click(screen.getByRole('button', { name: 'AA' }))

    await user.click(screen.getByRole('button', { name: 'New Range' }))

    expect(screen.getByLabelText('Range name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('deletes a saved range from the library and storage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Throwaway')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(within(library()).getByText('Throwaway')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete range Throwaway' }))

    expect(within(library()).queryByText('Throwaway')).not.toBeInTheDocument()
    expect(loadSavedRanges()).toHaveLength(0)
  })

  it('resets the editor when the range being edited is deleted', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Editing Me')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // The just-saved range is the active one; deleting it should clear the editor.
    await user.click(screen.getByRole('button', { name: 'Delete range Editing Me' }))

    expect(screen.getByLabelText('Range name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Save Range' })).toBeInTheDocument()
  })
})

describe('Clear Selection', () => {
  it('is disabled until at least one hand is selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    const clear = screen.getByRole('button', { name: 'Clear Selection' })
    expect(clear).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'AA' }))

    expect(clear).toBeEnabled()
  })

  it('clears the selection but keeps the range name', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Keep My Name')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))

    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'KK' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    // The name is intentionally preserved.
    expect(screen.getByLabelText('Range name')).toHaveValue('Keep My Name')
  })

  it('stays in editing mode for an active saved range and still blocks an empty save', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Save a range so the editor is attached to it (editing mode).
    await user.type(screen.getByLabelText('Range name'), 'Editable')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))

    // Still editing the same range: indicator, name, and "Save Changes" remain.
    expect(screen.getByText(/Editing saved range:/)).toBeInTheDocument()
    expect(screen.getByLabelText('Range name')).toHaveValue('Editable')
    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(save).toBeInTheDocument()
    // Validation still prevents saving with no hands selected.
    expect(save).toBeDisabled()
    // The saved range itself is untouched until an allowed save happens.
    expect(loadSavedRanges()).toHaveLength(1)
    expect(loadSavedRanges()[0].hands).toEqual(['AA'])
  })
})

describe('Practice mode', () => {
  it('starts practice from the library and returns to the editor on End Practice', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Save a range so the library has something to practice.
    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    // The practice view replaces the editor and library.
    expect(screen.getByRole('heading', { name: /Practicing: Pairs/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Range name')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Saved ranges' })).not.toBeInTheDocument()

    // Ending practice returns to the editor/library view.
    await user.click(screen.getByRole('button', { name: 'End Practice' }))

    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Practicing: Pairs/ })).not.toBeInTheDocument()
  })
})
