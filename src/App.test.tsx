import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { loadActionAccuracy } from './storage/actionAccuracyStorage'
import { loadHandAccuracy } from './storage/handAccuracyStorage'
import { loadPracticeStats } from './storage/practiceStatsStorage'
import { loadReviewStates } from './storage/reviewStateStorage'
import { loadSessionHistory } from './storage/sessionHistoryStorage'
import { loadSavedRanges } from './storage/rangeStorage'

// Isolate persistence so each case starts from an empty library.
beforeEach(() => {
  localStorage.clear()
})

// A few timed-drill cases install fake timers; always restore real timers after
// each test so other cases (which use userEvent) are unaffected.
afterEach(() => {
  vi.useRealTimers()
})

function library() {
  return screen.getByRole('region', { name: 'Saved ranges' })
}

function notationInput() {
  return screen.getByLabelText('Paste or type notation')
}

function currentNotation() {
  return screen.getByLabelText('Current range')
}

function applyNotation() {
  return screen.getByRole('button', { name: 'Apply Notation' })
}

function gameTypeSelect() {
  return screen.getByLabelText('Game type')
}

function tableSizeSelect() {
  return screen.getByLabelText('Table size')
}

function stackDepthInput() {
  return screen.getByLabelText('Stack depth')
}

function positionSelect() {
  return screen.getByLabelText('Position')
}

function versusPositionSelect() {
  return screen.getByLabelText('Versus position')
}

function actionSelect() {
  return screen.getByLabelText('Action type')
}

function notesInput() {
  return screen.getByLabelText('Notes')
}

function sourceSelect() {
  return screen.getByLabelText('Source')
}

