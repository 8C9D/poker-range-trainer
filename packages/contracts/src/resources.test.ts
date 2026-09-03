import { describe, expect, it } from 'vitest'

import {
  practiceSessionSubmissionResponseSchema,
  practiceSessionSubmissionSchema,
  bulkRangeMutationRequestSchema,
  bulkRangeMutationResponseSchema,
  MAX_DAILY_HANDS_GOAL,
  progressResponseSchema,
  rangeArchiveRequestSchema,
  rangeCreateRequestSchema,
  rangeDeleteRequestSchema,
  rangeDeleteResponseSchema,
  rangeDuplicateRequestSchema,
  rangeDuplicateResponseSchema,
  rangeFavoriteRequestSchema,
  rangeListQuerySchema,
  rangeListResponseSchema,
  rangePracticeReadResponseSchema,
  rangeReadSchema,
  rangeRestoreRequestSchema,
  rangeRestoreResponseSchema,
  rangeUpdateRequestSchema,
  progressQuerySchema,
  resetPracticeStatsRequestSchema,
  todayResponseSchema,
  todayQuerySchema,
  trainingGoalResponseSchema,
  trainingGoalUpdateRequestSchema,
} from './index.js'

const ids = {
  range: '0af80ebe-4171-4a9f-8847-3d483ea0e2e7',
  rangeTwo: '83ef8616-c1d3-4fb1-8c3f-f6917fc917b0',
  questionOne: '5db753c6-80c5-407f-9f30-c99445813303',
  questionTwo: 'e0b1f46f-4100-461f-8e50-f3c16761e49d',
  session: '61c737c6-133f-4f5e-bb5f-7b48e55c172e',
  request: '3e52b6b4-b9f5-49f0-8730-4a6060b804c0',
}
const timestamp = '2026-09-02T12:00:00.000Z'

const readableRange = {
  id: ids.range,
  version: 2,
  name: 'BTN open 100bb',
  hands: ['AA', 'AKs', 'AKo'],
  metadata: {
    gameType: 'cash',
    tableSize: 'sixMax',
    position: 'btn',
    actionType: 'open',
    stackDepthBb: 100,
  },
  displayOrder: 0,
  archived: false,
  favorite: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
}

const listedRange = {
  id: ids.range,
  version: 2,
  name: 'BTN open 100bb',
  metadata: readableRange.metadata,
  displayOrder: 0,
  handCount: 3,
  comboCount: 22,
  rangePercentage: (22 / 1326) * 100,
  archived: false,
  favorite: true,
  updatedAt: timestamp,
  deletedAt: null,
}

