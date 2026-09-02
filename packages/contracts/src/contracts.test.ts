import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  authSessionResponseSchema,
  handCodeSchema,
  healthResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  logoutResponseSchema,
  meResponseSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  problemDetailsSchema,
  registerRequestSchema,
} from './index.js'

const user = {
  id: '0af80ebe-4171-4a9f-8847-3d483ea0e2e7',
  email: 'player@example.com',
  createdAt: '2026-09-01T12:00:00.000Z',
}

describe('common API contracts', () => {
  it.each(['AA', 'AKs', 'AKo', '76s', '32o'])('accepts canonical hand code %s', (hand) => {
    expect(handCodeSchema.parse(hand)).toBe(hand)
  })

  it.each(['AAs', 'KAo', '22o', 'AKx', 'A2s ', ''])('rejects non-canonical hand code %s', (hand) => {
    expect(handCodeSchema.safeParse(hand).success).toBe(false)
  })

  it('accepts a structured problem response and rejects invalid payloads', () => {
    expect(
      problemDetailsSchema.parse({
        type: 'https://api.example.test/problems/validation-failed',
        title: 'Request validation failed',
        status: 422,
        requestId: '0af80ebe-4171-4a9f-8847-3d483ea0e2e7',
        code: 'VALIDATION_FAILED',
        issues: [{ path: ['email'], code: 'invalid_format', message: 'Email is invalid.' }],
      }),
    ).toMatchObject({ code: 'VALIDATION_FAILED', status: 422, requestId: user.id })

    expect(
      problemDetailsSchema.safeParse({
        type: 'https://api.example.test/problems/validation-failed',
        title: 'Request validation failed',
        status: 200,
        requestId: user.id,
        code: 'VALIDATION_FAILED',
      }).success,
    ).toBe(false)
    for (const code of ['CSRF_FAILED', 'PAYLOAD_TOO_LARGE'] as const) {
      expect(
        problemDetailsSchema.parse({
          type: `https://api.example.test/problems/${code.toLowerCase()}`,
          title: 'Request failed',
          status: code === 'CSRF_FAILED' ? 403 : 413,
          requestId: user.id,
          code,
        }).code,
      ).toBe(code)
    }
    expect(
      problemDetailsSchema.safeParse({
        type: 'https://api.example.test/problems/validation-failed',
        title: 'Request validation failed',
        status: 422,
        requestId: user.id,
        code: 'VALIDATION_FAILED',
        extra: 'not part of the contract',
      }).success,
    ).toBe(false)
    expect(
      problemDetailsSchema.safeParse({
        type: 'https://api.example.test/problems/validation-failed',
        title: 'Request validation failed',
        status: 422,
        code: 'CSRF_FAILED',
      }).success,
    ).toBe(false)
  })
})

describe('auth contracts', () => {
  it('normalizes a valid registration request', () => {
    expect(
      registerRequestSchema.parse({ email: '  PLAYER@EXAMPLE.COM ', password: 'secure-pass1' }),
    ).toEqual({ email: 'player@example.com', password: 'secure-pass1' })
  })

  it.each([
    { email: 'not-an-email', password: 'secure-pass1' },
    { email: 'player@example.com', password: 'short1' },
    { email: 'player@example.com', password: 'onlylettersxxx' },
    { email: 'player@example.com', password: '123456789012' },
    { email: 'player@example.com', password: 'secure-pass1', role: 'admin' },
  ])('rejects malformed or over-posted credentials', (request) => {
    expect(loginRequestSchema.safeParse(request).success).toBe(false)
  })

  it('never permits a password in successful auth response contracts', () => {
    const password = 'secure-pass1'
    const response = authSessionResponseSchema.parse({ data: { user } })

    expect(JSON.stringify(response)).not.toContain(password)
    expect(response).toEqual({ data: { user } })
    expect(
      authSessionResponseSchema.safeParse({ data: { user: { ...user, password } } }).success,
    ).toBe(false)
    expect(meResponseSchema.parse({ data: { authenticated: true, user } })).toEqual({
      data: { authenticated: true, user },
    })
    expect(meResponseSchema.parse({ data: { authenticated: false } })).toEqual({
      data: { authenticated: false },
    })
    expect(meResponseSchema.safeParse({ data: { authenticated: false, password } }).success).toBe(false)
  })

  it('requires an empty logout request body', () => {
    expect(logoutRequestSchema.parse({})).toEqual({})
    expect(logoutRequestSchema.safeParse({ everyDevice: true }).success).toBe(false)
    expect(logoutResponseSchema.parse({ data: { success: true } })).toEqual({ data: { success: true } })
    expect(logoutResponseSchema.safeParse({ success: true }).success).toBe(false)
  })
})

describe('foundation response contracts', () => {
  it('accepts a health response with a UTC timestamp', () => {
    expect(
      healthResponseSchema.parse({
        data: { status: 'ok', service: 'api', timestamp: '2026-09-01T12:00:00Z' },
      }),
    ).toMatchObject({ data: { status: 'ok' } })
    expect(
      healthResponseSchema.safeParse({ status: 'ok', service: 'api', timestamp: '2026-09-01T12:00:00Z' })
        .success,
    ).toBe(false)
  })

  it('coerces valid pagination query strings and rejects unsafe bounds', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({ page: 2, pageSize: 50 })
    expect(paginationQuerySchema.safeParse({ page: '0', pageSize: '101' }).success).toBe(false)
  })

  it('uses a strict typed pagination envelope', () => {
    const schema = paginatedResponseSchema(z.object({ id: z.string() }).strict())

    expect(
      schema.parse({
        data: [{ id: 'range-1' }],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }),
    ).toMatchObject({ meta: { totalItems: 1 } })
    expect(
      schema.safeParse({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: -1, totalPages: 0 },
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({ data: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }).success,
    ).toBe(false)
  })
})