function referenceInput() {
  return screen.getByLabelText('Reference')
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
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))

    // The practice view replaces the editor and library.
    expect(screen.getByRole('heading', { name: /Practicing: Pairs/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Range name')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Saved ranges' })).not.toBeInTheDocument()

    // Ending practice opens the review; dismissing it returns to the editor/library.
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Practicing: Pairs/ })).not.toBeInTheDocument()
  })

  it('records a finished practice session into per-range stats', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))

    // App uses Math.random for the prompt, so read the shown hand and answer it
    // truthfully to keep the recorded correct count deterministic.
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    await user.click(
      screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }),
    )
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    const rangeId = loadSavedRanges()[0].id
    expect(loadPracticeStats()[rangeId]).toEqual(
      expect.objectContaining({ totalAttempts: 1, correctAttempts: 1 }),
    )
    // The same session also records per-hand accuracy for the answered hand.
    expect(loadHandAccuracy()[rangeId][promptHand]).toEqual({
      hand: promptHand,
      attempts: 1,
      correct: 1,
      falsePositives: 0,
      falseNegatives: 0,
    })
    // ...and appends a session-history record.
    expect(loadSessionHistory()[rangeId]).toEqual([
      expect.objectContaining({ rangeId, totalQuestions: 1, correctAnswers: 1 }),
    ])
    // ...and advances the spaced-repetition schedule (a strong first review → 1-day interval).
    expect(loadReviewStates()[rangeId]).toEqual(
      expect.objectContaining({ rangeId, intervalDays: 1 }),
    )
    expect(loadReviewStates()[rangeId].lastReviewedAt).not.toBe('')
  })

  it('shows the recorded practice stats on the library card after ending a session', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))

    // Answer the shown hand truthfully so the single attempt is correct, making
    // the displayed accuracy a deterministic 100%.
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    await user.click(screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }))
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    // The library card now carries the cumulative practice line for this range.
    expect(within(library()).getByText(/Practiced 1.*100% accuracy/)).toBeInTheDocument()
  })

  it('records nothing when practice ends without any answers', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))
    // End immediately, before answering a single hand, then dismiss the review.
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(loadPracticeStats()).toEqual({})
  })

  it('shows a practice-mode picker before any mode is chosen', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    // The picker names the range and offers every mode, without starting any.
    expect(screen.getByRole('heading', { name: 'Practice: Pairs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recognize hands (in/out)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Build from memory' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Timed drill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weakness drill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'In range' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Build from memory:/ })).not.toBeInTheDocument()
  })

  it('starts the timed drill when chosen from the picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Timed drill' }))

    // The timed-drill setup (config) shows the range name and duration choices.
    // No drill is running yet, so no countdown interval starts.
    expect(screen.getByRole('heading', { name: 'Timed drill: Pairs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30s' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '60s' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '120s' })).toBeInTheDocument()
  })

  it('records a finished timed drill into per-range stats', async () => {
    // Fake timers + fireEvent: userEvent deadlocks against fake timers.
    vi.useFakeTimers()
    const { container } = render(<App />)

    fireEvent.change(screen.getByLabelText('Range name'), { target: { value: 'Pairs' } })
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'KK' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Range' }))

    fireEvent.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Timed drill' }))
    fireEvent.click(screen.getByRole('button', { name: '60s' }))

    // The prompt hand is drawn with Math.random; answer it truthfully so the one
    // recorded attempt is deterministically correct.
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    fireEvent.click(screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }))

    // Run out the clock, then leave the results to record the session.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }))

    const rangeId = loadSavedRanges()[0].id
    expect(loadPracticeStats()[rangeId]).toEqual(
      expect.objectContaining({ totalAttempts: 1, correctAttempts: 1 }),
    )
  })

  it('starts build-from-memory mode when chosen from the picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Build from memory' }))

    expect(screen.getByRole('heading', { name: 'Build from memory: Pairs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check my range' })).toBeInTheDocument()
    // Editor and library are hidden during practice.
    expect(screen.queryByLabelText('Range name')).not.toBeInTheDocument()
  })

  it('returns to the editor/library when the picker is cancelled', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Recognize hands (in/out)' }),
    ).not.toBeInTheDocument()
  })

  it('returns to the picker on the next launch after a build-from-memory session', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Enter build-from-memory, then leave it.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Build from memory' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    // Launching again shows the picker again, not the previously chosen mode.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    expect(screen.getByRole('button', { name: 'Recognize hands (in/out)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Build from memory' })).toBeInTheDocument()
  })

  it('starts the weakness drill when chosen from the picker', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Weakness drill' }))

    expect(screen.getByRole('heading', { name: 'Weakness drill: Pairs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of range' })).toBeInTheDocument()
  })

  it('records a finished weakness drill into per-range stats', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Weakness drill' }))

    // Answer the shown hand truthfully so the single attempt is deterministically correct.
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    await user.click(screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }))
    await user.click(screen.getByRole('button', { name: 'End practice' }))

    const rangeId = loadSavedRanges()[0].id
    expect(loadPracticeStats()[rangeId]).toEqual(
      expect.objectContaining({ totalAttempts: 1, correctAttempts: 1 }),
    )
  })

  it('does not offer the action quiz for a range without an action chart', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    // The picker is showing, but a hands-only range can't be action-quizzed.
    expect(
      screen.getByRole('button', { name: 'Recognize hands (in/out)' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pick the correct action' }),
    ).not.toBeInTheDocument()
  })

  it('offers and starts the action quiz for a range with an action chart', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Assign an action to AA (default action is Raise) and save it onto the range.
    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save actions' }))

    // The picker now offers the action quiz; choosing it starts the quiz.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Pick the correct action' }))

    expect(screen.getByRole('heading', { name: 'Action quiz: Pairs' })).toBeInTheDocument()
    expect(screen.getByText('What is the correct action?')).toBeInTheDocument()
  })

  it('records per-action accuracy after an action quiz', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Assign Raise (the default action) to AA and save it onto the range.
    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save actions' }))

    // Run the quiz: AA is the only assigned hand, so it is the prompt. Answer it
    // correctly, then end the quiz to record per-action accuracy.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Pick the correct action' }))
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'End quiz' }))

    const rangeId = loadSavedRanges()[0].id
    expect(loadActionAccuracy()[rangeId]).toEqual({
      raise: { action: 'raise', attempts: 1, correct: 1 },
    })
  })

  it('shows per-action accuracy in the performance view after an action quiz', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Assign Raise to AA and save it onto the range.
    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save actions' }))

    // Run the quiz and answer the only assigned hand (AA) correctly.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Pick the correct action' }))
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    await user.click(screen.getByRole('button', { name: 'End quiz' }))

    // The performance view's per-action table reflects the quiz.
    await user.click(screen.getByRole('button', { name: 'View stats for Pairs' }))
    const table = screen.getByRole('table', { name: 'Per-action accuracy' })
    expect(within(table).getByText('Raise')).toBeInTheDocument()
    expect(within(table).getByText('100%')).toBeInTheDocument()
  })
})

