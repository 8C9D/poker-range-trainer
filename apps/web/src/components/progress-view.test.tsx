import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProgressReadModel, RangeListItem } from '@poker-range-trainer/contracts'

import { ApiClientError, getProgress, listRanges } from '@/lib/api-client'
import { clearDrillPoolCache } from '@/lib/drill-handoff'

import { ProgressView } from './progress-view'

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getProgress: vi.fn(), listRanges: vi.fn() }
})

const btn = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const deleted = '9f2cae71-d410-4fcf-8fb2-527964db0c2e'
const generatedAt = '2026-09-03T12:00:00.000Z'

const emptyProgress: ProgressReadModel = {
  generatedAt,
  streakDays: 0,
  allTime: { rangesPracticed: 0, handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
  trailingThirtyDays: { handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
  dailyActivity: [
    { day: '2026-09-02', handsAnswered: 0 },
    { day: '2026-09-03', handsAnswered: 0 },
  ],
  weeklyAccuracyTrend: [
    { weekStart: '2026-08-31', handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
  ],
  handClassLeaks: [],
  mistakeBias: { loose: 0, tight: 0, mistakes: 0, loosePercentage: 0, bias: 'unknown' },
  positionLeans: [],
  weakestHands: [],
}

const leakPools = { [btn]: ['K8s', 'J7s'] }
const seatPools = { [btn]: ['A5o'] }
const fullProgress: ProgressReadModel = {
  ...emptyProgress,
  streakDays: 5,
  allTime: { rangesPracticed: 2, handsAnswered: 120, correctAnswers: 90, accuracyPercentage: 75 },
  trailingThirtyDays: { handsAnswered: 60, correctAnswers: 45, accuracyPercentage: 75 },
  dailyActivity: [
    { day: '2026-09-02', handsAnswered: 8 },
    { day: '2026-09-03', handsAnswered: 12 },
  ],
  weeklyAccuracyTrend: [
    { weekStart: '2026-08-24', handsAnswered: 20, correctAnswers: 14, accuracyPercentage: 70 },
    { weekStart: '2026-08-31', handsAnswered: 40, correctAnswers: 32, accuracyPercentage: 80 },
  ],
  handClassLeaks: [
    {
      handClass: 'suitedGapper',
      attempts: 10,
      correct: 4,
      accuracyPercentage: 40,
      missedHands: ['K8s', 'J7s', '96s', '85s', '74s'],
      pools: leakPools,
    },
  ],
  mistakeBias: { loose: 8, tight: 2, mistakes: 10, loosePercentage: 80, bias: 'loose' },
  positionLeans: [
    {
      position: 'btn',
      summary: { loose: 7, tight: 1, mistakes: 8, loosePercentage: 87.5, bias: 'loose' },
      pools: seatPools,
    },
  ],
  weakestHands: [
    { rangeId: btn, hand: 'K8s', attempts: 5, correct: 1, accuracyPercentage: 20 },
    { rangeId: btn, hand: 'J7s', attempts: 4, correct: 1, accuracyPercentage: 25 },
    { rangeId: deleted, hand: 'Q9o', attempts: 3, correct: 1, accuracyPercentage: (1 / 3) * 100 },
  ],
}

const savedRange: RangeListItem = {
  id: btn,
  version: 1,
  name: 'BTN open',
  metadata: null,
  displayOrder: 0,
  handCount: 2,
  comboCount: 10,
  rangePercentage: (10 / 1326) * 100,
  archived: false,
  favorite: false,
  updatedAt: generatedAt,
  deletedAt: null,
}

const progress = vi.mocked(getProgress)
const list = vi.mocked(listRanges)

function library(data: RangeListItem[] = [savedRange]) {
  return {
    data,
    meta: {
      page: 1,
      pageSize: 100,
      totalItems: data.length,
      totalPages: data.length === 0 ? 0 : 1,
    },
  }
}

/** Format a calendar date the way the chart does, so the assertion is locale-proof. */
function weekday(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
}

function weekOf(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function storedPools(): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith('prt.drill-pools.'))
      .map((key) => [
        key.slice('prt.drill-pools.'.length),
        JSON.parse(sessionStorage.getItem(key)!),
      ]),
  )
}

describe('ProgressView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    clearDrillPoolCache()
    progress.mockResolvedValue({ data: fullProgress })
    list.mockResolvedValue(library())
  })

  afterEach(cleanup)

  it('reports the overview, both charts, and the library cut', async () => {
    render(<ProgressView />)

    expect(await screen.findByText('5 days')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByLabelText(`${weekday('2026-09-03')}: 12 hands`)).toBeInTheDocument()
    expect(screen.getByLabelText(`${weekday('2026-09-02')}: 8 hands`)).toBeInTheDocument()
    expect(
      screen.getByLabelText(`Week of ${weekOf('2026-08-24')}: 70% over 20 hands`),
    ).toBeInTheDocument()
    expect(
      screen.getByText('2 ranges practiced · 90 of 120 correct · 75% overall'),
    ).toBeInTheDocument()
  })

  it('names the miss direction, its seats, and the hand types behind it', async () => {
    render(<ProgressView />)

    expect(
      await screen.findByText('You lean loose: most of your misses play a hand the chart folds.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '8 of 10 misses played a hand the chart folds' }),
    ).toBeInTheDocument()
    expect(screen.getByText('8 played too many · 2 folded too many')).toBeInTheDocument()
    expect(screen.getByText('plays too many hands (7 of 8 misses)')).toHaveTextContent(
      'BTN plays too many hands (7 of 8 misses)',
    )
    expect(screen.getByText('Suited gappers')).toBeInTheDocument()
    expect(screen.getByText('4/10 · 40% · K8s, J7s, 96s, 85s…')).toBeInTheDocument()
  })

  it('resolves weak-hand ranges by name and falls back for records that outlived one', async () => {
    render(<ProgressView />)

    expect(await screen.findAllByText('BTN open')).toHaveLength(2)
    expect(screen.getByText('Deleted range')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ pageSize: 100, archived: 'include' })
  })

  it('drills a leak, a seat lean, and the weakest hands from their own pools', async () => {
    const user = userEvent.setup()
    render(<ProgressView />)

    await user.click(await screen.findByRole('button', { name: 'Drill Suited gappers' }))
    let [key] = Object.keys(storedPools())
    expect(storedPools()[key!]).toEqual(leakPools)
    expect(navigate).toHaveBeenLastCalledWith(
      `/app/practice?queue=${btn}&mode=recognition&pools=${key}`,
    )

    window.sessionStorage.clear()
    await user.click(
      screen.getByRole('button', { name: 'Drill the hands you play too often from BTN' }),
    )
    ;[key] = Object.keys(storedPools())
    expect(storedPools()[key!]).toEqual(seatPools)

    window.sessionStorage.clear()
    await user.click(screen.getByRole('button', { name: 'Drill weakest hands' }))
    ;[key] = Object.keys(storedPools())
    // Grouped by range, and the record whose range is gone cannot be drilled.
    expect(storedPools()[key!]).toEqual({ [btn]: ['K8s', 'J7s'] })
    expect(navigate).toHaveBeenLastCalledWith(
      `/app/practice?queue=${btn}&mode=recognition&pools=${key}`,
    )
  })

  it('explains every empty report rather than drawing a row of zeros', async () => {
    progress.mockResolvedValue({ data: emptyProgress })
    render(<ProgressView />)

    expect(
      await screen.findByText('Answer some hands and this week’s practice will show up here.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Practice over a couple of weeks and your accuracy trend will show up here.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Practice any range and how your library is going will show up here.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Practice a little more and which way you miss will show up here.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Practice a little more and the hand types you miss most will show up here.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('No recorded misses yet — they will show up here.')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
    // Nothing weak to name means nothing to look a name up for.
    expect(list).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows a loading state, then a retryable failure', async () => {
    let resolveProgress: (value: { data: ProgressReadModel }) => void
    progress.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProgress = resolve
      }),
    )
    const { unmount } = render(<ProgressView />)
    expect(screen.getByText('Loading your progress…')).toBeInTheDocument()
    resolveProgress!({ data: fullProgress })
    await screen.findByText('5 days')
    unmount()

    progress
      .mockRejectedValueOnce(new ApiClientError('network', 'We could not reach the server.'))
      .mockResolvedValueOnce({ data: fullProgress })
    render(<ProgressView />)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('5 days')).toBeInTheDocument()
  })
})
