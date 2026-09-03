import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TodayReadModel } from '@poker-range-trainer/contracts'

import { ApiClientError, getToday, listRanges, updateTrainingGoal } from '@/lib/api-client'
import { clearDrillPoolCache } from '@/lib/drill-handoff'

import { TodayView } from './today-view'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getToday: vi.fn(), listRanges: vi.fn(), updateTrainingGoal: vi.fn() }
})

const btn = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const cutoff = '9f2cae71-d410-4fcf-8fb2-527964db0c2e'
const generatedAt = '2026-09-03T12:00:00.000Z'

const quietDay: TodayReadModel = {
  generatedAt,
  streakDays: 0,
  dailyGoal: { target: null, handsAnswered: 0, remainingHands: 0 },
  trailingSevenDays: {
    handsAnswered: 0,
    correctAnswers: 0,
    accuracyPercentage: 0,
    sharpestRange: null,
  },
  dueRanges: [],
  caughtUp: true,
  freePractice: null,
}

const dueDay: TodayReadModel = {
  ...quietDay,
  streakDays: 4,
  dailyGoal: { target: 20, handsAnswered: 12, remainingHands: 8 },
  trailingSevenDays: {
    handsAnswered: 40,
    correctAnswers: 30,
    accuracyPercentage: 75,
    sharpestRange: {
      id: btn,
      name: 'BTN open',
      handsAnswered: 20,
      correctAnswers: 18,
      accuracyPercentage: 90,
    },
  },
  dueRanges: [
    {
      id: btn,
      name: 'BTN open',
      dueAt: '2026-09-03T00:00:00.000Z',
      accuracyPercentage: 72,
      lastPracticedAt: '2026-09-01T09:00:00.000Z',
    },
    {
      id: cutoff,
      name: 'CO open',
      dueAt: null,
      accuracyPercentage: null,
      lastPracticedAt: null,
    },
  ],
  caughtUp: false,
}

const weakHandPools = { [btn]: ['K8s', 'J7s'], [cutoff]: ['A5o'] }
const caughtUpDay: TodayReadModel = {
  ...quietDay,
  trailingSevenDays: {
    handsAnswered: 20,
    correctAnswers: 15,
    accuracyPercentage: 75,
    sharpestRange: {
      id: btn,
      name: 'BTN open',
      handsAnswered: 10,
      correctAnswers: 8,
      accuracyPercentage: 80,
    },
  },
  freePractice: {
    kind: 'weakHands',
    rangeIds: [btn, cutoff],
    pools: weakHandPools,
    handCount: 3,
  },
}

const today = vi.mocked(getToday)
const list = vi.mocked(listRanges)
const saveGoal = vi.mocked(updateTrainingGoal)

function respond(model: TodayReadModel) {
  return { data: model }
}

function emptyLibrary() {
  return { data: [], meta: { page: 1, pageSize: 1, totalItems: 0, totalPages: 0 } }
}

function storedPools(): Record<string, unknown> {
  const entries = Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith('prt.drill-pools.'))
    .map((key) => [key.slice('prt.drill-pools.'.length), JSON.parse(sessionStorage.getItem(key)!)])
  return Object.fromEntries(entries)
}

