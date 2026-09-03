import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError, getCurrentUser, login } from './api-client'

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
})
