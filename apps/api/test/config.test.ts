import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

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
      sessionTtlSeconds: 7 * 24 * 60 * 60,
      authRateLimitWindowMs: 15 * 60 * 1000,
      authRateLimitMax: 10,
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
    [{ DATABASE_URL: databaseUrl, SESSION_TTL_SECONDS: '59' }, 'SESSION_TTL_SECONDS'],
    [{ DATABASE_URL: databaseUrl, SESSION_TTL_SECONDS: '2678401' }, 'SESSION_TTL_SECONDS'],
    [{ DATABASE_URL: databaseUrl, AUTH_RATE_LIMIT_WINDOW_MS: '999' }, 'AUTH_RATE_LIMIT_WINDOW_MS'],
    [
      { DATABASE_URL: databaseUrl, AUTH_RATE_LIMIT_WINDOW_MS: '86400001' },
      'AUTH_RATE_LIMIT_WINDOW_MS',
    ],
    [{ DATABASE_URL: databaseUrl, AUTH_RATE_LIMIT_MAX: '0' }, 'AUTH_RATE_LIMIT_MAX'],
    [{ DATABASE_URL: databaseUrl, AUTH_RATE_LIMIT_MAX: '1001' }, 'AUTH_RATE_LIMIT_MAX'],
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

  it('serves the API alone unless WEB_DIST_DIR names a built bundle', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'web-dist-'))
    expect(loadConfig({ DATABASE_URL: databaseUrl }).webDistDir).toBeUndefined()
    expect(loadConfig({ DATABASE_URL: databaseUrl, WEB_DIST_DIR: ' ' }).webDistDir).toBeUndefined()
    expect(() => loadConfig({ DATABASE_URL: databaseUrl, WEB_DIST_DIR: dist })).toThrow(
      'WEB_DIST_DIR',
    )
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html>')
    expect(loadConfig({ DATABASE_URL: databaseUrl, WEB_DIST_DIR: dist }).webDistDir).toBe(dist)
    expect(
      loadConfig({
        DATABASE_URL: databaseUrl,
        WEB_DIST_DIR: path.relative(process.cwd(), dist),
      }).webDistDir,
    ).toBe(dist)
  })

  it('accepts bounded session and authentication limiter overrides', () => {
    expect(
      loadConfig({
        DATABASE_URL: databaseUrl,
        SESSION_TTL_SECONDS: '60',
        AUTH_RATE_LIMIT_WINDOW_MS: '1000',
        AUTH_RATE_LIMIT_MAX: '1',
      }),
    ).toMatchObject({
      sessionTtlSeconds: 60,
      authRateLimitWindowMs: 1_000,
      authRateLimitMax: 1,
    })
  })
})
