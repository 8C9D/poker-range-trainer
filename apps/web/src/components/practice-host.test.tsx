import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import {
  practiceSessionSubmissionSchema,
  type PracticeSessionSubmission,
  type RangeRead,
} from '@poker-range-trainer/contracts'

import { ApiClientError, getRange, getRangePractice, submitPracticeSession } from '@/lib/api-client'
import { renderAt } from '@/test/router'

import { PracticeHost } from './practice-host'

const navigation = vi.hoisted(() => ({ search: '' }))
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useSearchParams: () => [new URLSearchParams(navigation.search), vi.fn()],
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    getRange: vi.fn(),
    getRangePractice: vi.fn(),
    submitPracticeSession: vi.fn(),
  }
})

const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const secondId = '9f2cae71-d410-4fcf-8fb2-527964db0c2e'
const sessionId = 'ac0f1f8e-1cf3-4b0b-8b53-9d5a26fb6b31'
const iso = '2026-01-02T03:04:05.000Z'

const range: RangeRead = {
  id: rangeId,
  version: 2,
  name: 'BTN open',
  hands: ['AA', 'KK', 'AKs'],
  metadata: null,
  displayOrder: 0,
  archived: false,
  favorite: false,
  createdAt: iso,
  updatedAt: iso,
  deletedAt: null,
}
const secondRange: RangeRead = { ...range, id: secondId, name: 'CO open' }

function sessionResponse(
  session: Partial<{ totalQuestions: number; correctAnswers: number }> = {},
) {
  const totalQuestions = session.totalQuestions ?? 2
  const correctAnswers = session.correctAnswers ?? 1
  return {
    data: {
      session: {
        id: sessionId,
        rangeId,
        mode: 'recognition' as const,
        totalQuestions,
        correctAnswers,
        accuracyPercentage: (correctAnswers / totalQuestions) * 100,
        completedAt: iso,
      },
      stats: {
        rangeId,
        totalAttempts: 12,
        correctAttempts: 9,
        accuracyPercentage: 75,
        lastPracticedAt: iso,
      },
      review: {
        rangeId,
        ease: 2.5,
        intervalDays: 3,
        dueAt: '2026-01-05T03:04:05.000Z',
        lastReviewedAt: iso,
      },
    },
  }
}

function emptyPractice(id = rangeId) {
  return { data: { rangeId: id, stats: null, review: null, handAccuracy: [], recentSessions: [] } }
}

function problem(status: number) {
  return new ApiClientError('problem', 'The requested range does not exist.', {
    status,
    problem: {
      type: 'about:blank',
      title: 'Not found',
      status,
      instance: '/api/v1/ranges/id',
      requestId: sessionId,
      code: 'NOT_FOUND',
    },
  })
}

/** The grid paints with pointer events, exactly as the range editor's test does. */
function selectHand(hand: string): void {
  const cell = screen.getByRole('button', { name: hand, pressed: false })
  fireEvent.pointerDown(cell, { clientX: 1, clientY: 1, pointerId: 1 })
  fireEvent.pointerUp(cell.parentElement!, { pointerId: 1 })
}

const read = vi.mocked(getRange)
const readPractice = vi.mocked(getRangePractice)
const submit = vi.mocked(submitPracticeSession)

type AnsweredSubmission = Extract<PracticeSessionSubmission, { mode: 'recognition' }>

