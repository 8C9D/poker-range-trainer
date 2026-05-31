import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { AuthPanel } from './AuthPanel'

const signedInSession = {
  user: { id: 'u1', email: 'a@b.c' },
} as unknown as Session

describe('AuthPanel when cloud is unconfigured', () => {
  it('shows the local-only note and no form', () => {
    render(<AuthPanel isCloudConfigured={false} session={null} />)
    expect(screen.getByText(/local-only mode/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})

describe('AuthPanel signed out', () => {
  it('signs in with the entered credentials', async () => {
    const signIn = vi.fn().mockResolvedValue(signedInSession)
    render(<AuthPanel isCloudConfigured session={null} signIn={signIn} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Password'), 'pw')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(signIn).toHaveBeenCalledWith('a@b.c', 'pw')
  })

  it('signs up with the entered credentials', async () => {
    const signUp = vi.fn().mockResolvedValue(null)
    render(<AuthPanel isCloudConfigured session={null} signUp={signUp} />)
    await userEvent.type(screen.getByLabelText('Email'), 'new@b.c')
    await userEvent.type(screen.getByLabelText('Password'), 'pw')
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }))
    expect(signUp).toHaveBeenCalledWith('new@b.c', 'pw')
  })

  it('surfaces an error when sign in fails', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('bad creds'))
    render(<AuthPanel isCloudConfigured session={null} signIn={signIn} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('bad creds'))
  })
})

describe('AuthPanel signed in', () => {
  it('shows the email and signs out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    render(<AuthPanel isCloudConfigured session={signedInSession} signOut={signOut} />)
    expect(screen.getByText(/Signed in as a@b\.c/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })
})
