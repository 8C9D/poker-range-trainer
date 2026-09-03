import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import {
  progressReadModelSchema,
  todayReadModelSchema,
  type RangePracticeRead,
} from '@poker-range-trainer/contracts'
import type { PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'
import type {
  HandAccuracyStat,
  PracticeSessionRecord,
  RangeHandAccuracy,
  RangeReviewState,
} from '@poker-range-trainer/domain/types/practice'
import type { SavedRange } from '@poker-range-trainer/domain/types/range'

import { PracticeRangeNotFoundError } from './repository.js'
import type { LibrarySnapshot, PracticeRepository } from './service.js'
import { PracticeService } from './service.js'

describe('PracticeService', () => {
  it('keeps authenticated owner identity explicit at the application boundary', async () => {
    const response = {
      data: {
        session: {
          id: randomUUID(),
          rangeId: randomUUID(),
          mode: 'build' as const,
          totalQuestions: 1,
          correctAnswers: 1,
          accuracyPercentage: 100,
          completedAt: '2026-01-02T03:04:05.000Z',
        },
        stats: {
          rangeId: randomUUID(),
          totalAttempts: 1,
          correctAttempts: 1,
          accuracyPercentage: 100,
          lastPracticedAt: '2026-01-02T03:04:05.000Z',
        },
        review: {
          rangeId: randomUUID(),
          ease: 2.6,
          intervalDays: 1,
          dueAt: '2026-01-03T03:04:05.000Z',
          lastReviewedAt: '2026-01-02T03:04:05.000Z',
        },
      },
    }
    const repository = { submit: vi.fn(async () => response) } as unknown as PracticeRepository
    const service = new PracticeService(repository)
    const userId = randomUUID()
    const submission = {
      mode: 'build' as const,
      rangeId: randomUUID(),
      idempotencyKey: randomUUID(),
      selectedHands: ['AA'],
    }
    await expect(service.submit(userId, submission)).resolves.toEqual(response)
    expect(repository.submit).toHaveBeenCalledWith(userId, submission)
  })
})

/**
 * Today and Progress are projections of one library snapshot, so the fixture is
 * one library: three active ranges (one due yesterday, one due tomorrow, one
 * never reviewed) and an archived fourth, four sessions across three days, and
 * per-hand records that lean loose. The service reads a fixed clock, so every
 * expectation below is a number and not a range.
 */
const NOW = '2026-07-11T13:00:00.000Z'
const OWNER = randomUUID()
const ids = {
  alpha: randomUUID(),
  beta: randomUUID(),
  gamma: randomUUID(),
  delta: randomUUID(),
}

function range(id: string, name: string, extra: Partial<SavedRange> = {}): SavedRange {
  return {
    id,
    name,
    hands: ['AA', 'AKo'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: NOW,
    archived: false,
    favorite: false,
    ...extra,
  }
}

function session(
  rangeId: string,
  playedAt: string,
  totalQuestions: number,
  correctAnswers: number,
): PracticeSessionRecord {
  return { rangeId, playedAt, totalQuestions, correctAnswers }
}

function handRecord(
  hand: PokerHand,
  attempts: number,
  correct: number,
  falsePositives: number,
  falseNegatives: number,
): HandAccuracyStat {
  return { hand, attempts, correct, falsePositives, falseNegatives }
}

function handAccuracyOf(...stats: HandAccuracyStat[]): RangeHandAccuracy {
  return Object.fromEntries(stats.map((stat) => [stat.hand, stat])) as RangeHandAccuracy
}

function reviewState(rangeId: string, dueAt: string, lastReviewedAt: string): RangeReviewState {
  return { rangeId, ease: 2.5, intervalDays: 1, dueAt, lastReviewedAt }
}

function librarySnapshot(overrides: Partial<LibrarySnapshot> = {}): LibrarySnapshot {
  return {
    ranges: [
      range(ids.alpha, 'BTN open', { metadata: { position: 'btn' } }),
      range(ids.beta, 'CO open'),
      range(ids.gamma, 'SB defend'),
      range(ids.delta, 'Old MTT chart', { archived: true }),
    ],
    sessions: {
      [ids.alpha]: [
        session(ids.alpha, '2026-07-09T12:00:00.000Z', 10, 5),
        session(ids.alpha, '2026-07-10T12:00:00.000Z', 10, 8),
        session(ids.alpha, '2026-07-11T11:00:00.000Z', 12, 9),
      ],
      [ids.beta]: [session(ids.beta, '2026-07-11T10:00:00.000Z', 5, 5)],
    },
    practiceStats: {
      [ids.alpha]: {
        rangeId: ids.alpha,
        totalAttempts: 32,
        correctAttempts: 22,
        lastPracticedAt: '2026-07-11T11:00:00.000Z',
      },
      [ids.beta]: {
        rangeId: ids.beta,
        totalAttempts: 5,
        correctAttempts: 5,
        lastPracticedAt: '2026-07-11T10:00:00.000Z',
      },
    },
    handAccuracy: {
      // Five hands played that the chart folds against one folded that it plays.
      [ids.alpha]: handAccuracyOf(handRecord('AA', 6, 1, 5, 0), handRecord('AKo', 4, 2, 1, 1)),
      [ids.beta]: handAccuracyOf(handRecord('QQ', 3, 3, 0, 0)),
    },
    reviewStates: {
      [ids.alpha]: reviewState(
        ids.alpha,
        '2026-07-10T12:00:00.000Z',
        '2026-07-09T12:00:00.000Z',
      ),
      [ids.beta]: reviewState(ids.beta, '2026-07-12T10:00:00.000Z', '2026-07-11T10:00:00.000Z'),
    },
    trainingGoal: 20,
    ...overrides,
  }
}

const EMPTY_LIBRARY: LibrarySnapshot = {
  ranges: [],
  sessions: {},
  practiceStats: {},
  handAccuracy: {},
  reviewStates: {},
  trainingGoal: null,
}

/** Nothing due: every active range is scheduled for a later day. */
const CAUGHT_UP_REVIEWS: Record<string, RangeReviewState> = {
  [ids.alpha]: reviewState(ids.alpha, '2026-07-13T12:00:00.000Z', '2026-07-10T12:00:00.000Z'),
  [ids.beta]: reviewState(ids.beta, '2026-07-14T12:00:00.000Z', '2026-07-11T10:00:00.000Z'),
  [ids.gamma]: reviewState(ids.gamma, '2026-07-15T12:00:00.000Z', '2026-07-08T12:00:00.000Z'),
}

function serviceFor(snapshot: LibrarySnapshot, read?: RangePracticeRead) {
  const repository: PracticeRepository = {
    submit: vi.fn(),
    readRangePractice: vi.fn(async () => read),
    readLibrarySnapshot: vi.fn(async () => snapshot),
  } as unknown as PracticeRepository
  return { repository, service: new PracticeService(repository, { now: () => new Date(NOW) }) }
}

describe('PracticeService.today', () => {
  it('projects the streak, goal, week and review queue of one library', async () => {
    const { repository, service } = serviceFor(librarySnapshot())

    const today = await service.today(OWNER, 'UTC')

    expect(repository.readLibrarySnapshot).toHaveBeenCalledWith(OWNER)
    expect(todayReadModelSchema.safeParse(today).success).toBe(true)
    expect(today.generatedAt).toBe(NOW)
    expect(today.streakDays).toBe(3)
    expect(today.dailyGoal).toEqual({ target: 20, handsAnswered: 17, remainingHands: 3 })
    expect(today.trailingSevenDays).toEqual({
      handsAnswered: 37,
      correctAnswers: 27,
      accuracyPercentage: (27 / 37) * 100,
      // The sharpest range reports its own counters inside those totals.
      sharpestRange: {
        id: ids.beta,
        name: 'CO open',
        handsAnswered: 5,
        correctAnswers: 5,
        accuracyPercentage: 100,
      },
    })
    // Due yesterday and never reviewed; the archived chart and tomorrow's are out.
    expect(today.dueRanges).toEqual([
      {
        id: ids.alpha,
        name: 'BTN open',
        dueAt: '2026-07-10T12:00:00.000Z',
        accuracyPercentage: (22 / 32) * 100,
        lastPracticedAt: '2026-07-11T11:00:00.000Z',
      },
      {
        id: ids.gamma,
        name: 'SB defend',
        dueAt: null,
        accuracyPercentage: null,
        lastPracticedAt: null,
      },
    ])
    expect(today.caughtUp).toBe(false)
    expect(today.freePractice).toBeNull()
  })

  it('offers the weakest hands once the review queue is empty', async () => {
    const { service } = serviceFor(librarySnapshot({ reviewStates: CAUGHT_UP_REVIEWS }))

    const today = await service.today(OWNER, 'UTC')

    expect(todayReadModelSchema.safeParse(today).success).toBe(true)
    expect(today.dueRanges).toEqual([])
    expect(today.caughtUp).toBe(true)
    expect(today.freePractice).toEqual({
      kind: 'weakHands',
      rangeIds: [ids.alpha],
      pools: { [ids.alpha]: ['AA', 'AKo'] },
      handCount: 2,
    })
  })

  it('offers the next review early when there are no recorded mistakes', async () => {
    const { service } = serviceFor(
      librarySnapshot({
        reviewStates: CAUGHT_UP_REVIEWS,
        handAccuracy: { [ids.beta]: handAccuracyOf(handRecord('QQ', 3, 3, 0, 0)) },
      }),
    )

    const today = await service.today(OWNER, 'UTC')

    expect(todayReadModelSchema.safeParse(today).success).toBe(true)
    expect(today.freePractice).toEqual({
      kind: 'reviewEarly',
      rangeId: ids.alpha,
      dueAt: '2026-07-13T12:00:00.000Z',
    })
  })

  it('has nothing to suggest for an empty library', async () => {
    const { service } = serviceFor(EMPTY_LIBRARY)

    const today = await service.today(OWNER, 'UTC')

    expect(todayReadModelSchema.safeParse(today).success).toBe(true)
    expect(today).toMatchObject({
      streakDays: 0,
      dailyGoal: { target: null, handsAnswered: 0, remainingHands: 0 },
      trailingSevenDays: { handsAnswered: 0, sharpestRange: null },
      dueRanges: [],
      caughtUp: true,
      freePractice: null,
    })
  })

  it('counts today in the caller time zone', async () => {
    const { service } = serviceFor(librarySnapshot())

    // 13:00Z is already 01:00 on the 12th in Auckland, so both of the sessions
    // answered late on the 11th UTC belong to the day before.
    const inAuckland = await service.today(OWNER, 'Pacific/Auckland')
    const inLosAngeles = await service.today(OWNER, 'America/Los_Angeles')

    expect(inAuckland.dailyGoal).toEqual({ target: 20, handsAnswered: 0, remainingHands: 20 })
    expect(inLosAngeles.dailyGoal).toEqual({ target: 20, handsAnswered: 17, remainingHands: 3 })
  })
})

describe('PracticeService.progress', () => {
  it('projects every preserved analytic from one library', async () => {
    const { service } = serviceFor(librarySnapshot())

    const progress = await service.progress(OWNER, 'UTC')

    expect(progressReadModelSchema.safeParse(progress).success).toBe(true)
    expect(progress.generatedAt).toBe(NOW)
    expect(progress.streakDays).toBe(3)
    expect(progress.allTime).toEqual({
      rangesPracticed: 2,
      handsAnswered: 37,
      correctAnswers: 27,
      accuracyPercentage: (27 / 37) * 100,
    })
    expect(progress.trailingThirtyDays).toEqual({
      handsAnswered: 37,
      correctAnswers: 27,
      accuracyPercentage: (27 / 37) * 100,
    })
    expect(progress.dailyActivity).toEqual([
      { day: '2026-07-05', handsAnswered: 0 },
      { day: '2026-07-06', handsAnswered: 0 },
      { day: '2026-07-07', handsAnswered: 0 },
      { day: '2026-07-08', handsAnswered: 0 },
      { day: '2026-07-09', handsAnswered: 10 },
      { day: '2026-07-10', handsAnswered: 10 },
      { day: '2026-07-11', handsAnswered: 17 },
    ])
    expect(progress.weeklyAccuracyTrend).toHaveLength(8)
    expect(progress.weeklyAccuracyTrend.at(-1)).toEqual({
      weekStart: '2026-07-05',
      handsAnswered: 37,
      correctAnswers: 27,
      accuracyPercentage: (27 / 37) * 100,
    })
    expect(progress.handClassLeaks).toEqual([
      {
        handClass: 'premiumPair',
        attempts: 9,
        correct: 4,
        accuracyPercentage: (4 / 9) * 100,
        missedHands: ['AA'],
        pools: { [ids.alpha]: ['AA'] },
      },
      {
        handClass: 'offsuitAce',
        attempts: 4,
        correct: 2,
        accuracyPercentage: 50,
        missedHands: ['AKo'],
        pools: { [ids.alpha]: ['AKo'] },
      },
    ])
    expect(progress.mistakeBias).toEqual({
      loose: 6,
      tight: 1,
      mistakes: 7,
      loosePercentage: (6 / 7) * 100,
      bias: 'loose',
    })
    expect(progress.positionLeans).toEqual([
      {
        position: 'btn',
        summary: progress.mistakeBias,
        pools: { [ids.alpha]: ['AA', 'AKo'] },
      },
    ])
    expect(progress.weakestHands).toEqual([
      { rangeId: ids.alpha, hand: 'AA', attempts: 6, correct: 1, accuracyPercentage: (1 / 6) * 100 },
      { rangeId: ids.alpha, hand: 'AKo', attempts: 4, correct: 2, accuracyPercentage: 50 },
    ])
  })

  it('charts the same sessions against the days the caller is living', async () => {
    const { service } = serviceFor(librarySnapshot())

    const inAuckland = await service.progress(OWNER, 'Pacific/Auckland')
    const inLosAngeles = await service.progress(OWNER, 'America/Los_Angeles')

    expect(progressReadModelSchema.safeParse(inAuckland).success).toBe(true)
    expect(progressReadModelSchema.safeParse(inLosAngeles).success).toBe(true)
    expect(inAuckland.dailyActivity.at(-1)).toEqual({ day: '2026-07-12', handsAnswered: 0 })
    expect(inAuckland.dailyActivity.at(-2)).toEqual({ day: '2026-07-11', handsAnswered: 27 })
    expect(inLosAngeles.dailyActivity.at(-1)).toEqual({ day: '2026-07-11', handsAnswered: 17 })
    // The totals do not move with the zone; only which day they fall on does.
    expect(inAuckland.allTime).toEqual(inLosAngeles.allTime)
  })

  it('reports zeros rather than gaps for an empty library', async () => {
    const { service } = serviceFor(EMPTY_LIBRARY)

    const progress = await service.progress(OWNER, 'UTC')

    expect(progressReadModelSchema.safeParse(progress).success).toBe(true)
    expect(progress).toMatchObject({
      allTime: { rangesPracticed: 0, handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
      handClassLeaks: [],
      positionLeans: [],
      weakestHands: [],
      mistakeBias: { mistakes: 0, bias: 'unknown' },
    })
    expect(progress.dailyActivity).toHaveLength(7)
  })
})

describe('PracticeService.readRange', () => {
  const read: RangePracticeRead = {
    rangeId: ids.alpha,
    stats: {
      rangeId: ids.alpha,
      totalAttempts: 32,
      correctAttempts: 22,
      accuracyPercentage: (22 / 32) * 100,
      lastPracticedAt: '2026-07-11T11:00:00.000Z',
    },
    review: {
      rangeId: ids.alpha,
      ease: 2.5,
      intervalDays: 1,
      dueAt: '2026-07-10T12:00:00.000Z',
      lastReviewedAt: '2026-07-09T12:00:00.000Z',
    },
    handAccuracy: [handRecord('AA', 6, 1, 5, 0)],
    recentSessions: [],
  }

  it('returns the owner-scoped read through its contract', async () => {
    const { repository, service } = serviceFor(EMPTY_LIBRARY, read)

    await expect(service.readRange(OWNER, ids.alpha)).resolves.toEqual(read)
    expect(repository.readRangePractice).toHaveBeenCalledWith(OWNER, ids.alpha)
  })

  it('reports a missing range as not found rather than as an empty read', async () => {
    const { service } = serviceFor(EMPTY_LIBRARY)

    await expect(service.readRange(OWNER, ids.alpha)).rejects.toBeInstanceOf(
      PracticeRangeNotFoundError,
    )
  })
})
