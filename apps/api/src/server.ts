import { createServer, type Server } from 'node:http'
import { pathToFileURL } from 'node:url'

import type { Logger } from 'pino'

import { closeDatabase, createDatabase, createPostgresPool } from '@poker-range-trainer/database'

import { createApp, type ReadinessCheck } from './app.js'
import { createAuthMiddleware } from './auth/middleware.js'
import { PostgresAuthRepository } from './auth/repository.js'
import { createAuthRouter } from './auth/routes.js'
import { loadConfig, type ApiConfig } from './config.js'
import { createLogger } from './logger.js'
import { PostgresRangeRepository } from './ranges/repository.js'
import { createRangeRouter } from './ranges/routes.js'
import { RangeService } from './ranges/service.js'

type PostgresPool = ReturnType<typeof createPostgresPool>

export interface RunningServer {
  server: Server
  close: () => Promise<void>
}

export interface ServerDependencies {
  createPool?: (connectionString: string) => PostgresPool
  createHttpServer?: (app: ReturnType<typeof createApp>) => Server
}

export function createServerRuntime(
  config: ApiConfig = loadConfig(),
  logger: Logger = createLogger(config.logLevel),
  dependencies: ServerDependencies = {},
): RunningServer {
  const pool = (dependencies.createPool ?? createPostgresPool)(config.databaseUrl)
  pool.on('error', (error: Error) => {
    logger.error(
      { errorName: error instanceof Error ? error.name : 'Error' },
      'PostgreSQL pool error',
    )
  })
  const readiness: ReadinessCheck = async () => {
    await pool.query('SELECT 1')
  }
  const database = createDatabase(pool)
  const authRepository = new PostgresAuthRepository(database, { now: () => new Date() })
  const authMiddleware = createAuthMiddleware({ repository: authRepository, config, logger })
  const rangeRepository = new PostgresRangeRepository(database)
  const rangeService = new RangeService(rangeRepository)
  const app = createApp({
    config,
    logger,
    readiness,
    registerRoutes(api) {
      api.use(
        '/api/v1/auth',
        createAuthRouter({
          config,
          logger,
          repository: authRepository,
          middleware: authMiddleware,
        }),
      )
      api.use(
        '/api/v1/ranges',
        createRangeRouter({ service: rangeService, middleware: authMiddleware }),
      )
    },
  })
  const server = (dependencies.createHttpServer ?? createServer)(app)
  let closing: Promise<void> | undefined

  const close = async (): Promise<void> => {
    if (closing) return closing
    const closeServer = server.listening
      ? new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)))
        })
      : Promise.resolve()
    closing = closeServer.finally(async () => closeDatabase(pool))
    return closing
  }

  return { server, close }
}

export function startServer(
  config: ApiConfig = loadConfig(),
  logger: Logger = createLogger(config.logLevel),
  dependencies: ServerDependencies = {},
): RunningServer {
  const running = createServerRuntime(config, logger, dependencies)
  const { server } = running
  server.listen(config.port, () => logger.info({ port: config.port }, 'API server listening'))
  return running
}

export function run(): void {
  const config = loadConfig()
  const logger = createLogger(config.logLevel)
  const running = startServer(config, logger)
  let shuttingDown = false
  const shutdown = (signal: 'SIGTERM' | 'SIGINT') => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'graceful shutdown started')
    void running.close().then(
      () => logger.info({ signal }, 'graceful shutdown complete'),
      (error: unknown) =>
        logger.error(
          { errorName: error instanceof Error ? error.name : 'Error' },
          'graceful shutdown failed',
        ),
    )
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) run()
