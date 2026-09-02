import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { parseRequestBody, parseRequestParams, parseRequestQuery } from '../src/http/validation.js'

const requestId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'

function request(values: Partial<Request>): Request {
  return { path: '/api/v1/ranges', requestId, ...values } as Request
}

function response(): Response {
  const value = {
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  }
  value.status.mockReturnValue(value)
  value.type.mockReturnValue(value)
  return value as unknown as Response
}

describe('HTTP request validation', () => {
  it('parses path parameters with schema output types', () => {
    const result = parseRequestParams(
      z.object({ version: z.coerce.number().int().positive() }).strict(),
      request({ params: { version: '2' } }),
      response(),
    )

    expect(result).toEqual({ ok: true, data: { version: 2 } })
  })

  it('parses query values and maps nested validation paths into problem details', () => {
    const queryResponse = response()
    const result = parseRequestQuery(
      z
        .object({
          filters: z.array(z.object({ page: z.coerce.number().int().positive() }).strict()),
        })
        .strict(),
      request({ query: { filters: [{ page: '0' }] } }),
      queryResponse,
    )

    expect(result).toEqual({ ok: false })
    expect(queryResponse.status).toHaveBeenCalledWith(422)
    expect(queryResponse.type).toHaveBeenCalledWith('application/problem+json')
    expect(queryResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        issues: [expect.objectContaining({ path: ['filters', 0, 'page'] })],
      }),
    )
  })

  it('keeps a successfully parsed undefined distinct from validation failure', () => {
    const result = parseRequestBody(z.undefined(), request({ body: undefined }), response())

    expect(result).toEqual({ ok: true, data: undefined })
  })
})