describe('TodayView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    clearDrillPoolCache()
    today.mockResolvedValue(respond(dueDay))
    saveGoal.mockResolvedValue({ data: { dailyHandsGoal: 40, updatedAt: generatedAt } })
  })

  afterEach(cleanup)

  it('opens the due review with the whole queue and an honest time estimate', async () => {
    render(<TodayView />)

    const start = await screen.findByRole('link', { name: 'Start review' })
    expect(start).toHaveAttribute('href', `/app/practice?queue=${btn},${cutoff}&mode=recognition`)
    // 2 ranges at 1.5 minutes each, rounded up.
    expect(screen.getByText('2 ranges due · ~3 min')).toBeInTheDocument()
    expect(screen.getByText('4 days')).toBeInTheDocument()
    expect(screen.getByText(/^72% last accuracy · practiced /)).toBeInTheDocument()
    expect(screen.getByText('New — never practiced')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Review' })[0]?.getAttribute('href')).toBe(
      `/app/practice?queue=${btn}&mode=recognition`,
    )
    // The library is only questioned when the day itself looks brand new.
    expect(list).not.toHaveBeenCalled()
  })

  it('hands the weak-hand pools over through storage before starting the drill', async () => {
    today.mockResolvedValue(respond(caughtUpDay))
    const user = userEvent.setup()
    render(<TodayView />)

    expect(
      await screen.findByText(
        'Nothing is due right now. Sharpen the 3 hands you play worst, across 2 charts.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Drill weak hands' }))

    const stored = storedPools()
    const [poolsKey] = Object.keys(stored)
    expect(stored[poolsKey!]).toEqual(weakHandPools)
    expect(push).toHaveBeenCalledWith(
      `/app/practice?queue=${btn},${cutoff}&mode=recognition&pools=${poolsKey}`,
    )
  })

  it('saves a new daily goal and re-reads the day, keeping the picker on a failed save', async () => {
    today
      .mockResolvedValueOnce(respond(dueDay))
      .mockResolvedValueOnce(
        respond({ ...dueDay, dailyGoal: { target: 40, handsAnswered: 12, remainingHands: 28 } }),
      )
    const user = userEvent.setup()
    render(<TodayView />)

    const picker = await screen.findByRole('combobox', { name: 'Daily goal in hands' })
    expect(screen.getByText('12 of 20 hands — 8 to go.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Daily goal progress' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    )

    await user.selectOptions(picker, '40')
    expect(saveGoal).toHaveBeenCalledWith(40)
    expect(await screen.findByText('12 of 40 hands — 28 to go.')).toBeInTheDocument()
    await waitFor(() => expect(today).toHaveBeenCalledTimes(2))

    saveGoal.mockRejectedValueOnce(new ApiClientError('network', 'We could not reach the server.'))
    await user.selectOptions(picker, '80')
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    // The stored target never moved, so neither does the picker.
    expect(picker).toHaveValue('40')
    expect(screen.getByText('12 of 40 hands — 28 to go.')).toBeInTheDocument()
  })

  it('turns the goal off with a null target and offers the untouched options', async () => {
    today.mockResolvedValue(
      respond({ ...dueDay, dailyGoal: { target: 50, handsAnswered: 12, remainingHands: 38 } }),
    )
    const user = userEvent.setup()
    render(<TodayView />)

    const picker = await screen.findByRole('combobox', { name: 'Daily goal in hands' })
    // A target that is not one of the offered options still has to be selectable.
    expect(picker).toHaveValue('50')
    expect(Array.from(picker.querySelectorAll('option')).map((option) => option.value)).toEqual([
      '',
      '10',
      '20',
      '40',
      '50',
      '80',
    ])

    await user.selectOptions(picker, '')
    expect(saveGoal).toHaveBeenCalledWith(null)
  })

  it('asks the library before welcoming a brand-new account', async () => {
    today.mockResolvedValue(respond(quietDay))
    list.mockResolvedValue(emptyLibrary())
    render(<TodayView />)

    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create a range' })).toHaveAttribute(
      'href',
      '/app/library/new',
    )
    expect(list).toHaveBeenCalledWith({ pageSize: 1 })
    expect(screen.queryByLabelText('All caught up')).not.toBeInTheDocument()
  })

  it('keeps a rested but stocked library on the caught-up card', async () => {
    today.mockResolvedValue(respond(quietDay))
    // One saved range is enough to mean "rested", not "new".
    list.mockResolvedValue({
      data: [
        {
          id: btn,
          version: 1,
          name: 'BTN open',
          metadata: null,
          displayOrder: 0,
          handCount: 1,
          comboCount: 6,
          rangePercentage: (6 / 1326) * 100,
          archived: false,
          favorite: false,
          updatedAt: generatedAt,
          deletedAt: null,
        },
      ],
      meta: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1 },
    })
    render(<TodayView />)

    expect(
      await screen.findByText('Nothing is due right now. Fancy a free practice run anyway?'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Free practice' })).toHaveAttribute(
      'href',
      '/app/library',
    )
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
  })

  it('links an early review straight at the range that comes round next', async () => {
    today.mockResolvedValue(
      respond({
        ...quietDay,
        freePractice: { kind: 'reviewEarly', rangeId: btn, dueAt: '2026-09-05T12:00:00.000Z' },
      }),
    )
    render(<TodayView />)

    expect(await screen.findByRole('link', { name: 'Review early' })).toHaveAttribute(
      'href',
      `/app/practice?queue=${btn}&mode=recognition`,
    )
  })

  it('shows a loading state, then a retryable failure', async () => {
    let resolveToday: (value: { data: TodayReadModel }) => void
    today.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToday = resolve
      }),
    )
    const { unmount } = render(<TodayView />)
    expect(screen.getByText('Loading your day…')).toBeInTheDocument()
    resolveToday!(respond(dueDay))
    await screen.findByRole('link', { name: 'Start review' })
    unmount()

    today
      .mockRejectedValueOnce(new ApiClientError('network', 'We could not reach the server.'))
      .mockResolvedValueOnce(respond(dueDay))
    render(<TodayView />)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Start review' })).toBeInTheDocument()
  })
})
