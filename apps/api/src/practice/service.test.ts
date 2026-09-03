import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import type { PracticeRepository } from './service.js'
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
