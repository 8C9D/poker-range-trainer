import { describe, expect, it } from 'vitest'

import type { HandAccuracyStat } from '@poker-range-trainer/contracts'
import { ALL_HANDS } from '@poker-range-trainer/domain/domain/pokerHands'

import {
  DEFAULT_QUESTION_COUNT,
  EDGES_FALLBACK_NOTICE,
  MAX_QUEUE_LENGTH,
  MISTAKES_EMPTY_NOTICE,
  buildDrillPlan,
  drawDrillHand,
  indexHandAccuracy,
  parseDrillRequest,
  promptCards,
  replayRecordedMisses,
  scoreDrillAnswer,
  toPracticeAttempts,
  toSubmissionAnswers,
  type DrillAnswer,
} from './drill'

const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'
const otherId = '9f2cae71-d410-4fcf-8fb2-527964db0c2e'
const rangeHands = ['AA', 'KK', 'AKs']

function stat(hand: string, overrides: Partial<HandAccuracyStat> = {}): HandAccuracyStat {
  return { hand, attempts: 1, correct: 1, falsePositives: 0, falseNegatives: 0, ...overrides }
}

/** A fixed draw, so every assertion below names the hand it expects. */
function constantRandom(value: number): () => number {
  return () => value
}

function plan(mode: Parameters<typeof buildDrillPlan>[0]['mode'], overrides = {}) {
  return buildDrillPlan({
    mode,
    rangeHands,
    handAccuracy: [],
    handoffPool: undefined,
    ...overrides,
  })
}

describe('parseDrillRequest', () => {
  it('defaults everything the URL does not say', () => {
    expect(parseDrillRequest(new URLSearchParams(`range=${rangeId}`))).toEqual({
      rangeIds: [rangeId],
      mode: 'recognition',
      questionCount: DEFAULT_QUESTION_COUNT,
      seconds: 60,
      poolsKey: undefined,
    })
  })

  it('reads a queue, a mode, a count, a duration, and a pool handoff', () => {
    expect(
      parseDrillRequest(
        new URLSearchParams(
          `queue=${rangeId},${otherId}&mode=weakness&count=8&seconds=120&pools=handoff-key`,
        ),
      ),
    ).toEqual({
      rangeIds: [rangeId, otherId],
      mode: 'weakness',
      questionCount: 8,
      seconds: 120,
      poolsKey: 'handoff-key',
    })
  })

  it('falls back to the defaults for values outside the supported set', () => {
    const request = parseDrillRequest(
      new URLSearchParams(`range=${rangeId}&mode=solver&count=2&seconds=45`),
    )
    expect(request).toMatchObject({ mode: 'recognition', questionCount: 20, seconds: 60 })
    expect(
      parseDrillRequest(new URLSearchParams(`range=${rangeId}&count=1000`)).questionCount,
    ).toBe(20)
    expect(parseDrillRequest(new URLSearchParams(`range=${rangeId}&count=7.5`)).questionCount).toBe(
      20,
    )
  })

  it('de-duplicates the queue, keeps a single range in it, and caps its length', () => {
    const combined = parseDrillRequest(
      new URLSearchParams(`range=${rangeId}&queue=${rangeId},${otherId}`),
    )
    expect(combined.rangeIds).toEqual([rangeId, otherId])

    const many = Array.from({ length: 150 }, (_unused, seat) => `range-${seat}`).join(',')
    expect(parseDrillRequest(new URLSearchParams(`queue=${many}`)).rangeIds).toHaveLength(
      MAX_QUEUE_LENGTH,
    )
    expect(parseDrillRequest(new URLSearchParams()).rangeIds).toEqual([])
  })
})