describe('Range performance view', () => {
  it('opens the performance view from a library card and returns on close', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'View stats for Pairs' }))

    // With no practice yet, the view shows the empty state and hides editor/library.
    expect(screen.getByRole('heading', { name: 'Performance: Pairs' })).toBeInTheDocument()
    expect(screen.getByText(/No practice data yet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Range name')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
  })

  it('opens the range-vs-board view and breaks down a flop', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Analyze Pairs vs a board' }))
    expect(screen.getByRole('heading', { name: 'Board: Pairs' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    // AA = 6 overpair combos on a K-high board.
    expect(screen.getByText('Overpair').closest('tr')).toHaveTextContent('6')

    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
  })

  it('opens the blocker-aware combo drill and deals a combo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Aces')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Deal combos for Aces' }))
    expect(screen.getByRole('heading', { name: 'Combo drill: Aces' })).toBeInTheDocument()
    // AA has 6 combos, none blocked with an empty board.
    expect(screen.getByText('6 combos available')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deal a combo' }))
    expect(screen.getByLabelText('Dealt combo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
  })

  it('edits and persists per-combo selections for a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Suited')
    await user.click(screen.getByRole('button', { name: 'AKs' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit combos for Suited' }))
    expect(screen.getByRole('heading', { name: 'Combos: Suited' })).toBeInTheDocument()
    // AKs has 4 combos, all selected by default.
    expect(screen.getByText('4/4 combos')).toBeInTheDocument()

    // Deselect one combo and save.
    const grid = screen.getByLabelText('Combos for AKs')
    await user.click(within(grid).getAllByRole('button')[0])
    expect(screen.getByText('3/4 combos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save combos' }))

    // Reopen: the deselection persisted.
    await user.click(screen.getByRole('button', { name: 'Edit combos for Suited' }))
    expect(screen.getByText('3/4 combos')).toBeInTheDocument()
  })

  it('edits and persists per-hand mixed frequencies for a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Mix')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit frequencies for Mix' }))
    expect(screen.getByRole('heading', { name: 'Frequencies: Mix' })).toBeInTheDocument()

    // AA is the only/active hand; set a 50/50 raise/fold mix.
    fireEvent.change(screen.getByLabelText('Raise'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Fold'), { target: { value: '50' } })
    await user.click(screen.getByRole('button', { name: 'Save frequencies' }))

    // Reopen: the grid shows AA's primary action.
    await user.click(screen.getByRole('button', { name: 'Edit frequencies for Mix' }))
    expect(screen.getByText('AA', { selector: '.action-cell' })).toHaveAttribute(
      'data-primary',
      'fold',
    )
  })

  it('shows the frequency quiz in the picker only for ranges with mixed charts', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Range WITHOUT mixed frequencies: no "Frequency quiz" picker option.
    await user.type(screen.getByLabelText('Range name'), 'Plain')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'Practice range Plain' }))
    expect(screen.queryByRole('button', { name: 'Frequency quiz' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    // Add a mixed chart, then the picker offers the quiz and it runs.
    await user.click(screen.getByRole('button', { name: 'Edit frequencies for Plain' }))
    fireEvent.change(screen.getByLabelText('Raise'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Fold'), { target: { value: '40' } })
    await user.click(screen.getByRole('button', { name: 'Save frequencies' }))

    await user.click(screen.getByRole('button', { name: 'Practice range Plain' }))
    await user.click(screen.getByRole('button', { name: 'Frequency quiz' }))
    expect(screen.getByText('What is the primary action?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
  })

  it('compares a saved range against another from the library', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Save two ranges sharing KK.
    await user.type(screen.getByLabelText('Range name'), 'First')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'New Range' }))
    await user.type(screen.getByLabelText('Range name'), 'Second')
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'QQ' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Compare First with another range' }))
    expect(screen.getByRole('heading', { name: 'Compare: First' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Compare with'), 'Second')
    // KK is in both ranges.
    expect(screen.getByText('KK', { selector: '.action-cell' })).toHaveAttribute(
      'data-bucket',
      'common',
    )

    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
  })

  it('runs a postflop drill from setup to a graded answer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Postflop drill' }))
    await user.type(screen.getByLabelText('Your hand'), 'AsKh')
    await user.type(screen.getByLabelText('Flop'), 'Kd7c2h')
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    // Top pair facing a bet → heuristic suggests Raise.
    await user.click(screen.getByRole('button', { name: 'Raise' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Matches the heuristic/)

    await user.click(screen.getByRole('button', { name: 'Back to library' }))
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
  })

  it('shows a per-hand row after practicing the range', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Practice one hand (recognition), answering truthfully.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    await user.click(screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }))
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    // The performance view now has a per-hand row for the practiced hand.
    await user.click(screen.getByRole('button', { name: 'View stats for Pairs' }))
    const table = screen.getByRole('table', { name: 'Per-hand accuracy' })
    expect(within(table).getByText(promptHand)).toBeInTheDocument()
    expect(within(table).getByText('100%')).toBeInTheDocument()
    // ...and the session-history timeline shows the finished session.
    const historyTable = screen.getByRole('table', { name: 'Session history' })
    expect(within(historyTable).getByText('1/1')).toBeInTheDocument()
  })

  it('drills only the missed hands via "Practice mistakes"', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Recognition: answer the shown hand WRONG so it becomes the single mistake.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))
    const missedHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = missedHand === 'AA' || missedHand === 'KK'
    await user.click(screen.getByRole('button', { name: inRange ? 'Out of range' : 'In range' }))
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    // Drill the mistakes: the only mistake is `missedHand`, so (pool of one) it
    // must be the prompt.
    await user.click(screen.getByRole('button', { name: 'View stats for Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Practice mistakes' }))

    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(container.querySelector('.practice-prompt-hand')?.textContent).toBe(missedHand)
  })
})

