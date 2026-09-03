import {
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  practiceSessionSubmissionResponseSchema,
  problemDetailsSchema,
  progressResponseSchema,
  bulkRangeMutationResponseSchema,
  rangeArchiveResponseSchema,
  rangeCreateResponseSchema,
  rangeDeleteResponseSchema,
  rangeDuplicateResponseSchema,
  rangeFavoriteResponseSchema,
  rangeListResponseSchema,
  rangePracticeReadResponseSchema,
  rangeReadResponseSchema,
  rangeRestoreResponseSchema,
  rangeUpdateResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  todayResponseSchema,
  trainingGoalResponseSchema,
  type BulkRangeMutationRequest,
  type RangeCreateRequest,
  type RangeDuplicateRequest,
  type PracticeSessionSubmission,
  type RangeListQuery,
  type RangeUpdateRequest,
  type ProblemDetails,
} from '@poker-range-trainer/contracts'
import type { z } from 'zod'

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export class ApiClientError extends Error {
  readonly kind: 'network' | 'invalid-response' | 'problem'
  readonly status: number | undefined
  readonly problem: ProblemDetails | undefined

  constructor(
    kind: ApiClientError['kind'],
    message: string,
    options: { status?: number; problem?: ProblemDetails } = {},
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.kind = kind
    this.status = options.status
    this.problem = options.problem
  }
}

export interface ApiRequestOptions<Schema extends z.ZodType> {
  schema: Schema
  method?: ApiMethod
  body?: unknown
}

export type RangeListOptions = Partial<RangeListQuery>

function rangePath(rangeId: string, suffix = ''): string {
  return `/ranges/${encodeURIComponent(rangeId)}${suffix}`
}

function rangeQuery(query: RangeListOptions): string {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) parameters.set(key, String(value))
  }
  const serialized = parameters.toString()
  return serialized ? `?${serialized}` : ''
}

function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('prt_csrf='))
  if (!cookie) return undefined
  try {
    return decodeURIComponent(cookie.slice('prt_csrf='.length))
  } catch {
    return undefined
  }
}

function isUnsafeMethod(method: ApiMethod): boolean {
  return method !== 'GET'
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i.test(contentType)) {
    throw new ApiClientError(
      'invalid-response',
      'The server returned an unexpected response. Please try again.',
      { status: response.status },
    )
  }
  try {
    return await response.json()
  } catch {
    throw new ApiClientError(
      'invalid-response',
      'The server returned invalid JSON. Please try again.',
      { status: response.status },
    )
  }
}

export async function apiRequest<Schema extends z.ZodType>(
  path: string,
  options: ApiRequestOptions<Schema>,
): Promise<z.output<Schema>> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    throw new ApiClientError('invalid-response', 'The request path is invalid.')
  }
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (isUnsafeMethod(method)) {
    const token = csrfToken()
    if (token) headers.set('x-csrf-token', token)
  }

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    throw new ApiClientError(
      'network',
      'We could not reach the server. Check your connection and retry.',
    )
  }

  const json = await responseJson(response)
  if (!response.ok) {
    const parsedProblem = problemDetailsSchema.safeParse(json)
    if (parsedProblem.success) {
      throw new ApiClientError('problem', parsedProblem.data.detail ?? parsedProblem.data.title, {
        status: response.status,
        problem: parsedProblem.data,
      })
    }
    throw new ApiClientError(
      'invalid-response',
      'The server returned an unexpected error response. Please try again.',
      { status: response.status },
    )
  }

  const parsedData = options.schema.safeParse(json)
  if (!parsedData.success) {
    throw new ApiClientError(
      'invalid-response',
      'The server returned unexpected data. Please try again.',
      { status: response.status },
    )
  }
  return parsedData.data
}

export function getCurrentUser() {
  return apiRequest('/auth/me', { schema: meResponseSchema })
}

