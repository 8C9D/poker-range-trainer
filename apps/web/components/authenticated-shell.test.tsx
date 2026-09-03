import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser, logout } from '@/lib/api-client'

import { AuthenticatedShell } from './authenticated-shell'

let pathname = '/app/library'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getCurrentUser: vi.fn(), logout: vi.fn() }
})

const currentUser = vi.mocked(getCurrentUser)
const logoutRequest = vi.mocked(logout)

describe('AuthenticatedShell', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    pathname = '/app/library'
  })

  it('renders loading, ready content without fake ranges, and signs out with the API', async () => {
    let resolveUser: (value: Awaited<ReturnType<typeof getCurrentUser>>) => void
    currentUser.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUser = resolve
      }),
    )
    logoutRequest.mockResolvedValueOnce({ data: { success: true } })
    const user = userEvent.setup()
    render(<AuthenticatedShell>Library content</AuthenticatedShell>)
    expect(screen.getByText('Loading your practice room…')).toBeInTheDocument()
    resolveUser!({
      data: {
        authenticated: true,
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'player@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    })
    await screen.findByText('Library content')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/app/library')
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/app/today')
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '/app/progress')
    // Account is the one section that has nothing behind it yet.
    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument()
    expect(screen.getByText('Account')).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logoutRequest).toHaveBeenCalledOnce()
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('marks the open section, including the pages that live under it', async () => {
    const ready = {
      data: {
        authenticated: true,
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'player@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    } as const

    pathname = '/app/today'
    currentUser.mockResolvedValueOnce(ready)
    const { unmount } = render(<AuthenticatedShell>Today content</AuthenticatedShell>)
    await screen.findByText('Today content')
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current')
    unmount()

    // A range page is still the Library section, not a fourth destination.
    pathname = '/app/library/7a7e6f3e-17be-4b69-a31b-1f902417c560'
    currentUser.mockResolvedValueOnce(ready)
    render(<AuthenticatedShell>Range content</AuthenticatedShell>)
    await screen.findByText('Range content')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current')
  })

  it('offers a retry after a session load failure', async () => {
    currentUser.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      data: { authenticated: false },
    })
    const user = userEvent.setup()
    render(<AuthenticatedShell>Library content</AuthenticatedShell>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your session.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(currentUser).toHaveBeenCalledTimes(2))
  })

  it('renders unauthenticated and logout failure states without discarding the ready shell', async () => {
    currentUser.mockResolvedValueOnce({ data: { authenticated: false } })
    const { unmount } = render(<AuthenticatedShell />)
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    unmount()

    currentUser.mockResolvedValueOnce({
      data: {
        authenticated: true,
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'player@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    })
    logoutRequest.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<AuthenticatedShell>Library content</AuthenticatedShell>)
    await screen.findByText('Library content')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
    expect(screen.getByText('Library content')).toBeInTheDocument()
  })
})