describe('Per-hand notes editor', () => {
  it('edits, persists, and reopens a per-hand note for a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Noted')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit notes for Noted' }))
    expect(screen.getByRole('heading', { name: 'Notes: Noted' })).toBeInTheDocument()

    // AA is the only/active hand; attach a note and save.
    await user.type(screen.getByRole('textbox'), 'open always')
    await user.click(screen.getByRole('button', { name: 'Save notes' }))

    expect(loadSavedRanges()[0].handNotes).toEqual({ AA: 'open always' })

    // Reopen: the note round-trips into the editor.
    await user.click(screen.getByRole('button', { name: 'Edit notes for Noted' }))
    expect(screen.getByRole('textbox')).toHaveValue('open always')
  })

  it('clearing a note removes it on save', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Noted')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit notes for Noted' }))
    await user.type(screen.getByRole('textbox'), 'temp')
    await user.click(screen.getByRole('button', { name: 'Save notes' }))
    expect(loadSavedRanges()[0].handNotes).toEqual({ AA: 'temp' })

    // Reopen, clear the note, and save: handNotes collapses away entirely.
    await user.click(screen.getByRole('button', { name: 'Edit notes for Noted' }))
    await user.clear(screen.getByRole('textbox'))
    await user.click(screen.getByRole('button', { name: 'Save notes' }))
    expect(loadSavedRanges()[0].handNotes).toBeUndefined()
  })
})

describe('Due-today review queue', () => {
  it('opens the queue listing a never-practiced range as due', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Review due ranges' }))

    expect(screen.getByRole('heading', { name: /Due for review/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice range Pairs' })).toBeInTheDocument()
    // The queue replaces the editor/library.
    expect(screen.queryByLabelText('Range name')).not.toBeInTheDocument()
  })

  it('returns to the library from the queue', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Review due ranges' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    expect(screen.getByLabelText('Range name')).toBeInTheDocument()
    expect(within(library()).getByText('Pairs')).toBeInTheDocument()
  })

  it('starts practice for a due range from the queue', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Review due ranges' }))
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))

    // Practice started (mode picker), the queue is gone.
    expect(screen.getByRole('button', { name: 'Recognize hands (in/out)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Due for review/ })).not.toBeInTheDocument()
  })

  it('shows a 1-day review streak after practicing today', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Record a session today via recognition practice.
    await user.click(screen.getByRole('button', { name: 'Practice range Pairs' }))
    await user.click(screen.getByRole('button', { name: 'Recognize hands (in/out)' }))
    const promptHand = container.querySelector('.practice-prompt-hand')?.textContent ?? ''
    const inRange = promptHand === 'AA' || promptHand === 'KK'
    await user.click(screen.getByRole('button', { name: inRange ? 'In range' : 'Out of range' }))
    await user.click(screen.getByRole('button', { name: 'End Practice' }))
    await user.click(screen.getByRole('button', { name: 'Back to library' }))

    await user.click(screen.getByRole('button', { name: 'Review due ranges' }))
    expect(screen.getByText('Review streak: 1 day')).toBeInTheDocument()
  })
})