export function login(input: z.input<typeof loginRequestSchema>) {
  return apiRequest('/auth/login', { method: 'POST', body: input, schema: loginResponseSchema })
}

export function register(input: z.input<typeof registerRequestSchema>) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: input,
    schema: registerResponseSchema,
  })
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST', schema: logoutResponseSchema })
}

export function listRanges(query: RangeListOptions = {}) {
  return apiRequest(`/ranges${rangeQuery(query)}`, { schema: rangeListResponseSchema })
}

export function getRange(rangeId: string) {
  return apiRequest(rangePath(rangeId), { schema: rangeReadResponseSchema })
}

export function createRange(input: RangeCreateRequest) {
  return apiRequest('/ranges', { method: 'POST', body: input, schema: rangeCreateResponseSchema })
}

export function updateRange(rangeId: string, input: RangeUpdateRequest) {
  return apiRequest(rangePath(rangeId), {
    method: 'PATCH',
    body: input,
    schema: rangeUpdateResponseSchema,
  })
}

export function setRangeFavorite(rangeId: string, version: number, favorite: boolean) {
  return apiRequest(rangePath(rangeId, '/favorite'), {
    method: 'POST',
    body: { version, favorite },
    schema: rangeFavoriteResponseSchema,
  })
}

export function setRangeArchived(rangeId: string, version: number, archived: boolean) {
  return apiRequest(rangePath(rangeId, '/archive'), {
    method: 'POST',
    body: { version, archived },
    schema: rangeArchiveResponseSchema,
  })
}

export function duplicateRange(rangeId: string, input: RangeDuplicateRequest) {
  return apiRequest(rangePath(rangeId, '/duplicate'), {
    method: 'POST',
    body: input,
    schema: rangeDuplicateResponseSchema,
  })
}

export function deleteRange(rangeId: string, version: number) {
  return apiRequest(rangePath(rangeId), {
    method: 'DELETE',
    body: { version },
    schema: rangeDeleteResponseSchema,
  })
}

export function restoreRange(rangeId: string, version: number) {
  return apiRequest(rangePath(rangeId, '/restore'), {
    method: 'POST',
    body: { version },
    schema: rangeRestoreResponseSchema,
  })
}

export function bulkMutateRanges(input: BulkRangeMutationRequest) {
  return apiRequest('/ranges/bulk', {
    method: 'POST',
    body: input,
    schema: bulkRangeMutationResponseSchema,
  })
}

export function submitPracticeSession(input: PracticeSessionSubmission) {
  return apiRequest('/practice/sessions', {
    method: 'POST',
    body: input,
    schema: practiceSessionSubmissionResponseSchema,
  })
}

export function getRangePractice(rangeId: string) {
  return apiRequest(`/practice/ranges/${encodeURIComponent(rangeId)}`, {
    schema: rangePracticeReadResponseSchema,
  })
}

/**
 * The Today and Progress read models are bucketed into calendar days, so both
 * carry the caller's IANA zone. The API rejects a zone it has not got
 * installed rather than silently falling back to UTC, which is why the value
 * travels as given instead of being normalised here.
 */
export function getToday(timeZone: string) {
  return apiRequest(`/practice/today?timeZone=${encodeURIComponent(timeZone)}`, {
    schema: todayResponseSchema,
  })
}

export function getProgress(timeZone: string) {
  return apiRequest(`/practice/progress?timeZone=${encodeURIComponent(timeZone)}`, {
    schema: progressResponseSchema,
  })
}

export function getTrainingGoal() {
  return apiRequest('/settings/training-goal', { schema: trainingGoalResponseSchema })
}

/** `null` turns the daily goal off; the server keeps no separate "enabled" flag. */
export function updateTrainingGoal(dailyHandsGoal: number | null) {
  return apiRequest('/settings/training-goal', {
    method: 'PUT',
    body: { dailyHandsGoal },
    schema: trainingGoalResponseSchema,
  })
}
