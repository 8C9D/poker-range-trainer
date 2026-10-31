import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer as createTlsServer } from 'node:https'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPostgresPool, requireDatabaseUrl } from '@poker-range-trainer/database'

/**
 * The production shape, run for real: the compiled API serving the built bundle
 * with NODE_ENV=production, behind a TLS-terminating proxy, on a database made by
 * the compiled migrate and seed commands. TLS is what makes the production-only
 * paths reachable at all: Secure cookies, the CSP's upgrade-insecure-requests,
 * and the https-only API_ORIGINS rule.
 *
 * DATABASE_URL names a server this may create and drop one database on.
 */
export const TLS_PORT = 4443
const API_PORT = 3101

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const fromRoot = (relative: string) => path.join(repoRoot, relative)

function databaseUrlFor(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function selfSignedCertificate(): { key: Buffer; cert: Buffer; cleanup: () => void } {
  const directory = mkdtempSync(path.join(tmpdir(), 'prt-e2e-tls-'))
  const keyPath = path.join(directory, 'key.pem')
  const certPath = path.join(directory, 'cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore' },
  )
  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  }
}

/** What a platform load balancer does: terminate TLS and say who was really calling. */
function startTlsProxy(key: Buffer, cert: Buffer) {
  const server = createTlsServer({ key, cert }, (incoming, outgoing) => {
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: API_PORT,
        method: incoming.method,
        path: incoming.url,
        headers: {
          ...incoming.headers,
          'x-forwarded-for': incoming.socket.remoteAddress ?? '127.0.0.1',
          'x-forwarded-proto': 'https',
        },
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers)
        response.pipe(outgoing)
      },
    )
    upstream.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502)
      outgoing.end()
    })
    incoming.pipe(upstream)
  })
  server.listen(TLS_PORT, '127.0.0.1')
  return server
}

function runToCompletion(script: string, env: NodeJS.ProcessEnv): void {
  execFileSync(process.execPath, [fromRoot(script)], { env, stdio: 'inherit' })
}

function exited(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => child.once('exit', resolve))
}

const adminUrl = requireDatabaseUrl()
const databaseName = `poker_range_trainer_e2e_${randomUUID().replaceAll('-', '')}`
const databaseUrl = databaseUrlFor(adminUrl, databaseName)

const admin = createPostgresPool(adminUrl)
await admin.query(`create database "${databaseName}"`)

const databaseEnv = { ...process.env, DATABASE_URL: databaseUrl }
runToCompletion('packages/database/dist/migrate.js', databaseEnv)
runToCompletion('packages/database/dist/seed.js', databaseEnv)

const certificate = selfSignedCertificate()
const proxy = startTlsProxy(certificate.key, certificate.cert)
const api = spawn(process.execPath, [fromRoot('apps/api/dist/server.js')], {
  stdio: 'inherit',
  env: {
    ...databaseEnv,
    NODE_ENV: 'production',
    PORT: String(API_PORT),
    API_ORIGINS: `https://localhost:${TLS_PORT}`,
    TRUST_PROXY: '1',
    WEB_DIST_DIR: fromRoot('apps/web/dist'),
    LOG_LEVEL: 'warn',
    // Every worker shares one address, and a suite is not a brute-force attack.
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '1000',
  },
})
const apiExit = exited(api)

let stopping = false
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return
  stopping = true
  proxy.close()
  proxy.closeAllConnections()
  api.kill(signal)
  const code = await apiExit
  certificate.cleanup()
  await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1', [
    databaseName,
  ])
  await admin.query(`drop database if exists "${databaseName}"`)
  await admin.end()
  // Playwright ignores this process's exit code, so the log is what a person sees.
  if (code !== 0) console.error(`The API did not shut down cleanly: exit code ${code}.`)
}

void apiExit.then((code) => {
  if (stopping) return
  console.error(`The API exited on its own with code ${code}.`)
  void stop('SIGTERM')
})
process.once('SIGTERM', () => void stop('SIGTERM'))
process.once('SIGINT', () => void stop('SIGINT'))
