import { z } from 'zod'

import { isValidHand, type PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'

/** A database/API identifier. New server-owned resources use UUIDs. */
export const idSchema = z.uuid()
export type Id = z.infer<typeof idSchema>

/** ISO 8601 timestamps exchanged by the API, always including a UTC offset. */
export const timestampSchema = z.string().datetime({ offset: true })
export type Timestamp = z.infer<typeof timestampSchema>

/** The 169 canonical preflop starting-hand cells (for example, `AA`, `AKs`, `AKo`). */
export type HandCode = PokerHand

/**
 * Delegate to the canonical poker-domain validator so clients and APIs accept
 * exactly the same 169 hand cells.
 */
export function isHandCode(value: string): value is HandCode {
  return isValidHand(value)
}

export const handCodeSchema = z.string().refine(isHandCode, {
  message: 'Expected a canonical preflop hand code such as AA, AKs, or AKo.',
})

/** Error codes are stable programmatic identifiers; clients must not parse prose messages. */
export const errorCodeValues = [
  'VALIDATION_FAILED',
  'CSRF_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const

export const errorCodeSchema = z.enum(errorCodeValues)
export type ErrorCode = z.infer<typeof errorCodeSchema>

/** A machine-readable explanation for one invalid request field. */
export const errorIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
  })
  .strict()
export type ErrorIssue = z.infer<typeof errorIssueSchema>

/** RFC 9457-style problem details returned for every non-success API response. */
export const problemDetailsSchema = z
  .object({
    type: z.string().url(),
    title: z.string().min(1).max(120),
    status: z.number().int().min(400).max(599),
    detail: z.string().min(1).max(1_000).optional(),
    instance: z.string().max(2_000).optional(),
    requestId: idSchema,
    code: errorCodeSchema,
    issues: z.array(errorIssueSchema).max(100).optional(),
  })
  .strict()
export type ProblemDetails = z.infer<typeof problemDetailsSchema>

/** Build the standard JSON body for every successful API response. */
export function successResponseSchema<Data extends z.ZodType>(dataSchema: Data) {
  return z.object({ data: dataSchema }).strict()
}
