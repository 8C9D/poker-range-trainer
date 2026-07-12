import type { ReactNode } from 'react'
import type { AppRoute } from './routes'
import { routeHash } from './routes'
import './AppShell.css'

type Destination = 'today' | 'library' | 'progress' | 'account'

const ICONS: Record<Destination, ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
      <circle cx="12" cy="14.5" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" />
    </svg>
  ),
}

const DESTINATIONS: Array<{ key: Destination; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'library', label: 'Library' },
  { key: 'progress', label: 'Progress' },
  { key: 'account', label: 'Account' },
]

/** Which rail destination a route belongs to (range pages live under Library). */
function activeDestination(route: AppRoute): Destination | null {
  switch (route.screen) {
    case 'today':
      return 'today'
    case 'library':
    case 'newRange':
    case 'range':
      return 'library'
    case 'progress':
      return 'progress'
    case 'account':
      return 'account'
    default:
      return null
  }
}

interface AppShellProps {
  route: AppRoute
  children: ReactNode
}

export function AppShell({ route, children }: AppShellProps) {
  const active = activeDestination(route)
  return (
    <div className="coach-shell">
      <nav className="coach-rail" aria-label="Main navigation">
        {DESTINATIONS.map(({ key, label }) => (
          <a
            key={key}
            className="coach-rail-item"
            href={routeHash({ screen: key })}
            aria-current={active === key ? 'page' : undefined}
          >
            {ICONS[key]}
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <main className="coach-main">{children}</main>
    </div>
  )
}