describe('range resource contracts', () => {
  it('accepts bounded create requests using canonical scenario vocabularies', () => {
    expect(
      rangeCreateRequestSchema.parse({
        name: '  BTN open 100bb ',
        hands: ['AA', 'AKs', 'AKo'],
        metadata: readableRange.metadata,
      }),
    ).toMatchObject({ name: 'BTN open 100bb', hands: readableRange.hands })
  })

  it('rejects duplicate hands, archived feature surfaces, and over-posting', () => {
    expect(
      rangeCreateRequestSchema.safeParse({ name: 'Duplicate', hands: ['AA', 'AA'] }).success,
    ).toBe(false)
    expect(
      rangeCreateRequestSchema.safeParse({
        name: 'Bad metadata',
        hands: ['AA'],
        metadata: { position: 'dealer' },
      }).success,
    ).toBe(false)
    expect(
      rangeCreateRequestSchema.safeParse({ name: 'Empty metadata', hands: ['AA'], metadata: {} })
        .success,
    ).toBe(false)
    expect(
      rangeCreateRequestSchema.safeParse({ name: 'Archived source', hands: ['AA'], source: {} })
        .success,
    ).toBe(false)
    expect(
      rangeCreateRequestSchema.safeParse({ name: 'Archived tags', hands: ['AA'], tags: ['Cash'] })
        .success,
    ).toBe(false)
    expect(
      rangeCreateRequestSchema.safeParse({ name: 'Over-posted', hands: ['AA'], archived: true }).success,
    ).toBe(false)
  })

  it('requires a version and a real field for optimistic updates', () => {
    expect(rangeUpdateRequestSchema.safeParse({ version: 2 }).success).toBe(false)
    expect(rangeUpdateRequestSchema.safeParse({ name: 'Rename only' }).success).toBe(false)
    expect(rangeUpdateRequestSchema.parse({ version: 2, metadata: null })).toEqual({
      version: 2,
      metadata: null,
    })
    expect(rangeUpdateRequestSchema.safeParse({ version: 2, tags: [] }).success).toBe(false)
  })

  it('keeps list filters, summaries, sort, and pagination bounded', () => {
    expect(rangeListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sort: 'displayOrder',
      direction: 'asc',
    })
    expect(
      rangeListQuerySchema.parse({
        page: '2',
        pageSize: '25',
        favorite: 'true',
        archived: 'include',
        sort: 'accuracy',
        direction: 'asc',
        position: 'btn',
        stackDepthBb: '12.5',
      }),
    ).toMatchObject({
      page: 2,
      pageSize: 25,
      favorite: true,
      position: 'btn',
      stackDepthBb: 12.5,
    })
    expect(rangeListQuerySchema.safeParse({ pageSize: 101, sort: 'unknown' }).success).toBe(false)
    expect(rangeListQuerySchema.safeParse({ stackDepthBb: '12.345' }).success).toBe(false)
    expect(rangeListQuerySchema.safeParse({ tag: 'Cash' }).success).toBe(false)
    expect(
      rangeListResponseSchema.parse({
        data: [listedRange],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }),
    ).toMatchObject({ data: [{ displayOrder: 0, handCount: 3, comboCount: 22 }] })
    expect(rangeListResponseSchema.safeParse({
      data: [{ ...listedRange, hands: readableRange.hands }],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }).success).toBe(false)
    expect(rangeListResponseSchema.safeParse({
      data: [{ ...listedRange, rangePercentage: 0 }],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }).success).toBe(false)
    expect(rangeListResponseSchema.safeParse({
      data: [],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 0 },
    }).success).toBe(false)
  })

  it('models archive/delete outcomes as versioned strict responses', () => {
    expect(rangeArchiveRequestSchema.parse({ version: 2, archived: true })).toEqual({
      version: 2,
      archived: true,
    })
    expect(rangeReadSchema.parse(readableRange)).toEqual(readableRange)
    expect(rangeFavoriteRequestSchema.parse({ version: 2, favorite: false })).toEqual({
      version: 2,
      favorite: false,
    })
    expect(rangeDeleteRequestSchema.parse({ version: 2 })).toEqual({ version: 2 })
    expect(rangeRestoreRequestSchema.parse({ version: 3 })).toEqual({ version: 3 })
    expect(rangeRestoreResponseSchema.parse({ data: readableRange })).toEqual({ data: readableRange })
    expect(
      rangeDeleteResponseSchema.parse({
        data: { id: ids.range, version: 3, deletedAt: timestamp },
      }),
    ).toMatchObject({ data: { version: 3 } })
    expect(rangeReadSchema.safeParse({ ...readableRange, userId: ids.request }).success).toBe(false)
  })

  it('duplicates a range server-side and validates atomic bulk mutations', () => {
    expect(rangeDuplicateRequestSchema.parse({ version: 2, name: 'BTN copy' })).toEqual({
      version: 2,
      name: 'BTN copy',
    })
    expect(rangeDuplicateRequestSchema.safeParse({ version: 2, hands: ['AA'] }).success).toBe(false)
    expect(rangeDuplicateResponseSchema.parse({ data: readableRange })).toEqual({ data: readableRange })

    const items = [
      { id: ids.range, version: 2 },
      { id: ids.rangeTwo, version: 5 },
    ]
    expect(bulkRangeMutationRequestSchema.parse({ action: 'archive', items })).toEqual({
      action: 'archive',
      items,
    })
    for (const action of ['unarchive', 'favorite', 'unfavorite', 'delete', 'restore'] as const) {
      expect(bulkRangeMutationRequestSchema.parse({ action, items })).toMatchObject({ action, items })
    }
    expect(bulkRangeMutationRequestSchema.safeParse({
      action: 'archive',
      items: [items[0], items[0]],
    }).success).toBe(false)
    expect(bulkRangeMutationRequestSchema.safeParse({
      action: 'archive',
      items: Array.from({ length: 101 }, () => items[0]),
    }).success).toBe(false)
    expect(bulkRangeMutationRequestSchema.safeParse({ action: 'archive', items, extra: true }).success).toBe(false)
    expect(bulkRangeMutationResponseSchema.parse({
      data: { action: 'archive', atomic: true, items: [listedRange] },
    })).toMatchObject({ data: { atomic: true, items: [{ id: ids.range }] } })
    expect(bulkRangeMutationResponseSchema.parse({
      data: { action: 'delete', atomic: true, items: [{ id: ids.range, version: 3, deletedAt: timestamp }] },
    })).toMatchObject({ data: { action: 'delete', atomic: true } })
    for (const action of ['unarchive', 'favorite', 'unfavorite', 'restore'] as const) {
      expect(bulkRangeMutationResponseSchema.parse({
        data: { action, atomic: true, items: [listedRange] },
      })).toMatchObject({ data: { action, atomic: true } })
    }
    expect(bulkRangeMutationResponseSchema.safeParse({
      data: { action: 'delete', atomic: false, items: [{ id: ids.range, version: 3, deletedAt: timestamp }] },
    }).success).toBe(false)
  })
})

