import type { Request, Response } from 'express'
import type { z } from 'zod'

import { sendProblem } from '../problem.js'

export type RequestParseResult<Schema extends z.ZodType> =
  { ok: true; data: z.output<Schema> } | { ok: false }

function sendValidationProblem(request: Request, response: Response, error: z.ZodError): void {
  sendProblem(request, response, {
    status: 422,
    title: 'Validation failed',
    detail: 'Request validation failed.',
    code: 'VALIDATION_FAILED',
    issues: error.issues.map((issue) => ({
      path: issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol'),
      code: issue.code,
      message: issue.message,
    })),
  })
}

function parseRequestValue<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  request: Request,
  response: Response,
): RequestParseResult<Schema> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    sendValidationProblem(request, response, parsed.error)
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

export function parseRequestBody<Schema extends z.ZodType>(
  schema: Schema,
  request: Request,
  response: Response,
): RequestParseResult<Schema> {
  return parseRequestValue(schema, request.body, request, response)
}

export function parseRequestParams<Schema extends z.ZodType>(
  schema: Schema,
  request: Request,
  response: Response,
): RequestParseResult<Schema> {
  return parseRequestValue(schema, request.params, request, response)
}

export function parseRequestQuery<Schema extends z.ZodType>(
  schema: Schema,
  request: Request,
  response: Response,
): RequestParseResult<Schema> {
  return parseRequestValue(schema, request.query, request, response)
}