describe('PracticeHost', () => {
  let random: MockInstance<() => number>

  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.setPointerCapture = vi.fn()
    // Every prompt is AA, which this range plays: the drill under test is the
    // flow, not the draw, and the draw has its own tests in lib/drill.test.ts.
    random = vi.spyOn(Math, 'random').mockReturnValue(0)
    read.mockResolvedValue({ data: range })
    readPractice.mockResolvedValue(emptyPractice())
    submit.mockResolvedValue(sessionResponse())
  })

  afterEach(() => {
    cleanup()
    random.mockRestore()
  })

  it('offers every mode on a fresh single-range drill, and stops offering them once it starts', async () => {
    navigation.search = `range=${rangeId}&count=30`
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()

    const picker = screen.getByRole('navigation', { name: 'Practice modes' })
    expect(
      within(picker)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Recognition',
      'Timed',
      'Weak spots',
      'Range edges',
      'Past mistakes',
      'Build from memory',
    ])
    // The count the URL asked for survives a mode switch; the default never
    // clutters the link.
    expect(within(picker).getByRole('link', { name: 'Weak spots' })).toHaveAttribute(
      'href',
      `/app/practice?range=${rangeId}&mode=weakness&count=30`,
    )
    const current = within(picker).getByRole('link', { current: 'page' })
    expect(current).toHaveTextContent('Recognition')
    expect(screen.queryByRole('list', { name: 'Timed drill length' })).not.toBeInTheDocument()

    await userEvent.setup().keyboard('i')
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Practice modes' })).not.toBeInTheDocument()
  })

  it('restarts the run under the new mode when the URL mode changes', async () => {
    navigation.search = `range=${rangeId}`
    const { rerender } = renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    await userEvent.setup().keyboard('i')
    expect(screen.getByText('Correct')).toBeInTheDocument()

    navigation.search = `range=${rangeId}&mode=edges`
    rerender(<PracticeHost />)

    expect(await screen.findByText('Range edges drill')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 20')).toBeInTheDocument()
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Practice modes' })).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it('marks the running duration on a timed drill and hides the picker for a queue', async () => {
    navigation.search = `range=${rangeId}&mode=timed&seconds=30`
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    const durations = screen.getByRole('list', { name: 'Timed drill length' })
    expect(
      within(durations)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['30s', '60s', '120s'])
    expect(within(durations).getByRole('link', { current: 'page' })).toHaveTextContent('30s')
    expect(within(durations).getByRole('link', { name: '120s' })).toHaveAttribute(
      'href',
      `/app/practice?range=${rangeId}&mode=timed&seconds=120`,
    )
    cleanup()

    navigation.search = `queue=${rangeId},${secondId}`
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Practice modes' })).not.toBeInTheDocument()
  })

  it('answers with the keyboard and the buttons, retries one submission, and shows the summary', async () => {
    navigation.search = `range=${rangeId}`
    submit
      .mockRejectedValueOnce(
        new ApiClientError('network', 'We could not reach the server. Check your connection.'),
      )
      .mockResolvedValueOnce(sessionResponse())
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    const user = userEvent.setup()

    expect(screen.getByText('Question 1 of 20')).toBeInTheDocument()
    await user.keyboard('i')
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/^AA is in\./)).toBeInTheDocument()
    await user.keyboard('{Enter}')

    expect(screen.getByText('Question 2 of 20')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Out of range' }))
    expect(screen.getByText('Missed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish early' }))
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    const first = submit.mock.calls[0]?.[0] as AnsweredSubmission
    expect(practiceSessionSubmissionSchema.safeParse(first)).toMatchObject({ success: true })
    expect(first).toMatchObject({ mode: 'recognition', rangeId })
    expect(first.answers).toHaveLength(2)
    expect(first.answers.map((entry) => entry.answer)).toEqual([true, false])

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save this session')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
    const retried = submit.mock.calls[1]?.[0] as AnsweredSubmission
    expect(retried.idempotencyKey).toBe(first.idempotencyKey)

    expect(await screen.findByText('1 of 2 correct · 50%')).toBeInTheDocument()
    expect(screen.getByText(/75% across 12 answers/)).toBeInTheDocument()
    expect(screen.getByText('Start playing (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice again' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next range' })).not.toBeInTheDocument()
  })

  it('submits a built range and reports what it missed and added', async () => {
    navigation.search = `range=${rangeId}&mode=build`
    submit.mockResolvedValue(sessionResponse({ totalQuestions: 4, correctAnswers: 1 }))
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()

    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Check my range' })).toBeDisabled()
    selectHand('AA')
    selectHand('QQ')
    await user.click(screen.getByRole('button', { name: 'Check my range' }))

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    const submission = submit.mock.calls[0]?.[0]
    expect(practiceSessionSubmissionSchema.safeParse(submission)).toMatchObject({ success: true })
    expect(submission).toMatchObject({ mode: 'build', rangeId, selectedHands: ['AA', 'QQ'] })

    expect(await screen.findByText('Missed (2)')).toBeInTheDocument()
    expect(screen.getByText('AKs, KK')).toBeInTheDocument()
    expect(screen.getByText('Extra (1)')).toBeInTheDocument()
    expect(screen.getByText('QQ')).toBeInTheDocument()
  })

  it('moves to the next range in a queue once the first is saved', async () => {
    navigation.search = `queue=${rangeId},${secondId}`
    read.mockImplementation((id: string) =>
      Promise.resolve({ data: id === rangeId ? range : secondRange }),
    )
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
    expect(screen.getByText('Range 1 of 2')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.keyboard('i')
    await user.click(screen.getByRole('button', { name: 'Finish early' }))
    await user.click(await screen.findByRole('button', { name: 'Next range' }))

    expect(await screen.findByRole('heading', { name: 'CO open' })).toBeInTheDocument()
    expect(screen.getByText('Range 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 20')).toBeInTheDocument()
  })

  it('deals a timed run without pausing and submits itself when the clock runs out', async () => {
    navigation.search = `range=${rangeId}&mode=timed&seconds=30`
    const start = Date.now()
    let elapsed = 0
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => start + elapsed)
    try {
      renderAt(<PracticeHost />, '/app/practice')
      expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
      expect(screen.getByText('30s left · 0 answered')).toBeInTheDocument()

      await userEvent.setup().click(screen.getByRole('button', { name: 'In range' }))
      expect(screen.getByText('Correct')).toBeInTheDocument()
      // No Next step under the clock: the following hand is already dealt.
      expect(screen.getByRole('button', { name: 'In range' })).toBeInTheDocument()
      expect(screen.getByText('30s left · 1 answered')).toBeInTheDocument()

      elapsed = 31_000
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1), { timeout: 2_000 })
      expect(submit.mock.calls[0]?.[0]).toMatchObject({ mode: 'timed', rangeId })
      expect(await screen.findByText('1 of 2 correct · 50%')).toBeInTheDocument()
    } finally {
      clock.mockRestore()
    }
  })

  it('skips a queued range that no longer exists and says so', async () => {
    navigation.search = `queue=${rangeId},${secondId}`
    read.mockImplementation((id: string) =>
      id === rangeId ? Promise.reject(problem(404)) : Promise.resolve({ data: secondRange }),
    )
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('heading', { name: 'CO open' })).toBeInTheDocument()
    expect(screen.getByText(/1 queued range was skipped/)).toBeInTheDocument()
  })

  it('asks for a range when the URL names none', () => {
    navigation.search = ''
    renderAt(<PracticeHost />, '/app/practice')
    expect(screen.getByRole('heading', { name: 'Choose a range' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to library' })).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
  })

  it('refuses to run a mistakes drill with no recorded mistakes, and records nothing', async () => {
    navigation.search = `range=${rangeId}&mode=mistakes`
    renderAt(<PracticeHost />, '/app/practice')
    expect(
      await screen.findByRole('heading', { name: 'No recorded mistakes for this range yet' }),
    ).toBeInTheDocument()
    expect(readPractice).toHaveBeenCalledWith(rangeId)
    expect(screen.getByRole('link', { name: 'Practice recognition instead' })).toHaveAttribute(
      'href',
      `/app/practice?range=${rangeId}&mode=recognition`,
    )
    expect(screen.queryByRole('button', { name: 'In range' })).not.toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it('offers a retry when the range itself will not load', async () => {
    navigation.search = `range=${rangeId}`
    read.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: range })
    renderAt(<PracticeHost />, '/app/practice')
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this drill')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'BTN open' })).toBeInTheDocument()
  })
})
