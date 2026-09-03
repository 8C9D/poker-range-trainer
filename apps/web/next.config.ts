import type { NextConfig } from 'next'

const developmentApiTarget = 'http://localhost:3001'
const production = process.env.NODE_ENV === 'production'

function apiProxyTarget(): string {
  const value = process.env.API_PROXY_TARGET ?? developmentApiTarget
  let target: URL
  try {
    target = new URL(value)
  } catch {
    throw new Error('API_PROXY_TARGET must be an absolute http(s) URL.')
  }
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('API_PROXY_TARGET must be an origin-only http(s) URL without credentials.')
  }
  return target.origin
}

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // Rewrites proxy responses directly, including Express's Set-Cookie headers.
    return [{ source: '/api/:path*', destination: `${apiProxyTarget()}/api/:path*` }]
  },
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ]
    if (production) {
      // Next's static App Router runtime emits inline bootstrap data and styles;
      // no nonce is claimed or configured here.
      headers.push(
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      )
    }
    return [
      {
        source: '/:path*',
        headers,
      },
    ]
  },
}

export default nextConfig