describe('practice submission contracts', () => {
  const answer = {
    questionId: ids.questionOne,
    hand: 'AA',
    answer: true,
    answeredAt: timestamp,
  }

  it.each(['recognition', 'timed', 'weakness', 'edges', 'mistakes'] as const)(
    'accepts only user answers for %s sessions',
    (mode) => {
      expect(
        practiceSessionSubmissionSchema.parse({
          mode,
          rangeId: ids.range,
          idempotencyKey: ids.request,
          answers: [answer],
        }),
      ).toMatchObject({ mode, answers: [answer] })
    },
  )

  it('keeps the answer trust boundary while allowing a hand to recur across questions', () => {
    expect(
      practiceSessionSubmissionSchema.parse({
        mode: 'recognition',
        rangeId: ids.range,
        idempotencyKey: ids.request,
        answers: [answer, { ...answer, questionId: ids.questionTwo }],
      }),
    ).toMatchObject({ answers: [answer, { ...answer, questionId: ids.questionTwo }] })
    expect(practiceSessionSubmissionSchema.safeParse({
      mode: 'recognition',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      answers: [answer, answer],
    }).success).toBe(false)
    expect(practiceSessionSubmissionSchema.safeParse({
      mode: 'recognition',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      answers: [{ ...answer, expectedInRange: true, correct: true }],
    }).success).toBe(false)
    expect(practiceSessionSubmissionSchema.safeParse({
      mode: 'edge',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      answers: [answer],
    }).success).toBe(false)
  })

  it('accepts non-empty build selections but rejects duplicates and blank reveals', () => {
    expect(practiceSessionSubmissionSchema.parse({
      mode: 'build',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      selectedHands: ['AA', 'AKs'],
    })).toMatchObject({ mode: 'build' })
    expect(practiceSessionSubmissionSchema.safeParse({
      mode: 'build',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      selectedHands: ['AA', 'AA'],
    }).success).toBe(false)
    expect(practiceSessionSubmissionSchema.safeParse({
      mode: 'build',
      rangeId: ids.range,
      idempotencyKey: ids.request,
      selectedHands: [],
    }).success).toBe(false)
  })

  it('returns only API-computed aggregate results and rejects invalid counters', () => {
    const response = {
      data: {
        session: {
          id: ids.session,
          rangeId: ids.range,
          mode: 'recognition',
          completedAt: timestamp,
          totalQuestions: 10,
          correctAnswers: 8,
          accuracyPercentage: 80,
        },
        stats: {
          rangeId: ids.range,
          totalAttempts: 30,
          correctAttempts: 21,
          accuracyPercentage: 70,
          lastPracticedAt: timestamp,
        },
        review: {
          rangeId: ids.range,
          ease: 2.5,
          intervalDays: 3,
          dueAt: timestamp,
          lastReviewedAt: timestamp,
        },
      },
    }

    expect(practiceSessionSubmissionResponseSchema.parse(response)).toEqual(response)
    expect(practiceSessionSubmissionResponseSchema.safeParse({
      ...response,
      data: { ...response.data, session: { ...response.data.session, correctAnswers: 11 } },
    }).success).toBe(false)
    expect(practiceSessionSubmissionResponseSchema.safeParse({
      ...response,
      data: { ...response.data, stats: { ...response.data.stats, accuracyPercentage: 0 } },
    }).success).toBe(false)
    expect(practiceSessionSubmissionResponseSchema.safeParse({
      ...response,
      data: { ...response.data, session: { ...response.data.session, expectedInRange: true } },
    }).success).toBe(false)
    expect(practiceSessionSubmissionResponseSchema.parse({
      ...response,
      data: { ...response.data, review: { ...response.data.review, ease: 1.3 } },
    })).toMatchObject({ data: { review: { ease: 1.3 } } })
    expect(practiceSessionSubmissionResponseSchema.safeParse({
      ...response,
      data: { ...response.data, review: { ...response.data.review, ease: 1.29 } },
    }).success).toBe(false)
  })
})

