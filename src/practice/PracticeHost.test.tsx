import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PracticeHost } from './PracticeHost'
import { ALL_HANDS } from '../domain/pokerHands'
import { loadPracticeStats } from '../storage/practiceStatsStorage'
import { loadReviewStates } from '../storage/reviewStateStorage'
import { loadActionAccuracy } from '../storage/actionAccuracyStorage'
import { loadHandAccuracy } from '../storage/handAccuracyStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { loadSpotAccuracy } from '../storage/spotAccuracyStorage'
import type { SavedRange } from '../types/range'

beforeEach(() => {
  localStorage.clear()
})

function makeRange(id: string, name: string, extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'KK'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

describe('PracticeHost mode picker', () => {
  it('lists base modes and hides the conditional quizzes', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Recognize hands')).toBeInTheDocument()
    expect(screen.getByText('Build from memory')).toBeInTheDocument()
    expect(screen.getByText('Timed drill')).toBeInTheDocument()
    expect(screen.getByText('Weakness drill')).toBeInTheDocument()
    expect(screen.getByText('Combo drill')).toBeInTheDocument()
    expect(screen.getByText('Postflop drill')).toBeInTheDocument()
    expect(screen.getByText('Range vs board')).toBeInTheDocument()
    expect(screen.queryByText('Pick the correct action')).not.toBeInTheDocument()
    expect(screen.queryByText('Frequency quiz')).not.toBeInTheDocument()
  })

  it('offers the edge drill and prompts only from the range boundary', async () => {
    const user = userEvent.setup()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Edge drill'))

    // The AA/KK range's boundary: the two hands themselves plus what touches them.
    const edge = ['AA', 'AKs', 'AKo', 'KK', 'KQs', 'AQo', 'KQo']
    expect(edge).toContain(screen.getByTestId('drill-hand').textContent)
  })

  it('hides the edge drill for a range with no boundary', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'Everything', { hands: ALL_HANDS })], mode: null }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText('Edge drill')).not.toBeInTheDocument()
  })

  it('offers the action and frequency quizzes when the range has the data', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            makeRange('a', 'UTG open', {
              handActions: { AA: 'raise' },
              mixedStrategies: { KK: [{ action: 'raise', frequency: 100 }] },
            }),
          ],
          mode: null,
        }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Pick the correct action')).toBeInTheDocument()
    expect(screen.getByText('Frequency quiz')).toBeInTheDocument()
  })

  it('closes from the picker without recording anything', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadReviewStates()).toEqual({})
  })

  it('starts the recognition drill from the picker', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Recognize hands'))
    expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument()
  })

  it('opens build-from-memory inside the overlay', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: null }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Build from memory'))
    expect(
      screen.getByRole('dialog', { name: 'UTG open — build from memory' }),
    ).toBeInTheDocument()
  })
})

describe('PracticeHost build from memory', () => {
  it('counts a checked build as a session so the day and the schedule move', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'build' }}
        onClose={vi.fn()}
      />,
    )

    // Rebuild AA and QQ against an AA/KK chart: one right, one forgotten, one
    // added by mistake.
    fireEvent.click(screen.getByRole('button', { name: 'AA' }))
    fireEvent.click(screen.getByRole('button', { name: 'QQ' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check my range' }))

    expect(loadPracticeStats()['a'].totalAttempts).toBe(3)
    expect(loadPracticeStats()['a'].correctAttempts).toBe(1)
    expect(loadSessionHistory()['a']).toHaveLength(1)
    expect(loadReviewStates()['a'].dueAt).not.toBe('')
    // The in/out record stays untouched: a build never answered hand by hand.
    expect(loadHandAccuracy()['a']).toBeUndefined()
  })

  it('does not record a check on a blank grid', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'build' }}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Check my range' }))

    // Checking nothing is how you ask to be shown the chart, not a 0% session.
    expect(screen.getByText('Correct: 0 of 2')).toBeInTheDocument()
    expect(loadPracticeStats()['a']).toBeUndefined()
    expect(loadSessionHistory()['a']).toBeUndefined()
    expect(loadReviewStates()['a']).toBeUndefined()
  })

  it('still shows the comparison when the build cannot be saved', () => {
    // A full store: the run is lost, but the comparison is in memory, so the
    // user must still see how they did and why nothing saved.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    // Restored even on failure — a leaked throwing setItem would break every
    // test after this one and hide the real cause.
    try {
      render(
        <PracticeHost
          request={{ ranges: [makeRange('a', 'UTG open')], mode: 'build' }}
          onClose={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'AA' }))
      fireEvent.click(screen.getByRole('button', { name: 'Check my range' }))

      expect(screen.getByText('Correct: 1 of 2')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    } finally {
      setItem.mockRestore()
    }
  })
})

