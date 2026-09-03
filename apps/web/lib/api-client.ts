import {
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  problemDetailsSchema,
  registerRequestSchema,
  registerResponseSchema,
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