describe('settings and read-model contracts', () => {
  const bias = {
    loose: 4,
    tight: 2,
    mistakes: 6,
    loosePercentage: (4 / 6) * 100,
    bias: 'loose' as const,
  }
  const progress = {
    data: {
      generatedAt: timestamp,
      streakDays: 4,
      allTime: { rangesPracticed: 1, handsAnswered: 30, correctAnswers: 21, accuracyPercentage: 70 },
      trailingThirtyDays: { handsAnswered: 24, correctAnswers: 18, accuracyPercentage: 75 },
      dailyActivity: [{ day: '2026-09-02', handsAnswered: 12 }],
      weeklyAccuracyTrend: [
        { weekStart: '2026-09-01', handsAnswered: 30, correctAnswers: 21, accuracyPercentage: 70 },
      ],
      handClassLeaks: [{
        handClass: 'premiumPair' as const,
        attempts: 4,
        correct: 2,
        accuracyPercentage: 50,
        missedHands: ['AA'],
        pools: { [ids.range]: ['AA'] },
      }],
      mistakeBias: bias,
      positionLeans: [{ position: 'btn' as const, summary: bias, pools: { [ids.range]: ['AA'] } }],
      weakestHands: [
        { rangeId: ids.range, hand: 'AKo', attempts: 4, correct: 2, accuracyPercentage: 50 },
      ],
    },
  }

  it('preserves arbitrary bounded positive training goals and an explicit stats reset', () => {
    expect(
      trainingGoalResponseSchema.parse({ data: { dailyHandsGoal: 50, updatedAt: timestamp } }),
    ).toEqual({ data: { dailyHandsGoal: 50, updatedAt: timestamp } })
    expect(trainingGoalUpdateRequestSchema.parse({ dailyHandsGoal: 50 })).toEqual({ dailyHandsGoal: 50 })
    expect(trainingGoalUpdateRequestSchema.parse({ dailyHandsGoal: 1 })).toEqual({ dailyHandsGoal: 1 })
    expect(trainingGoalUpdateRequestSchema.parse({ dailyHandsGoal: MAX_DAILY_HANDS_GOAL })).toEqual({
      dailyHandsGoal: MAX_DAILY_HANDS_GOAL,
    })
    expect(trainingGoalUpdateRequestSchema.parse({ dailyHandsGoal: null })).toEqual({ dailyHandsGoal: null })
    for (const dailyHandsGoal of [0, -1, 20.5, MAX_DAILY_HANDS_GOAL + 1]) {
      expect(trainingGoalUpdateRequestSchema.safeParse({ dailyHandsGoal }).success).toBe(false)
    }
    expect(
      trainingGoalResponseSchema.safeParse({ data: { dailyHandsGoal: null, updatedAt: timestamp } }).success,
    ).toBe(false)
    expect(resetPracticeStatsRequestSchema.safeParse({ confirm: false }).success).toBe(false)
  })

  it('returns Today with derived goal and caught-up state', () => {
    expect(todayQuerySchema.parse({ timeZone: 'America/Toronto' })).toEqual({
      timeZone: 'America/Toronto',
    })
    expect(progressQuerySchema.parse({ timeZone: 'UTC' })).toEqual({ timeZone: 'UTC' })
    expect(todayQuerySchema.safeParse({ timeZone: '' }).success).toBe(false)
    expect(progressQuerySchema.safeParse({ timeZone: 'UTC', unknown: true }).success).toBe(false)
    expect(todayResponseSchema.parse({
      data: {
        generatedAt: timestamp,
        streakDays: 4,
        dailyGoal: { target: 20, handsAnswered: 12, remainingHands: 8 },
        trailingSevenDays: {
          handsAnswered: 30,
          correctAnswers: 21,
          accuracyPercentage: 70,
          sharpestRange: {
            id: ids.range,
            name: 'BTN open 100bb',
            handsAnswered: 12,
            correctAnswers: 10,
            accuracyPercentage: (10 / 12) * 100,
          },
        },
        dueRanges: [{
          id: ids.range,
          name: 'BTN open 100bb',
          dueAt: timestamp,
          accuracyPercentage: null,
          lastPracticedAt: null,
        }],
        caughtUp: false,
        freePractice: null,
      },
    })).toMatchObject({ data: { streakDays: 4 } })

    const caughtUpToday = {
      data: {
        generatedAt: timestamp,
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
        freePractice: {
          kind: 'weakHands' as const,
          rangeIds: [ids.range, ids.rangeTwo],
          pools: { [ids.range]: ['AA'], [ids.rangeTwo]: ['AKs'] },
          handCount: 2,
        },
      },
    }
    expect(todayResponseSchema.parse(caughtUpToday)).toMatchObject({
      data: { freePractice: { kind: 'weakHands', handCount: 2 } },
    })
    expect(todayResponseSchema.parse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: { kind: 'reviewEarly', rangeId: ids.range, dueAt: '2026-09-03T12:00:00.000Z' },
      },
    })).toMatchObject({ data: { freePractice: { kind: 'reviewEarly' } } })
    expect(todayResponseSchema.safeParse({
      data: {
        generatedAt: timestamp,
        streakDays: 4,
        dailyGoal: { target: null, handsAnswered: 12, remainingHands: 8 },
        trailingSevenDays: caughtUpToday.data.trailingSevenDays,
        dueRanges: [],
        caughtUp: true,
        freePractice: null,
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      data: {
        generatedAt: timestamp,
        streakDays: 4,
        dailyGoal: { target: 20, handsAnswered: 12, remainingHands: 8 },
        trailingSevenDays: caughtUpToday.data.trailingSevenDays,
        dueRanges: [],
        caughtUp: false,
        freePractice: null,
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: {
          kind: 'weakHands',
          rangeIds: [ids.range, ids.range],
          pools: { [ids.range]: ['AA'] },
          handCount: 1,
        },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: {
          kind: 'weakHands',
          rangeIds: [ids.range],
          pools: { [ids.rangeTwo]: ['AA'] },
          handCount: 1,
        },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: {
          kind: 'weakHands',
          rangeIds: [ids.range],
          pools: { [ids.range]: ['AA'] },
          handCount: 2,
        },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        trailingSevenDays: {
          handsAnswered: 2,
          correctAnswers: 1,
          accuracyPercentage: 50,
          sharpestRange: {
            id: ids.range,
            name: 'BTN open 100bb',
            handsAnswered: 3,
            correctAnswers: 1,
            accuracyPercentage: (1 / 3) * 100,
          },
        },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        trailingSevenDays: {
          handsAnswered: 2,
          correctAnswers: 1,
          accuracyPercentage: 0,
          sharpestRange: null,
        },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      data: {
        ...caughtUpToday.data,
        dueRanges: [{
          id: ids.range,
          name: 'BTN open 100bb',
          dueAt: timestamp,
          accuracyPercentage: null,
          lastPracticedAt: null,
        }],
        caughtUp: false,
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: { kind: 'reviewEarly', rangeId: ids.range, dueAt: timestamp },
      },
    }).success).toBe(false)
    expect(todayResponseSchema.safeParse({
      ...caughtUpToday,
      data: {
        ...caughtUpToday.data,
        freePractice: { kind: 'reviewEarly', rangeId: ids.range, dueAt: 'tomorrow' },
      },
    }).success).toBe(false)
  })

  it('returns every preserved Progress analytic without exposing individual answers', () => {
    expect(progressResponseSchema.parse(progress)).toMatchObject({
      data: { allTime: { rangesPracticed: 1 }, handClassLeaks: [{ handClass: 'premiumPair' }] },
    })
    expect(progressResponseSchema.safeParse({
      ...progress,
      data: { ...progress.data, allTime: { ...progress.data.allTime, accuracyPercentage: 0 } },
    }).success).toBe(false)
    expect(progressResponseSchema.safeParse({
      ...progress,
      data: {
        ...progress.data,
        trailingThirtyDays: { handsAnswered: 12, correctAnswers: 8, accuracyPercentage: 0 },
      },
    }).success).toBe(false)
    expect(progressResponseSchema.safeParse({
      ...progress,
      data: {
        ...progress.data,
        dailyActivity: [{ day: timestamp, handsAnswered: 12 }],
      },
    }).success).toBe(false)
    expect(progressResponseSchema.safeParse({
      ...progress,
      data: {
        ...progress.data,
        handClassLeaks: [{ ...progress.data.handClassLeaks[0], pools: { [ids.range]: ['AKs'] } }],
      },
    }).success).toBe(false)
    expect(progressResponseSchema.safeParse({
      ...progress,
      data: { ...progress.data, attempt: { expectedInRange: true } },
    }).success).toBe(false)
    expect(progressResponseSchema.parse({
      data: {
        generatedAt: timestamp,
        streakDays: 0,
        allTime: { rangesPracticed: 0, handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
        trailingThirtyDays: { handsAnswered: 0, correctAnswers: 0, accuracyPercentage: 0 },
        dailyActivity: [],
        weeklyAccuracyTrend: [],
        handClassLeaks: [],
        mistakeBias: { loose: 0, tight: 0, mistakes: 0, loosePercentage: 0, bias: 'unknown' },
        positionLeans: [],
        weakestHands: [],
      },
    })).toMatchObject({ data: { streakDays: 0, trailingThirtyDays: { handsAnswered: 0 } } })
  })
})

