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