describe('buildDrillPlan', () => {
  it('deals every hand for recognition, timed, and build', () => {
    for (const mode of ['recognition', 'timed', 'build'] as const) {
      const built = plan(mode)
      expect(built).toMatchObject({ pool: { kind: 'random' }, empty: false, notice: undefined })
    }
    expect(drawDrillHand(plan('recognition').pool, [], constantRandom(0))).toBe('AA')
    expect(drawDrillHand(plan('recognition').pool, [], constantRandom(168 / 169))).toBe('22')
  })

  it('lets a handoff pool override the mode pool and drops hands that are not real', () => {
    const built = plan('edges', { handoffPool: ['QQ', 'not-a-hand', '72o', 'QQ'] })
    expect(built.pool).toEqual({ kind: 'fixed', hands: ['QQ', '72o'] })
    expect(drawDrillHand(built.pool, [], constantRandom(0))).toBe('QQ')
    expect(drawDrillHand(built.pool, [], constantRandom(0.5))).toBe('72o')
  })

  it('deals only the boundary hands in edges mode', () => {
    expect(plan('edges').pool).toEqual({
      kind: 'fixed',
      hands: ['AA', 'AKs', 'AQs', 'AKo', 'KK', 'KQs', 'KQo'],
    })
  })

  it('falls back to recognition with a notice when a range has no edge at all', () => {
    const built = plan('edges', { rangeHands: ALL_HANDS })
    expect(built).toEqual({ pool: { kind: 'random' }, notice: EDGES_FALLBACK_NOTICE, empty: false })
  })

  it('deals only the hands with a recorded mistake', () => {
    const built = plan('mistakes', {
      handAccuracy: [
        stat('AA'),
        stat('AQs', { attempts: 3, correct: 1, falseNegatives: 2 }),
        stat('KK', { attempts: 2, correct: 1, falsePositives: 1 }),
      ],
    })
    expect(built).toEqual({
      pool: { kind: 'fixed', hands: ['AQs', 'KK'] },
      notice: undefined,
      empty: false,
    })
  })

  it('refuses to run a mistakes drill with nothing to drill', () => {
    const built = plan('mistakes', { handAccuracy: [stat('AA')] })
    expect(built).toEqual({
      pool: { kind: 'fixed', hands: [] },
      notice: MISTAKES_EMPTY_NOTICE,
      empty: true,
    })
    expect(() => drawDrillHand(built.pool, [])).toThrow(/empty pool/)
  })

  it('weights the weakness pool by the recorded record and by this run', () => {
    // AKs was missed twice, so it holds 1 + 3*2 = 7 of the pool's 175 slots,
    // right after AA's single slot.
    const weakness = plan('weakness', {
      handAccuracy: [stat('AKs', { attempts: 5, correct: 3, falseNegatives: 2 })],
    })
    expect(weakness.pool).toMatchObject({ kind: 'weakness' })
    expect(drawDrillHand(weakness.pool, [], constantRandom(7 / 175))).toBe('AKs')
    expect(drawDrillHand(weakness.pool, [], constantRandom(8 / 175))).toBe('AQs')

    // A miss inside the run widens AA to four slots, pushing AKs along with it.
    const answered = toPracticeAttempts([
      {
        questionId: 'question-1',
        hand: 'AA',
        answer: false,
        answeredAt: '2026-01-02T03:04:05.000Z',
        expectedInRange: true,
        correct: false,
      },
    ])
    expect(drawDrillHand(weakness.pool, answered, constantRandom(3 / 178))).toBe('AA')
    expect(drawDrillHand(weakness.pool, answered, constantRandom(4 / 178))).toBe('AKs')
  })
})

describe('recorded mistakes', () => {
  it('keys the API list by hand and replays every miss as one incorrect attempt', () => {
    const stats = [stat('AQs', { attempts: 4, correct: 1, falseNegatives: 2, falsePositives: 1 })]
    expect(indexHandAccuracy(stats)).toEqual({ AQs: stats[0] })
    const replayed = replayRecordedMisses(stats)
    expect(replayed).toHaveLength(3)
    expect(replayed.every((attempt) => attempt.correct === false)).toBe(true)
    expect(replayed.filter((attempt) => attempt.expectedInRange)).toHaveLength(2)
  })

  it('caps how far one hand can flood the pool', () => {
    expect(
      replayRecordedMisses([stat('AA', { attempts: 40, correct: 0, falseNegatives: 40 })]),
    ).toHaveLength(10)
  })
})

describe('scoring an answer', () => {
  const identity = { questionId: 'question-1', answeredAt: '2026-01-02T03:04:05.000Z' }

  it('scores against the range and keeps both the submission and the recap shapes', () => {
    const hit = scoreDrillAnswer('AA', rangeHands, true, identity)
    const miss = scoreDrillAnswer('72o', rangeHands, true, {
      ...identity,
      questionId: 'question-2',
    })
    expect(hit).toMatchObject({ expectedInRange: true, correct: true })
    expect(miss).toMatchObject({ expectedInRange: false, correct: false })

    const answers: DrillAnswer[] = [hit, miss]
    expect(toSubmissionAnswers(answers)).toEqual([
      { questionId: 'question-1', hand: 'AA', answer: true, answeredAt: identity.answeredAt },
      { questionId: 'question-2', hand: '72o', answer: true, answeredAt: identity.answeredAt },
    ])
    expect(toPracticeAttempts(answers)[1]).toEqual({
      hand: '72o',
      expectedInRange: false,
      userAnsweredInRange: true,
      correct: false,
      timestamp: identity.answeredAt,
    })
  })
})

describe('promptCards', () => {
  it('shares a suit only when the hand is suited', () => {
    expect(promptCards('AKs')).toEqual([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 's' },
    ])
    expect(promptCards('AKo')).toEqual([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
    ])
    expect(promptCards('QQ')).toEqual([
      { rank: 'Q', suit: 's' },
      { rank: 'Q', suit: 'h' },
    ])
  })
})
