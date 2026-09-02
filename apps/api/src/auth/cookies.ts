import type { CookieOptions, Request, Response } from 'express'

import type { ApiConfig } from '../config.js'

/** Fixed host-only cookie names shared with the same-host frontend. */
export const SESSION_COOKIE_NAME = 'prt_session'
export const CSRF_COOKIE_NAME = 'prt_csrf'

export function parseCookies(request: Pick<Request, 'headers'>): ReadonlyMap<string, string> {
  const header = request.headers.cookie
  const values = new Map<string, string>()
  if (!header) return values
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name && !values.has(name)) values.set(name, value)
  }
  return values
}

function cookieScope(config: ApiConfig, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge,
  }
}

export function setAuthCookies(
  response: Response,
  config: ApiConfig,
  tokens: { sessionToken: string; csrfToken: string },
): void {
  const maxAge = config.sessionTtlSeconds * 1000
  response.cookie(SESSION_COOKIE_NAME, tokens.sessionToken, cookieScope(config, maxAge))
  response.cookie(CSRF_COOKIE_NAME, tokens.csrfToken, {
    ...cookieScope(config, maxAge),
    httpOnly: false,
  })
}

/** Clear using the same host-only scope and attributes used to set the cookies. */
export function clearAuthCookies(response: Response, config: ApiConfig): void {
  const options = cookieScope(config, 0)
  response.clearCookie(SESSION_COOKIE_NAME, options)
  response.clearCookie(CSRF_COOKIE_NAME, { ...options, httpOnly: false })
}
