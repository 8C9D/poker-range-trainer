import { describe, expect, it } from 'vitest'

import { loadConfig } from '../src/config.js'

const databaseUrl = 'postgresql://user:password@localhost:5432/poker'

describe('loadConfig', () => {
  it('applies safe development defaults', () => {
    expect(loadConfig({ DATABASE_URL: databaseUrl })).toMatchObject({
      nodeEnv: 'development',
      port: 3001,
      frontendOrigins: ['http://localhost:5173'],
      logLevel: 'info',
      trustProxy: false,
      rateLimitWindowMs: 60_000,
      rateLimitMax: 100,
    })
  })

  it.each([
    [{}, 'DATABASE_URL is required'],
    [{ DATABASE_URL: databaseUrl, NODE_ENV: 'staging' }, 'NODE_ENV'],
    [{ DATABASE_URL: databaseUrl, PORT: '0' }, 'PORT'],
    [{ DATABASE_URL: databaseUrl, DATABASE_URL2: 'ignored', LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
    [{ DATABASE_URL: databaseUrl, API_ORIGINS: '*' }, 'wildcard'],
    [{ DATABASE_URL: databaseUrl, API_ORIGINS: 'https://example.com/path' }, 'exact'],
    [{ DATABASE_URL: databaseUrl, RATE_LIMIT_MAX: '10001' }, 'RATE_LIMIT_MAX'],
  ])('rejects invalid config %#', (env, message) => {
    expect(() => loadConfig(env)).toThrow(message)
  })

  it('requires explicit hardened production values', () => {
    expect(() => loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: 'production' })).toThrow(
      'TRUST_PROXY',
    )
    expect(() =>
      loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: 'production', TRUST_PROXY: 'true' }),
    ).toThrow('API_ORIGINS')
    expect(() =>
      loadConfig({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        API_ORIGINS: 'http://app.example.com',
      }),
    ).toThrow('https')
    expect(
      loadConfig({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        API_ORIGINS: 'https://app.example.com',
      }).trustProxy,
    ).toBe(1)
  })
})