describe('PracticeHost recognition flow', () => {
  it('records the session and shows the peak-end summary', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={onClose}
      />,
    )
    // Answer one hand correctly, then close early -> summary.
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
    expect(screen.getByText('First session logged — that’s your baseline.')).toBeInTheDocument()
    expect(screen.getByText(/1-day streak/)).toBeInTheDocument()

    const stats = loadPracticeStats()['a']
    expect(stats.totalAttempts).toBe(1)
    expect(stats.correctAttempts).toBe(1)
    expect(loadReviewStates()['a']).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still shows the summary when the session cannot be saved', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={onClose}
      />,
    )
    // A full store from here on: the recorded run is lost, but the numbers are
    // in memory, so the user must still see how they did and why nothing saved.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    // Restored even on failure — a leaked throwing setItem would break every
    // test after this one and hide the real cause.
    try {
      fireEvent.click(screen.getByRole('button', { name: 'In range' }))
      fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

      expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
      expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or unavailable/)
    } finally {
      spy.mockRestore()
    }
  })

  it('recaps the session’s misses on the summary', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    // AA is in the range, so folding it is a miss the summary has to name.
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.getByRole('region', { name: 'What you missed' })).toHaveTextContent(
      'Play these: AA',
    )
  })

  it('re-drills only the hands the session missed', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { hands: ['AA', 'KK', 'QQ'] })],
          mode: 'recognize',
          handPool: ['AA', '72o'],
        }}
        onClose={vi.fn()}
      />,
    )
    // Answer the first prompt wrongly, whichever of the pool's two it is.
    const missed = screen.getByTestId('drill-hand').textContent ?? ''
    fireEvent.click(screen.getByRole('button', { name: missed === 'AA' ? 'Fold' : 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drill these now' }))

    // Back in a drill, dealing the one missed hand — not the request's wider pool.
    expect(screen.queryByLabelText('Session summary')).not.toBeInTheDocument()
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByTestId('drill-hand')).toHaveTextContent(missed)
      fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
      const next = screen.queryByRole('button', { name: 'Next' })
      if (!next) break
      fireEvent.click(next)
    }
  })

  it('offers no re-drill when the session missed nothing', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.queryByRole('button', { name: 'Drill these now' })).not.toBeInTheDocument()
  })

  it('leaves the miss recap off a clean session', () => {
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.queryByRole('region', { name: 'What you missed' })).not.toBeInTheDocument()
  })

  it('abandons without recording when closed before any answer', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize' }}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadReviewStates()).toEqual({})
    expect(loadPracticeStats()).toEqual({})
  })

  it('advances a review queue through Next range', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open'), makeRange('b', 'BTN open')],
          mode: 'recognize',
          handPool: ['AA'],
        }}
        onClose={onClose}
      />,
    )
    // Queue position shows in the top bar.
    expect(screen.getByText('UTG open · 1/2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next range' }))

    expect(screen.getByText('BTN open · 2/2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    // Last range: only Done remains.
    expect(screen.queryByRole('button', { name: 'Next range' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(Object.keys(loadReviewStates()).sort()).toEqual(['a', 'b'])
  })

  it('takes the summary’s primary action with Enter', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open'), makeRange('b', 'BTN open')],
          mode: 'recognize',
          handPool: ['AA'],
        }}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    // Another range waits: Enter means Next range.
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.getByText('BTN open · 2/2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    // Last range: Enter means Done.
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('celebrates an improved session with the points delta', () => {
    // Prior session at 50% -> a perfect 1/1 session is +50 points.
    localStorage.setItem(
      'poker-range-trainer.session-history.v1',
      JSON.stringify({
        a: [
          {
            rangeId: 'a',
            playedAt: '2026-07-10T10:00:00.000Z',
            totalQuestions: 10,
            correctAnswers: 5,
          },
        ],
      }),
    )
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(screen.getByText('Up 50 points from your last session.')).toBeInTheDocument()
  })

  it('uses the singular for a one-point improvement', () => {
    // Prior session at 99% -> a perfect session is exactly +1 point.
    localStorage.setItem(
      'poker-range-trainer.session-history.v1',
      JSON.stringify({
        a: [
          {
            rangeId: 'a',
            playedAt: '2026-07-10T10:00:00.000Z',
            totalQuestions: 100,
            correctAnswers: 99,
          },
        ],
      }),
    )
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(screen.getByText('Up 1 point from your last session.')).toBeInTheDocument()
  })

  it('reports holding steady when accuracy matches the previous session', () => {
    localStorage.setItem(
      'poker-range-trainer.session-history.v1',
      JSON.stringify({
        a: [
          {
            rangeId: 'a',
            playedAt: '2026-07-10T10:00:00.000Z',
            totalQuestions: 10,
            correctAnswers: 10,
          },
        ],
      }),
    )
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'In range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(screen.getByText('Held steady at 100%.')).toBeInTheDocument()
  })

  it('frames a weaker session around the queued misses', () => {
    // Seed a strong previous session, then miss every hand this session.
    localStorage.setItem(
      'poker-range-trainer.session-history.v1',
      JSON.stringify({
        a: [
          {
            rangeId: 'a',
            playedAt: '2026-07-10T10:00:00.000Z',
            totalQuestions: 10,
            correctAnswers: 10,
          },
        ],
      }),
    )
    render(
      <PracticeHost
        request={{ ranges: [makeRange('a', 'UTG open')], mode: 'recognize', handPool: ['AA'] }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    expect(
      screen.getByText('1 miss queued for review — they’ll show up more until they stick.'),
    ).toBeInTheDocument()
  })
})

describe('PracticeHost action quiz', () => {
  it('records action accuracy and shows a summary without a delta line', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { handActions: { AA: 'raise', KK: 'call' } })],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )
    // The quiz prompts a hand; answer with any action, then end the quiz.
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))
    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.queryByText(/baseline/)).not.toBeInTheDocument()
    expect(Object.keys(loadActionAccuracy())).toEqual(['a'])
  })

  it('counts the quiz as a session so the day and the schedule move', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { handActions: { AA: 'raise', KK: 'call' } })],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    // Answering nine hands and then being told you have practiced nothing today
    // is the app contradicting itself, so an action quiz counts like any session.
    expect(loadPracticeStats()['a'].totalAttempts).toBe(1)
    expect(loadSessionHistory()['a']).toHaveLength(1)
    expect(loadReviewStates()['a'].dueAt).not.toBe('')
    expect(screen.getByLabelText('Session summary')).toHaveTextContent(/1-day streak/)
    // The in/out record stays untouched: the quiz never asked that question.
    expect(loadHandAccuracy()['a']).toBeUndefined()
  })

  it('recaps a missed action under the action the hand wanted', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { handActions: { AA: 'raise' } })],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )

    // Only AA is assigned, so calling it is a miss the recap has to explain.
    fireEvent.click(screen.getByRole('button', { name: 'Call' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(screen.getByRole('region', { name: 'What you missed' })).toHaveTextContent(
      'Raise these: AA',
    )
  })

  it('re-quizzes only the hands whose action went wrong', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            makeRange('a', 'UTG open', {
              hands: ['AA', 'KK'],
              handActions: { AA: 'raise', KK: 'call' },
            }),
          ],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )

    // Folding is wrong for both assigned hands, so whichever was prompted misses.
    const promptedHand = () =>
      screen.getByText('What is the correct action?').nextElementSibling?.textContent ?? ''
    const missed = promptedHand()
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drill these now' }))

    // Back in the quiz, asking only about the hand that went wrong — a pool of
    // one, so the next question is the same hand rather than the other chart entry.
    expect(screen.queryByLabelText('Session summary')).not.toBeInTheDocument()
    expect(promptedHand()).toBe(missed)
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(promptedHand()).toBe(missed)
  })

  it('leaves the recap off a clean action quiz', () => {
    render(
      <PracticeHost
        request={{
          ranges: [makeRange('a', 'UTG open', { handActions: { AA: 'raise' } })],
          mode: 'action',
        }}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(screen.queryByRole('region', { name: 'What you missed' })).not.toBeInTheDocument()
  })
})