describe('range practice read contract', () => {
  const read = {
    data: {
      rangeId: ids.range,
      stats: {
        rangeId: ids.range,
        totalAttempts: 30,
        correctAttempts: 21,
        accuracyPercentage: 70,
        lastPracticedAt: timestamp,
      },
      review: {
        rangeId: ids.range,
        ease: 2.5,
        intervalDays: 3,
        dueAt: timestamp,
        lastReviewedAt: timestamp,
      },
      handAccuracy: [
        { hand: 'AA', attempts: 4, correct: 3, falsePositives: 0, falseNegatives: 1 },
        { hand: 'AKs', attempts: 2, correct: 2, falsePositives: 0, falseNegatives: 0 },
      ],
      recentSessions: [
        {
          id: ids.session,
          rangeId: ids.range,
          mode: 'recognition',
          completedAt: timestamp,
          totalQuestions: 10,
          correctAnswers: 8,
          accuracyPercentage: 80,
        },
      ],
    },
  }

  it('reads a practiced range, and reports a never-practiced one as nulls', () => {
    expect(rangePracticeReadResponseSchema.parse(read)).toEqual(read)
    expect(
      rangePracticeReadResponseSchema.parse({
        data: {
          rangeId: ids.range,
          stats: null,
          review: null,
          handAccuracy: [],
          recentSessions: [],
        },
      }),
    ).toMatchObject({ data: { stats: null, review: null } })
  })

  it('rejects a repeated hand, a lost miss direction, and an unbounded session list', () => {
    expect(
      rangePracticeReadResponseSchema.safeParse({
        data: { ...read.data, handAccuracy: [read.data.handAccuracy[0], read.data.handAccuracy[0]] },
      }).success,
    ).toBe(false)
    expect(
      rangePracticeReadResponseSchema.safeParse({
        data: {
          ...read.data,
          handAccuracy: [{ hand: 'AA', attempts: 4, correct: 3, falsePositives: 0, falseNegatives: 0 }],
        },
      }).success,
    ).toBe(false)
    expect(
      rangePracticeReadResponseSchema.safeParse({
        data: {
          ...read.data,
          handAccuracy: [{ hand: 'AA', attempts: 2, correct: 3, falsePositives: 1, falseNegatives: 0 }],
        },
      }).success,
    ).toBe(false)
    expect(
      rangePracticeReadResponseSchema.safeParse({
        data: {
          ...read.data,
          recentSessions: Array.from({ length: 21 }, () => read.data.recentSessions[0]),
        },
      }).success,
    ).toBe(false)
    expect(
      rangePracticeReadResponseSchema.safeParse({ data: { ...read.data, attempts: [] } }).success,
    ).toBe(false)
  })
})
