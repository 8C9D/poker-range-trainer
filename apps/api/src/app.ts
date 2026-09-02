import { randomUUID } from 'node:crypto'

import cors from 'cors'
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import type { Logger } from 'pino'

import type { ApiConfig } from './config.js'
import { createLogger } from './logger.js'
import { requestId, sendProblem } from './problem.js'

export type ReadinessCheck = () => Promise<void>

export interface CreateAppOptions {
  config: ApiConfig
  readiness: ReadinessCheck
  logger?: Logger
  now?: () => Date
  registerRoutes?: (app: Express) => void
}

class CorsOriginError extends Error {
  constructor() {
    super('Origin is not allowed.')
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function healthData(now: () => Date) {
  return {
    data: { status: 'ok' as const, service: 'api' as const, timestamp: now().toISOString() },
  }
}

function loggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint()
    res.on('finish', () => {
      logger.info(
        {
          requestId: requestId(req),
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        },
        'request completed',
      )
    })
    next()
  }
}

export function createApp(options: CreateAppOptions): Express {
  const { config, readiness, now = () => new Date(), registerRoutes } = options
  const logger = options.logger ?? createLogger(config.logLevel)
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)

  app.use((req, res, next) => {
    const incoming = req.get('x-request-id')
    ;(req as Request & { requestId: string }).requestId = isUuid(incoming) ? incoming : randomUUID()
    res.setHeader('x-request-id', requestId(req))
    next()
  })
  app.use(loggingMiddleware(logger))
  app.use(helmet())
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (origin === undefined || config.frontendOrigins.includes(origin))
          return callback(null, true)
        return callback(new CorsOriginError())
      },
    }),
  )
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      legacyHeaders: false,
      standardHeaders: 'draft-7',
      handler(req, res) {
        sendProblem(req, res, {
          status: 429,
          title: 'Too many requests',
          detail: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMITED',
        })
      },
    }),
  )
  app.use(express.json({ limit: '1mb', strict: true }))

  app.get('/api/v1/health/live', (_req, res) => res.status(200).json(healthData(now)))
  app.get('/api/v1/health/ready', async (req, res) => {
    try {
      await readiness()
      res.status(200).json(healthData(now))
    } catch (error: unknown) {
      logger.warn(
        { requestId: requestId(req), errorName: error instanceof Error ? error.name : 'Error' },
        'readiness check failed',
      )
      sendProblem(req, res, {
        status: 503,
        title: 'Service unavailable',
        detail: 'The service is not ready.',
        code: 'INTERNAL_ERROR',
      })
    }
  })

  registerRoutes?.(app)
  app.use((req, res) => {
    sendProblem(req, res, {
      status: 404,
      title: 'Not found',
      detail: 'The requested resource does not exist.',
      code: 'NOT_FOUND',
    })
  })
  app.use(errorHandler(logger, config.nodeEnv === 'production'))
  return app
}

function errorHandler(logger: Logger, isProduction: boolean): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) return next(error)
    const typedError = error as {
      type?: string
      status?: number
      statusCode?: number
      message?: string
      name?: string
    }
    if (error instanceof CorsOriginError) {
      sendProblem(req, res, {
        status: 403,
        title: 'Forbidden',
        detail: 'Origin is not allowed.',
        code: 'FORBIDDEN',
      })
      return
    }
    if (typedError.type === 'entity.parse.failed') {
      sendProblem(req, res, {
        status: 400,
        title: 'Invalid JSON',
        detail: 'Request body must contain valid JSON.',
        code: 'VALIDATION_FAILED',
      })
      return
    }
    if (
      typedError.type === 'entity.too.large' ||
      typedError.status === 413 ||
      typedError.statusCode === 413
    ) {
      sendProblem(req, res, {
        status: 413,
        title: 'Payload too large',
        detail: 'Request body must not exceed 1 MiB.',
        code: 'PAYLOAD_TOO_LARGE',
      })
      return
    }
    logger.error(
      { requestId: requestId(req), errorName: typedError.name ?? 'Error' },
      'request failed',
    )
    sendProblem(req, res, {
      status: 500,
      title: 'Internal server error',
      detail: isProduction
        ? 'An unexpected error occurred.'
        : 'An unexpected error occurred. Check server logs for details.',
      code: 'INTERNAL_ERROR',
    })
  }
}