describe('PracticeHost frequency quiz', () => {
  const mixedRange = (mixedStrategies: SavedRange['mixedStrategies']) =>
    makeRange('a', 'UTG open', { mixedStrategies })

  it('ends on a summary that recaps the misses under the primary action', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            mixedRange({
              AA: [
                { action: 'raise', frequency: 70 },
                { action: 'call', frequency: 30 },
              ],
            }),
          ],
          mode: 'mixed',
        }}
        onClose={vi.fn()}
      />,
    )

    // Calling AA is wrong: raise is the more frequent (primary) action.
    fireEvent.click(screen.getByRole('button', { name: 'Call' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(screen.getByLabelText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 correct')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What you missed' })).toHaveTextContent(
      'Raise these: AA',
    )
  })

  it('re-quizzes only the hands whose primary action went wrong', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            mixedRange({
              AA: [
                { action: 'raise', frequency: 70 },
                { action: 'call', frequency: 30 },
              ],
              KK: [
                { action: 'raise', frequency: 60 },
                { action: 'call', frequency: 40 },
              ],
            }),
          ],
          mode: 'mixed',
        }}
        onClose={vi.fn()}
      />,
    )

    // Folding is never primary here, so whichever hand was prompted misses.
    const promptedHand = () =>
      screen.getByText('What is the primary action?').nextElementSibling?.textContent ?? ''
    const missed = promptedHand()
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drill these now' }))

    // A pool of one, so the re-quiz keeps asking about the hand that went wrong.
    expect(screen.queryByLabelText('Session summary')).not.toBeInTheDocument()
    expect(promptedHand()).toBe(missed)
    fireEvent.click(screen.getByRole('button', { name: 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next hand' }))
    expect(promptedHand()).toBe(missed)
  })

  it('counts the quiz as a session without touching the action-quiz numbers', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            mixedRange({
              AA: [
                { action: 'raise', frequency: 70 },
                { action: 'call', frequency: 30 },
              ],
            }),
          ],
          mode: 'mixed',
        }}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(loadPracticeStats()['a'].totalAttempts).toBe(1)
    expect(loadSessionHistory()['a']).toHaveLength(1)
    expect(loadReviewStates()['a'].dueAt).not.toBe('')
    // Its answers are about frequencies, so neither the action store nor the
    // in/out record may absorb them.
    expect(loadActionAccuracy()['a']).toBeUndefined()
    expect(loadHandAccuracy()['a']).toBeUndefined()
  })

  it('leaves the recap and the re-quiz off a clean run', () => {
    render(
      <PracticeHost
        request={{
          ranges: [
            mixedRange({
              AA: [
                { action: 'raise', frequency: 70 },
                { action: 'call', frequency: 30 },
              ],
            }),
          ],
          mode: 'mixed',
        }}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Raise' }))
    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'What you missed' })).not.toBeInTheDocument()
  })

  it('abandons a run that answered nothing instead of summarizing it', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [mixedRange({ AA: [{ action: 'raise', frequency: 100 }] })],
          mode: 'mixed',
        }}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'End quiz' }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByLabelText('Session summary')).not.toBeInTheDocument()
  })
})