describe('Multi-action editor', () => {
  it('edits and persists per-hand actions for a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))
    expect(screen.getByRole('heading', { name: 'Actions: Pairs' })).toBeInTheDocument()

    // Default active action is Raise; paint it onto AA on the action grid.
    await user.click(screen.getByRole('button', { name: 'AA' }))
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')

    await user.click(screen.getByRole('button', { name: 'Save actions' }))
    // Back to the editor/library.
    expect(screen.getByLabelText('Range name')).toBeInTheDocument()

    // Reopening shows the persisted assignment.
    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')
  })

  it('imports action notation in the action editor and persists it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Pairs')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Edit actions for Pairs' }))

    // Import an action chart via notation, then apply it.
    await user.type(
      screen.getByLabelText('Paste or type action notation'),
      'Raise: AA, KK',
    )
    await user.click(screen.getByRole('button', { name: 'Apply Action Notation' }))

    // The action grid reflects the imported assignment.
    expect(screen.getByText('AA').getAttribute('data-action')).toBe('raise')
    expect(screen.getByText('KK').getAttribute('data-action')).toBe('raise')

    // Saving persists the imported chart.
    await user.click(screen.getByRole('button', { name: 'Save actions' }))
    expect(loadSavedRanges()[0].handActions).toEqual({ AA: 'raise', KK: 'raise' })
  })
})

describe('Range shortcuts', () => {
  it('renders the range shortcut section', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Range shortcuts' })).toBeInTheDocument()
  })

  it('adds all 13 pairs and updates the summary', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))

    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '22' })).toHaveAttribute('aria-pressed', 'true')
    // 13 pairs -> 78 combos -> 78/1326 = 5.9%.
    expect(screen.getByText('13 hands selected')).toBeInTheDocument()
    expect(screen.getByText('78 combos')).toBeInTheDocument()
    expect(screen.getByText('5.9% of all hands')).toBeInTheDocument()
  })

  it('adds only the pairs 77 and higher for Add 77+', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add 77+' }))

    expect(screen.getByText('8 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '77' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    // 66 sits just below the threshold and must stay unselected.
    expect(screen.getByRole('button', { name: '66' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds the suited Broadway hands', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add suited broadways' }))

    expect(screen.getByText('10 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'JTs' })).toHaveAttribute('aria-pressed', 'true')
    // No offsuit Broadway was added.
    expect(screen.getByRole('button', { name: 'AKo' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds the offsuit Broadway hands', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add offsuit broadways' }))

    expect(screen.getByText('10 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AKo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'JTo' })).toHaveAttribute('aria-pressed', 'true')
    // No suited Broadway was added.
    expect(screen.getByRole('button', { name: 'AKs' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds TT+ pairs plus suited and offsuit Broadway non-pairs for Add all broadways', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all broadways' }))

    // 5 Broadway pairs + 10 suited + 10 offsuit = 25 hands.
    expect(screen.getByText('25 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'TT' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AKs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AKo' })).toHaveAttribute('aria-pressed', 'true')
    // 99 is below the lowest Broadway pair and must stay unselected.
    expect(screen.getByRole('button', { name: '99' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('preserves hands already selected before applying a shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)

    // AA is not part of the suited Broadways group, so it must survive the merge.
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Add suited broadways' }))

    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AKs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('11 hands selected')).toBeInTheDocument()
  })

  it('does not double-count hands or combos when a shortcut is applied twice', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))
    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))

    expect(screen.getByText('13 hands selected')).toBeInTheDocument()
    expect(screen.getByText('78 combos')).toBeInTheDocument()
  })

  it('stays in editing mode when a shortcut is applied to a saved range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Editable')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.click(screen.getByRole('button', { name: 'Add suited broadways' }))

    expect(screen.getByText(/Editing saved range:/)).toBeInTheDocument()
    expect(screen.getByLabelText('Range name')).toHaveValue('Editable')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('updates a saved range in place after applying a shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Starter')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Apply a shortcut, then save the changes onto the same range.
    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(within(library()).getAllByText('Starter')).toHaveLength(1)
    expect(loadSavedRanges()[0].hands).toHaveLength(13)
  })

  it('lets Clear Selection clear shortcut-selected hands', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))
    expect(screen.getByText('13 hands selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))

    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Range notation', () => {
  it('renders the range notation section', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Range notation' })).toBeInTheDocument()
  })

  it('shows an empty current notation when no hands are selected', () => {
    render(<App />)
    expect(currentNotation()).toHaveValue('')
  })

  it('updates the displayed notation as hands are clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    expect(currentNotation()).toHaveValue('AA')

    await user.click(screen.getByRole('button', { name: 'KK' }))
    expect(currentNotation()).toHaveValue('AA, KK')
  })

  it('applies an exact-hand list onto the grid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(notationInput(), 'AA, KK')
    await user.click(applyNotation())

    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'KK' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 hands selected')).toBeInTheDocument()
    expect(currentNotation()).toHaveValue('AA, KK')
  })

  it('applies plus notation by expanding it onto the grid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(notationInput(), '77+')
    await user.click(applyNotation())

    // 77 through AA is 8 pairs; 66 sits just below the threshold.
    expect(screen.getByText('8 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '77' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '66' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies a comma-separated mixed list onto the grid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(notationInput(), '77+, AJs+, KQo')
    await user.click(applyNotation())

    // 8 pairs + AJs/AQs/AKs + KQo = 12 hands.
    expect(screen.getByText('12 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '77' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AJs' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'KQo' })).toHaveAttribute('aria-pressed', 'true')
    // ATs is below AJs+ and KJo is not part of the list.
    expect(screen.getByRole('button', { name: 'ATs' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'KJo' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears the selection when empty notation is applied', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'KK' }))
    expect(screen.getByText('2 hands selected')).toBeInTheDocument()

    // Apply with a blank input.
    await user.click(applyNotation())

    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'false')
    expect(currentNotation()).toHaveValue('')
  })

  it('shows an error for invalid notation', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Bare rank-pair notation ("AK") has no suit suffix and is unsupported.
    await user.type(notationInput(), 'AK')
    await user.click(applyNotation())

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('does not change the current selection when invalid notation is applied', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.type(notationInput(), 'AK')
    await user.click(applyNotation())

    // The selection and its notation are untouched, and an error is shown.
    expect(screen.getByRole('button', { name: 'AA' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 hands selected')).toBeInTheDocument()
    expect(currentNotation()).toHaveValue('AA')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears a previous error after a successful apply', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(notationInput(), 'AK')
    await user.click(applyNotation())
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.clear(notationInput())
    await user.type(notationInput(), '22+')
    await user.click(applyNotation())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('13 hands selected')).toBeInTheDocument()
  })

  it('stays in editing mode when notation is applied to a saved range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Editable')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    await user.type(notationInput(), '77+')
    await user.click(applyNotation())

    expect(screen.getByText(/Editing saved range:/)).toBeInTheDocument()
    expect(screen.getByLabelText('Range name')).toHaveValue('Editable')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('updates a saved range in place after applying notation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Starter')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Replace the selection via notation, then save onto the same range.
    await user.type(notationInput(), '22+')
    await user.click(applyNotation())
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(within(library()).getAllByText('Starter')).toHaveLength(1)
    expect(loadSavedRanges()[0].hands).toHaveLength(13)
  })

  it('keeps the notation display in sync with range shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))

    expect(currentNotation()).toHaveValue('AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22')
  })

  it('clears the notation display when Clear Selection is used', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))
    expect(currentNotation()).not.toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))

    expect(currentNotation()).toHaveValue('')
  })
})

