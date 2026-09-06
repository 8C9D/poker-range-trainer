import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError, getCurrentUser, login, register } from '@/lib/api-client'
import { renderAt } from '@/test/router'

import { AuthForm } from './auth-form'

const navigate = vi.fn()

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getCurrentUser: vi.fn(), login: vi.fn(), register: vi.fn() }
})

const currentUser = vi.mocked(getCurrentUser)
const loginRequest = vi.mocked(login)
const registerRequest = vi.mocked(register)

describe('AuthForm', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    currentUser.mockResolvedValue({ data: { authenticated: false } })
  })

  it('shows server field errors and offers an accessible password visibility control', async () => {
    const user = userEvent.setup()
    loginRequest.mockRejectedValueOnce(
      new ApiClientError('problem', 'Request validation failed.', {
        problem: {
          type: 'https://poker-range-trainer.dev/problems/validation-failed',
          title: 'Validation failed',
          status: 422,
          requestId: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          code: 'VALIDATION_FAILED',
          issues: [
            { path: ['email'], code: 'invalid_format', message: 'Email is invalid.' },
            { path: ['password'], code: 'too_small', message: 'Password is too short.' },
          ],
        },
      }),
    )
    renderAt(<AuthForm mode="login" />, '/login')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())

    const password = screen.getByLabelText('Password')
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(screen.getByLabelText('Email address'), 'player@example.test')
    await user.type(password, 'password12345')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is invalid.')).toBeInTheDocument()
    expect(screen.getByText('Password is too short.')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('-hint'),
    )
  })

  it('redirects authenticated visitors and after a successful sign in', async () => {
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
    const { unmount } = renderAt(<AuthForm mode="login" />, '/login')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', { replace: true }))
    unmount()

    currentUser.mockResolvedValueOnce({ data: { authenticated: false } })
    loginRequest.mockResolvedValueOnce({
      data: {
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'player@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    })
    const user = userEvent.setup()
    renderAt(<AuthForm mode="login" />, '/login')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), 'player@example.test')
    await user.type(screen.getByLabelText('Password'), 'password12345')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', { replace: true }))
  })

  it('handles registration, general network errors, and pending submission state', async () => {
    let resolveLogin: (value: Awaited<ReturnType<typeof login>>) => void
    loginRequest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    const user = userEvent.setup()
    renderAt(<AuthForm mode="login" />, '/login')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), 'player@example.test')
    await user.type(screen.getByLabelText('Password'), 'password12345')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(loginRequest).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Sign in…' })).toBeDisabled()
    resolveLogin!({
      data: {
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'player@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', { replace: true }))
    cleanup()

    loginRequest.mockRejectedValueOnce(
      new ApiClientError(
        'network',
        'We could not reach the server. Check your connection and retry.',
      ),
    )
    renderAt(<AuthForm mode="login" />, '/login')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled())
    await user.type(screen.getByLabelText('Email address'), 'player@example.test')
    await user.type(screen.getByLabelText('Password'), 'password12345')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the server')
    cleanup()

    registerRequest.mockResolvedValueOnce({
      data: {
        user: {
          id: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
          email: 'new@example.test',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      },
    })
    renderAt(<AuthForm mode="register" />, '/register')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(),
    )
    await user.type(screen.getByLabelText('Email address'), 'new@example.test')
    await user.type(screen.getByLabelText('Password'), 'password12345')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(registerRequest).toHaveBeenCalledOnce())
  })
})
