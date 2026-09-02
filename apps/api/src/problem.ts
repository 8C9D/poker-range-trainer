import type { Request, Response } from 'express'

import type { ErrorCode, ProblemDetails } from '@poker-range-trainer/contracts'

const problemBaseUrl = 'https://poker-range-trainer.dev/problems'

export interface ProblemInput {
  status: number
  title: string
  code: ErrorCode
  detail?: string
  issues?: ProblemDetails['issues']
}

export function sendProblem(request: Request, response: Response, input: ProblemInput): void {
  const problem: ProblemDetails = {
    type: `${problemBaseUrl}/${input.code.toLowerCase().replaceAll('_', '-')}`,
    title: input.title,
    status: input.status,
    instance: request.path,
    requestId: requestId(request),
    code: input.code,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
    ...(input.issues === undefined ? {} : { issues: input.issues }),
  }
  response.status(input.status).type('application/problem+json').send(problem)
}

export function requestId(request: Request): string {
  return (request as Request & { requestId: string }).requestId
}