describe('Scenario metadata', () => {
  it('renders the scenario details section', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Scenario details' })).toBeInTheDocument()
  })

  it('persists position, action type, and notes when saving a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'BTN Open')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(positionSelect(), 'btn')
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'Standard button open')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const [saved] = loadSavedRanges()
    expect(saved.metadata).toEqual({
      position: 'btn',
      actionType: 'open',
      notes: 'Standard button open',
    })
  })

  it('saves a range with no metadata as before', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'No Meta')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const [saved] = loadSavedRanges()
    expect(saved.metadata).toBeUndefined()
    expect(within(library()).getByText('No Meta')).toBeInTheDocument()
  })

  it('shows saved scenario metadata on the library card', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'BTN Open')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(positionSelect(), 'btn')
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'Standard button open')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const card = within(library())
    expect(card.getByText('BTN · Open')).toBeInTheDocument()
    expect(card.getByText('Standard button open')).toBeInTheDocument()
  })

  it('does not render empty metadata labels for a range saved without metadata', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'No Meta')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(container.querySelector('.range-item-scenario')).toBeNull()
    expect(container.querySelector('.range-item-notes')).toBeNull()
  })

  it('restores metadata fields when a saved range is loaded', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Scenario')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(positionSelect(), 'btn')
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'Standard button open')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'New Range' }))

    // New Range cleared the metadata controls back to their blank defaults.
    expect(positionSelect()).toHaveValue('')
    expect(actionSelect()).toHaveValue('')
    expect(notesInput()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Load range Scenario' }))

    expect(positionSelect()).toHaveValue('btn')
    expect(actionSelect()).toHaveValue('open')
    expect(notesInput()).toHaveValue('Standard button open')
  })

  it('updates metadata on an existing range in place without duplicating', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Editable')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(positionSelect(), 'btn')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Still editing the same range: extend its metadata and save again.
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'note')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(within(library()).getAllByText('Editable')).toHaveLength(1)
    expect(loadSavedRanges()[0].metadata).toEqual({
      position: 'btn',
      actionType: 'open',
      notes: 'note',
    })
  })

  it('clears metadata fields with New Range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(positionSelect(), 'co')
    await user.selectOptions(actionSelect(), 'threeBet')
    await user.type(notesInput(), 'temp')

    await user.click(screen.getByRole('button', { name: 'New Range' }))

    expect(positionSelect()).toHaveValue('')
    expect(actionSelect()).toHaveValue('')
    expect(notesInput()).toHaveValue('')
  })

  it('keeps metadata when Clear Selection is used', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.type(stackDepthInput(), '100')
    await user.selectOptions(positionSelect(), 'sb')
    await user.type(notesInput(), 'keep me')

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))

    expect(screen.getByText('0 hands selected')).toBeInTheDocument()
    expect(gameTypeSelect()).toHaveValue('cash')
    expect(stackDepthInput()).toHaveValue(100)
    expect(positionSelect()).toHaveValue('sb')
    expect(notesInput()).toHaveValue('keep me')
  })

  it('keeps metadata when notation is applied', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.selectOptions(positionSelect(), 'utg')
    await user.type(stackDepthInput(), '50')
    await user.type(notesInput(), 'note')

    await user.type(notationInput(), '22+')
    await user.click(applyNotation())

    expect(screen.getByText('13 hands selected')).toBeInTheDocument()
    expect(gameTypeSelect()).toHaveValue('cash')
    expect(positionSelect()).toHaveValue('utg')
    expect(stackDepthInput()).toHaveValue(50)
    expect(notesInput()).toHaveValue('note')
  })

  it('keeps metadata when a range shortcut is applied', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(tableSizeSelect(), 'sixMax')
    await user.selectOptions(versusPositionSelect(), 'bb')
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'note')

    await user.click(screen.getByRole('button', { name: 'Add all pairs' }))

    expect(screen.getByText('13 hands selected')).toBeInTheDocument()
    expect(tableSizeSelect()).toHaveValue('sixMax')
    expect(versusPositionSelect()).toHaveValue('bb')
    expect(actionSelect()).toHaveValue('open')
    expect(notesInput()).toHaveValue('note')
  })

  it('persists game type, table size, stack depth, and versus position when saving', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Full Meta')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.selectOptions(tableSizeSelect(), 'sixMax')
    await user.type(stackDepthInput(), '100')
    await user.selectOptions(positionSelect(), 'btn')
    await user.selectOptions(versusPositionSelect(), 'co')
    await user.selectOptions(actionSelect(), 'open')
    await user.type(notesInput(), 'Standard button open')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const [saved] = loadSavedRanges()
    expect(saved.metadata).toEqual({
      gameType: 'cash',
      tableSize: 'sixMax',
      stackDepthBb: 100,
      position: 'btn',
      versusPosition: 'co',
      actionType: 'open',
      notes: 'Standard button open',
    })
  })

  it('shows the full scenario metadata on the library card', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Full Meta')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.selectOptions(tableSizeSelect(), 'sixMax')
    await user.type(stackDepthInput(), '100')
    await user.selectOptions(positionSelect(), 'btn')
    await user.selectOptions(versusPositionSelect(), 'co')
    await user.selectOptions(actionSelect(), 'open')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(
      within(library()).getByText('Cash · 6-max · 100bb · BTN vs CO · Open'),
    ).toBeInTheDocument()
  })

  it('restores game type, table size, stack depth, and versus position on load', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Scenario')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(gameTypeSelect(), 'tournament')
    await user.selectOptions(tableSizeSelect(), 'nineMax')
    await user.type(stackDepthInput(), '40')
    await user.selectOptions(versusPositionSelect(), 'co')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'New Range' }))

    // New Range cleared the new controls back to their blank defaults.
    expect(gameTypeSelect()).toHaveValue('')
    expect(tableSizeSelect()).toHaveValue('')
    expect(stackDepthInput()).toHaveValue(null)
    expect(versusPositionSelect()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Load range Scenario' }))

    expect(gameTypeSelect()).toHaveValue('tournament')
    expect(tableSizeSelect()).toHaveValue('nineMax')
    expect(stackDepthInput()).toHaveValue(40)
    expect(versusPositionSelect()).toHaveValue('co')
  })

  it('updates the new metadata fields on an existing range in place', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Editable')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    // Still editing the same range: extend its metadata and save again.
    await user.selectOptions(tableSizeSelect(), 'sixMax')
    await user.type(stackDepthInput(), '100')
    await user.selectOptions(versusPositionSelect(), 'bb')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(within(library()).getAllByText('Editable')).toHaveLength(1)
    expect(loadSavedRanges()[0].metadata).toEqual({
      gameType: 'cash',
      tableSize: 'sixMax',
      stackDepthBb: 100,
      versusPosition: 'bb',
    })
  })

  it('clears the new metadata fields with New Range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(gameTypeSelect(), 'cash')
    await user.selectOptions(tableSizeSelect(), 'sixMax')
    await user.type(stackDepthInput(), '100')
    await user.selectOptions(versusPositionSelect(), 'co')

    await user.click(screen.getByRole('button', { name: 'New Range' }))

    expect(gameTypeSelect()).toHaveValue('')
    expect(tableSizeSelect()).toHaveValue('')
    expect(stackDepthInput()).toHaveValue(null)
    expect(versusPositionSelect()).toHaveValue('')
  })

  it('blocks saving and explains an invalid stack depth', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Bad Stack')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    // Zero is not a positive number, so it is invalid.
    await user.type(stackDepthInput(), '0')

    expect(screen.getByText('Stack depth must be a positive number.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Range' })).toBeDisabled()

    // Correcting it to a positive value clears the error and re-enables saving.
    await user.clear(stackDepthInput())
    await user.type(stackDepthInput(), '75')

    expect(screen.queryByText('Stack depth must be a positive number.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Range' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    expect(loadSavedRanges()[0].metadata).toEqual({ stackDepthBb: 75 })
  })

  it('drops a blank stack depth rather than storing it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'No Stack')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(positionSelect(), 'btn')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const [saved] = loadSavedRanges()
    expect(saved.metadata).toEqual({ position: 'btn' })
    expect(saved.metadata?.stackDepthBb).toBeUndefined()
  })
})

