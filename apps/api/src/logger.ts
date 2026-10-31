import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
  type redactOptions,
} from 'pino'

import type { LogLevel } from './config.js'

const redactPaths = [
  'authorization',
  'cookie',
  'set-cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.set-cookie',
  'res.headers.set-cookie',
  'body',
  'req.body',
  'res.body',
]

export function createLogger(
  level: LogLevel,
  options: LoggerOptions = {},
  destination?: DestinationStream,
): Logger {
  const { redact: callerRedaction, ...callerOptions } = options
  const callerOptionsRedaction: redactOptions = Array.isArray(callerRedaction)
    ? { paths: callerRedaction }
    : (callerRedaction ?? { paths: [] })

  return pino(
    {
      ...callerOptions,
      level,
      redact: {
        ...callerOptionsRedaction,
        paths: [...new Set([...redactPaths, ...callerOptionsRedaction.paths])],
        // Credentials and bodies must be removed, even when a caller supplies
        // a different redaction policy for its own additional fields.
        remove: true,
      },
    },
    destination,
  )
}

export interface ErrorDiagnostics {
  errorName: string
  /** SQLSTATE or a Node error code. */
  errorCode?: string
  constraint?: string
  /** Where a schema rejected a value, never the value itself. */
  issuePaths?: string[]
  stackFrames?: string[]
}

const MAX_STACK_FRAMES = 12
const MAX_ISSUE_PATHS = 10
const MAX_CAUSE_DEPTH = 5

function causeChain(error: unknown): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = []
  let current = error
  while (typeof current === 'object' && current !== null && chain.length < MAX_CAUSE_DEPTH) {
    chain.push(current as Record<string, unknown>)
    current = (current as { cause?: unknown }).cause
  }
  return chain
}

function firstString(chain: Record<string, unknown>[], key: string): string | undefined {
  return chain.map((link) => link[key]).find((value) => typeof value === 'string') as
    | string
    | undefined
}

/**
 * What an operator needs to place a failure, without its message: driver messages
 * quote the failing query and its parameters, which hold emails and password
 * hashes. Names, SQLSTATE, constraint, schema paths, and call frames carry none.
 */
export function errorDiagnostics(error: unknown): ErrorDiagnostics {
  const chain = causeChain(error)
  const first = chain[0]
  const errorCode = firstString(chain, 'code')
  const constraint = firstString(chain, 'constraint')
  const issues = first?.issues
  const issuePaths = Array.isArray(issues)
    ? issues
        .slice(0, MAX_ISSUE_PATHS)
        .map((issue: { path?: unknown }) =>
          Array.isArray(issue.path) ? issue.path.map(String).join('.') : '',
        )
    : undefined
  const stack = first?.stack
  const stackFrames =
    typeof stack === 'string'
      ? stack
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('at '))
          .slice(0, MAX_STACK_FRAMES)
      : undefined
  return {
    errorName: typeof first?.name === 'string' ? first.name : 'Error',
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(constraint === undefined ? {} : { constraint }),
    ...(issuePaths === undefined ? {} : { issuePaths }),
    ...(stackFrames === undefined ? {} : { stackFrames }),
  }
}
