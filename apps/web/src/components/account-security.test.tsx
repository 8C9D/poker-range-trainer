import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiClientError, changePassword, deleteAccount, signOutEverywhere } from '@/lib/api-client'
import { renderAt } from '@/test/router'

import { AccountSecurity } from './account-security'

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    signOutEverywhere: vi.fn(),
  }
})

const change = vi.mocked(changePassword)
const remove = vi.mocked(deleteAccount)
const signOut = vi.mocked(signOutEverywhere)

function fieldProblem(field: string, message: string) {
  return new ApiClientError('problem', 'Request validation failed.', {
    status: 422,
    problem: {
      type: 'about:blank',
      title: 'Validation failed',
      status: 422,
      code: 'VALIDATION_FAILED',
      requestId: '7a7e6f3e-17be-4b69-a31b-1f902417c560',
      issues: [{ path: [field], code: 'custom', message }],
    },
  })
}

function open() {
  renderAt(<AccountSecurity />, '/app/account')
  return userEvent.setup()
}

describe('AccountSecurity', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('changes the password, clears the form, and says who was signed out', async () => {
    change.mockResolvedValueOnce({ data: { otherSessionsRevoked: 2 } })
    const user = open()
    await user.type(screen.getByLabelText('Current password'), 'old-password-1234')
    await user.type(screen.getByLabelText('New password'), 'new-password-5678')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password changed. 2 other sessions were signed out.',
    )
    expect(change).toHaveBeenCalledWith({
      currentPassword: 'old-password-1234',
      newPassword: 'new-password-5678',
    })
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('puts a wrong current password on its field and keeps the form', async () => {
    change.mockRejectedValueOnce(fieldProblem('currentPassword', 'That password is not correct.'))
    const user = open()
    await user.type(screen.getByLabelText('Current password'), 'wrong-password-1')
    await user.type(screen.getByLabelText('New password'), 'new-password-5678')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.')
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('New password')).toHaveValue('new-password-5678')
  })

  it('signs out everywhere and leaves for the sign-in page', async () => {
    signOut.mockResolvedValueOnce({ data: { sessionsRevoked: 3 } })
    const user = open()
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login', { replace: true }))
  })

  it('stays put when signing out everywhere fails', async () => {
    signOut.mockRejectedValueOnce(new Error('offline'))
    const user = open()
    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you out.')
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeEnabled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('deletes only with the password and the acknowledgement', async () => {
    remove.mockResolvedValueOnce({ data: { success: true } })
    const user = open()
    const button = screen.getByRole('button', { name: 'Delete account' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('Your password'), 'my-password-1234')
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /permanently deletes my account/ }))
    expect(button).toBeEnabled()

    await user.click(button)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(remove).toHaveBeenCalledWith({ password: 'my-password-1234', confirm: true })
  })

  it('keeps the account screen when the deletion password is wrong', async () => {
    remove.mockRejectedValueOnce(fieldProblem('password', 'That password is not correct.'))
    const user = open()
    await user.type(screen.getByLabelText('Your password'), 'wrong-password-1')
    await user.click(screen.getByRole('checkbox', { name: /permanently deletes my account/ }))
    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not correct.')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeEnabled()
  })
})
