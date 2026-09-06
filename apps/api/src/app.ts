import { randomUUID } from 'node:crypto'
import path from 'node:path'

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

/** Mount point of the import router, whose bodies bypass the general parser. */
const IMPORT_PATH_PREFIX = '/api/v1/imports'

/**
 * Prefixes the SPA fallback never answers for. An unknown API path keeps its
 * problem+json 404, and a hashed asset that is missing (a stale tab after a
 * deploy, say) must come back as a 404 the browser can act on, never as HTML.
 */
const RESERVED_PATH_PREFIXES = ['/api', '/assets']

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

/** Requests the import router parses for itself, once the caller is known. */
function isImportPath(path: string): boolean {
  return path === IMPORT_PATH_PREFIX || path.startsWith(`${IMPORT_PATH_PREFIX}/`)
}

function isReservedPath(pathname: string): boolean {
  return RESERVED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * The built single-page app. Files under `dist/` win, hashed assets with an
 * immutable year-long cache and everything else revalidated on every load; any
 * other GET that is not reserved gets `index.html` so the client router can
 * answer the URL. Mounted after the API routers, so those always match first.
 */
function webBundle(distDir: string): express.Router {
  const router = express.Router()
  const assetsDir = path.join(distDir, 'assets') + path.sep
  const indexHtml = path.join(distDir, 'index.html')
  router.use(
    express.static(distDir, {
      index: false,
      redirect: false,
      dotfiles: 'ignore',
      setHeaders(res, filePath) {
        res.setHeader(
          'Cache-Control',
          filePath.startsWith(assetsDir) ? 'public, max-age=31536000, immutable' : 'no-cache',
        )
      },
    }),
  )
  router.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || isReservedPath(req.path)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexHtml, (error?: Error) => {
      if (error) next(error)
    })
  })
  return router
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
  // The policy the Next.js front end used to send, tightened: the Vite bundle has
  // no inline scripts, so script-src drops 'unsafe-inline'. style-src keeps it for
  // the percentage bars the views size through the style attribute. Helmet applies
  // it to every response, HTML and JSON alike, as it always did here.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'frame-src': ["'none'"],
          'form-action': ["'self'"],
          'connect-src': ["'self'"],
          'font-src': ["'self'"],
          'img-src': ["'self'"],
          'script-src': ["'self'"],
          'script-src-attr': ["'none'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          ...(config.nodeEnv === 'production' ? { 'upgrade-insecure-requests': [] } : {}),
        },
      },
      frameguard: { action: 'deny' },
    }),
  )
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
    next()
  })
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
  // A legacy backup is one JSON document far larger than any other request this
  // API accepts, so the import router parses its own body behind authentication
  // and CSRF. Reading it here would let an anonymous client spend the process's
  // memory before anything checked who was asking; every other route stays
  // bounded at 1 MiB.
  const parseJsonBody = express.json({ limit: '1mb', strict: true })
  app.use((req, res, next) => {
    if (isImportPath(req.path)) return next()
    parseJsonBody(req, res, next)
  })

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
  if (config.webDistDir !== undefined) app.use(webBundle(config.webDistDir))
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
        detail: 'Request body is larger than this endpoint accepts.',
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
