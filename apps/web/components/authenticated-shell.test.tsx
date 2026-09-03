import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser, logout } from '@/lib/api-client'

import { AuthenticatedShell } from './authenticated-shell'

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
    render(<AuthenticatedShell />)
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
    await screen.findByText('Your training space is ready')
    expect(screen.getByText(/saved range library will connect next/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logoutRequest).toHaveBeenCalledOnce()
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers a retry after a session load failure', async () => {
    currentUser.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      data: { authenticated: false },
    })
    const user = userEvent.setup()
    render(<AuthenticatedShell />)
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
    render(<AuthenticatedShell />)
    await screen.findByText('Your training space is ready')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
    expect(screen.getByText('Your training space is ready')).toBeInTheDocument()
  })
})
