import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PracticeSessionSubmission } from '@poker-range-trainer/contracts'

import {
  ApiClientError,
  bulkMutateRanges,
  createRange,
  deleteRange,
  getCurrentUser,
  getRange,
  getRangePractice,
  listRanges,
  login,
  submitPracticeSession,
  setRangeArchived,
  setRangeFavorite,
  updateRange,
} from './api-client'

const requestId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'

function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } })
}

describe('API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.cookie = 'prt_csrf=; Max-Age=0; path=/'
  })

  it('parses successful responses and uses credentialed, no-store requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { authenticated: false } }))

    await expect(getCurrentUser()).resolves.toEqual({ data: { authenticated: false } })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({ credentials: 'include', cache: 'no-store', method: 'GET' }),
    )
  })

  it('maps structured problem details and adds the readable CSRF token to unsafe methods', async () => {
    document.cookie = 'prt_csrf=csrf-token; path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          type: 'https://poker-range-trainer.dev/problems/validation-failed',
          title: 'Validation failed',
          status: 422,
          detail: 'Request validation failed.',
          instance: '/api/v1/auth/login',
          requestId,
          code: 'VALIDATION_FAILED',
          issues: [{ path: ['email'], code: 'invalid_format', message: 'Email is invalid.' }],
        },
        422,
        'application/problem+json',
      ),
    )

    const error = await login({ email: 'bad', password: 'password12345' }).catch(
      (reason: unknown) => reason,
    )
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ kind: 'problem', problem: { code: 'VALIDATION_FAILED' } })
    const init = fetchMock.mock.calls[0]?.[1]
    expect((init?.headers as Headers).get('x-csrf-token')).toBe('csrf-token')
  })

  it('maps non-JSON and network failures to safe client errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('not json', { status: 502 }))
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'invalid-response', status: 502 })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{not valid json', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    )
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'invalid-response', status: 200 })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'))
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'network' })
  })

  it('rejects JSON-like but unsupported content types and omits malformed CSRF cookies', async () => {
    document.cookie = 'prt_csrf=%E0%A4%A; path=/'
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              user: {
                id: requestId,
                email: 'player@example.test',
                createdAt: '2026-01-02T03:04:05.000Z',
              },
            },
          },
          200,
          'application/jsonp',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { authenticated: false } }, 200, 'text/plain+json'),
      )

    await expect(
      login({ email: 'player@example.test', password: 'password12345' }),
    ).rejects.toMatchObject({
      kind: 'invalid-response',
    })
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'invalid-response' })
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get('x-csrf-token')).toBeNull()
  })

  it('encodes range paths, serializes supported queries, parses mutations, and keeps CSRF centralized', async () => {
    document.cookie = 'prt_csrf=range-token; path=/'
    const range = {
      id: requestId,
      version: 2,
      name: 'BTN open',
      hands: ['AA'],
      metadata: null,
      displayOrder: 0,
      archived: false,
      favorite: false,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
      deletedAt: null,
    }
    const listItem = {
      id: range.id,
      version: range.version,
      name: range.name,
      metadata: range.metadata,
      displayOrder: range.displayOrder,
      archived: range.archived,
      favorite: range.favorite,
      updatedAt: range.updatedAt,
      deletedAt: range.deletedAt,
      handCount: 1,
      comboCount: 6,
      rangePercentage: (6 / 1326) * 100,
    }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          data: [listItem],
          meta: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: range }))
      .mockResolvedValueOnce(jsonResponse({ data: range }))
      .mockResolvedValueOnce(jsonResponse({ data: range }))
      .mockResolvedValueOnce(jsonResponse({ data: range }))
      .mockResolvedValueOnce(jsonResponse({ data: range }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: requestId, version: 3, deletedAt: range.updatedAt } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { action: 'archive', atomic: true, items: [listItem] } }),
      )

    await listRanges({ page: 2, search: 'BTN & CO', archived: 'include', favorite: true })
    await getRange('a/b')
    await createRange({ name: 'BTN open', hands: ['AA'] })
    await updateRange(requestId, { version: 2, name: 'BTN open' })
    await setRangeFavorite(requestId, 2, true)
    await setRangeArchived(requestId, 2, true)
    await deleteRange(requestId, 2)
    await bulkMutateRanges({ action: 'archive', items: [{ id: requestId, version: 2 }] })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/ranges?page=2&search=BTN+%26+CO&archived=include&favorite=true',
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/ranges/a%2Fb')
    for (const [, init] of fetchMock.mock.calls.slice(2)) {
      expect((init?.headers as Headers).get('x-csrf-token')).toBe('range-token')
      expect(init?.cache).toBe('no-store')
    }
  })
  it('posts a practice session with CSRF, encodes the practice read path, and parses both', async () => {
    document.cookie = 'prt_csrf=practice-token; path=/'
    const sessionId = 'ac0f1f8e-1cf3-4b0b-8b53-9d5a26fb6b31'
    const questionId = '2f0d4d51-4a1e-4f7c-8a2b-9d1c0f6e5a44'
    const submission: PracticeSessionSubmission = {
      mode: 'recognition',
      rangeId: requestId,
      idempotencyKey: sessionId,
      answers: [
        { questionId, hand: 'AA', answer: true, answeredAt: '2026-01-02T03:04:05.000Z' },
        {
          questionId: '5b7f2a0e-2a09-4a70-9d2f-6f8b1d3c7e21',
          hand: '72o',
          answer: true,
          answeredAt: '2026-01-02T03:04:06.000Z',
        },
      ],
    }
    const sessionBody = {
      data: {
        session: {
          id: sessionId,
          rangeId: requestId,
          mode: 'recognition',
          totalQuestions: 2,
          correctAnswers: 1,
          accuracyPercentage: 50,
          completedAt: '2026-01-02T03:04:07.000Z',
        },
        stats: {
          rangeId: requestId,
          totalAttempts: 12,
          correctAttempts: 9,
          accuracyPercentage: 75,
          lastPracticedAt: '2026-01-02T03:04:07.000Z',
        },
        review: {
          rangeId: requestId,
          ease: 2.5,
          intervalDays: 3,
          dueAt: '2026-01-05T03:04:07.000Z',
          lastReviewedAt: '2026-01-02T03:04:07.000Z',
        },
      },
    }
    const readBody = {
      data: {
        rangeId: requestId,
        stats: null,
        review: null,
        handAccuracy: [
          { hand: '72o', attempts: 3, correct: 1, falsePositives: 2, falseNegatives: 0 },
        ],
        recentSessions: [],
      },
    }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(readBody))

    await expect(submitPracticeSession(submission)).resolves.toEqual(sessionBody)
    await expect(getRangePractice('a/b')).resolves.toEqual(readBody)

    const [path, init] = fetchMock.mock.calls[0] ?? []
    expect(path).toBe('/api/v1/practice/sessions')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify(submission))
    expect((init?.headers as Headers).get('x-csrf-token')).toBe('practice-token')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/practice/ranges/a%2Fb')
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('GET')
  })

  it('rejects a practice response whose accuracy does not follow from its counters', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        data: {
          session: {
            id: requestId,
            rangeId: requestId,
            mode: 'recognition',
            totalQuestions: 2,
            correctAnswers: 1,
            accuracyPercentage: 100,
            completedAt: '2026-01-02T03:04:07.000Z',
          },
          stats: {
            rangeId: requestId,
            totalAttempts: 0,
            correctAttempts: 0,
            accuracyPercentage: 0,
            lastPracticedAt: null,
          },
          review: {
            rangeId: requestId,
            ease: 2.5,
            intervalDays: 0,
            dueAt: null,
            lastReviewedAt: null,
          },
        },
      }),
    )

    await expect(
      submitPracticeSession({
        mode: 'build',
        rangeId: requestId,
        idempotencyKey: requestId,
        selectedHands: ['AA'],
      }),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