describe('PracticeHost spot drill', () => {
  const btnOpen = makeRange('a', 'BTN open', {
    metadata: { position: 'btn', actionType: 'open' },
  })

  it('deals a covered spot and records the session against the grading range', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [btnOpen],
          mode: 'spots',
          spotFormat: { tableSize: 'sixMax', stackDepthBb: 100 },
        }}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('Play the spot')).toBeInTheDocument()
    expect(screen.getByText('6-max, 100bb. Folded to you on the BTN.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    // The summary sums the whole run and names how much of the library it spanned.
    expect(screen.getByText('Across 1 range of your library.')).toBeInTheDocument()
    expect(loadPracticeStats().a.totalAttempts).toBe(1)
    expect(Object.keys(loadReviewStates())).toEqual(['a'])
    // The spot itself is recorded too, for the weakest-spots report.
    expect(loadSpotAccuracy()['sixMax|btn|foldedToYou|-|100']).toMatchObject({ attempts: 1 })
    // A library-wide session is never titled after one range, and never queues a next.
    expect(screen.queryByRole('button', { name: 'Next range' })).not.toBeInTheDocument()
  })

  it('re-drills the ranges the run missed, each over its own misses', () => {
    render(
      <PracticeHost
        request={{
          ranges: [btnOpen],
          mode: 'spots',
          spotFormat: { tableSize: 'sixMax', stackDepthBb: 100 },
        }}
        onClose={vi.fn()}
      />,
    )

    // Answer whatever was dealt wrongly, so the run has exactly one miss.
    const missed = screen.getByTestId('drill-hand').textContent ?? ''
    const shouldOpen = btnOpen.hands.includes(missed)
    fireEvent.click(screen.getByRole('button', { name: shouldOpen ? 'Fold' : 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drill these now' }))

    // Back in a recognition drill on the range that missed, dealing only that hand.
    expect(screen.queryByLabelText('Session summary')).not.toBeInTheDocument()
    expect(screen.getByText('BTN open')).toBeInTheDocument()
    expect(screen.getByTestId('drill-hand')).toHaveTextContent(missed)
  })

  it('offers no re-drill when the run missed nothing', () => {
    render(
      <PracticeHost
        request={{
          ranges: [btnOpen],
          mode: 'spots',
          spotFormat: { tableSize: 'sixMax', stackDepthBb: 100 },
        }}
        onClose={vi.fn()}
      />,
    )

    const hand = screen.getByTestId('drill-hand').textContent ?? ''
    fireEvent.click(screen.getByRole('button', { name: btnOpen.hands.includes(hand) ? 'Open' : 'Fold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(screen.queryByRole('button', { name: 'Drill these now' })).not.toBeInTheDocument()
  })

  it('closes without recording when nothing was answered', () => {
    const onClose = vi.fn()
    render(
      <PracticeHost
        request={{
          ranges: [btnOpen],
          mode: 'spots',
          spotFormat: { tableSize: 'sixMax', stackDepthBb: 100 },
        }}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close practice' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(loadPracticeStats()).toEqual({})
    expect(loadSpotAccuracy()).toEqual({})
  })
})