describe('Range source attribution', () => {
  it('persists a source kind and reference when saving a range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Solver Range')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(sourceSelect(), 'solver')
    await user.type(referenceInput(), 'PioSolver sim #4')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    const [saved] = loadSavedRanges()
    expect(saved.source).toEqual({ kind: 'solver', reference: 'PioSolver sim #4' })
  })

  it('persists a kind-only source when no reference is given', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'My Study')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(sourceSelect(), 'personal')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(loadSavedRanges()[0].source).toEqual({ kind: 'personal' })
  })

  it('saves no source when the kind is left blank', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'No Source')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    // A reference without a kind cannot form a source.
    await user.type(referenceInput(), 'orphan reference')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))

    expect(loadSavedRanges()[0].source).toBeUndefined()
  })

  it('restores the source fields when a saved range is loaded', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Sourced')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(sourceSelect(), 'book')
    await user.type(referenceInput(), 'Modern Poker Theory')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    await user.click(screen.getByRole('button', { name: 'New Range' }))

    // New Range cleared the source controls back to their blank defaults.
    expect(sourceSelect()).toHaveValue('')
    expect(referenceInput()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Load range Sourced' }))

    expect(sourceSelect()).toHaveValue('book')
    expect(referenceInput()).toHaveValue('Modern Poker Theory')
  })

  it('drops the source when the kind is cleared on an existing range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Range name'), 'Toggle')
    await user.click(screen.getByRole('button', { name: 'AA' }))
    await user.selectOptions(sourceSelect(), 'coach')
    await user.click(screen.getByRole('button', { name: 'Save Range' }))
    expect(loadSavedRanges()[0].source).toEqual({ kind: 'coach' })

    // Still editing the same range: clear the kind back to blank and re-save.
    await user.selectOptions(sourceSelect(), '')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(loadSavedRanges()).toHaveLength(1)
    expect(loadSavedRanges()[0].source).toBeUndefined()
  })
})
