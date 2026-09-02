export type NodeEnvironment = 'development' | 'test' | 'production'
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'

export interface ApiConfig {
  nodeEnv: NodeEnvironment
  port: number
  databaseUrl: string
  frontendOrigins: readonly string[]
  logLevel: LogLevel
  trustProxy: boolean | number
  rateLimitWindowMs: number
  rateLimitMax: number
  sessionTtlSeconds: number
  authRateLimitWindowMs: number
  authRateLimitMax: number
}

type Environment = Record<string, string | undefined>

const logLevels = new Set<LogLevel>(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

function required(value: string | undefined, key: string): string {
  if (!value?.trim()) throw new Error(`${key} is required.`)
  return value.trim()
}

function boundedInteger(
  value: string | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value)) throw new Error(`${key} must be an integer.`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} must be between ${min} and ${max}.`)
  }
  return parsed
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (value === undefined || value === '') return false
  if (value === 'true') return true
  if (value === 'false') return false
  return boundedInteger(value, 'TRUST_PROXY', 0, 0, 10)
}

function parseOrigins(value: string | undefined, nodeEnv: NodeEnvironment): readonly string[] {
  if (!value?.trim()) {
    if (nodeEnv === 'production') throw new Error('API_ORIGINS is required in production.')
    return ['http://localhost:5173']
  }

  const origins = value.split(',').map((origin) => origin.trim())
  if (origins.some((origin) => !origin || origin === '*')) {
    throw new Error(
      'API_ORIGINS must be a comma-separated allowlist of exact origins, never a wildcard.',
    )
  }
  if (new Set(origins).size !== origins.length)
    throw new Error('API_ORIGINS must not contain duplicates.')

  for (const origin of origins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('API_ORIGINS entries must be valid origins.')
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(
        'API_ORIGINS entries must be exact http(s) origins without paths or credentials.',
      )
    }
    if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
      throw new Error('API_ORIGINS entries must use https in production.')
    }
  }
  return origins
}

function parseDatabaseUrl(value: string | undefined): string {
  const databaseUrl = required(value, 'DATABASE_URL')
  try {
    const parsed = new URL(databaseUrl)
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error()
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.')
  }
  return databaseUrl
}

export function loadConfig(env: Environment = process.env): ApiConfig {
  const nodeEnv = (env.NODE_ENV ?? 'development') as NodeEnvironment
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.')
  }
  if (nodeEnv === 'production' && env.TRUST_PROXY === undefined) {
    throw new Error('TRUST_PROXY must be explicitly configured in production.')
  }

  const logLevel = (env.LOG_LEVEL ?? 'info') as LogLevel
  if (!logLevels.has(logLevel)) throw new Error('LOG_LEVEL must be a supported Pino log level.')

  return {
    nodeEnv,
    port: boundedInteger(env.PORT, 'PORT', 3001, 1, 65535),
    databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
    frontendOrigins: parseOrigins(env.API_ORIGINS, nodeEnv),
    logLevel,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    rateLimitWindowMs: boundedInteger(
      env.RATE_LIMIT_WINDOW_MS,
      'RATE_LIMIT_WINDOW_MS',
      60_000,
      1_000,
      900_000,
    ),
    rateLimitMax: boundedInteger(env.RATE_LIMIT_MAX, 'RATE_LIMIT_MAX', 100, 1, 10_000),
    // Sessions are deliberately bounded: a deployment cannot accidentally create
    // credentials that outlive a reasonable revocation window.
    sessionTtlSeconds: boundedInteger(
      env.SESSION_TTL_SECONDS,
      'SESSION_TTL_SECONDS',
      7 * 24 * 60 * 60,
      60,
      31 * 24 * 60 * 60,
    ),
    authRateLimitWindowMs: boundedInteger(
      env.AUTH_RATE_LIMIT_WINDOW_MS,
      'AUTH_RATE_LIMIT_WINDOW_MS',
      15 * 60 * 1000,
      1_000,
      24 * 60 * 60 * 1000,
    ),
    authRateLimitMax: boundedInteger(env.AUTH_RATE_LIMIT_MAX, 'AUTH_RATE_LIMIT_MAX', 10, 1, 1_000),
  }
}
