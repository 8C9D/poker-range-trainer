import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/app'
import { getCurrentUser } from '@/lib/api-client'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...actual, getCurrentUser: vi.fn() }
})

const currentUser = vi.mocked(getCurrentUser)
const rangeId = '7a7e6f3e-17be-4b69-a31b-1f902417c560'

function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  afterEach(cleanup)

  beforeEach(() => {
    currentUser.mockResolvedValue({ data: { authenticated: false } })
  })

  it('keeps the public URLs and their titles', async () => {
    open('/')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Know your ranges before the pressure is on.',
      }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Rangecraft — Poker Range Trainer')
    cleanup()

    open('/login')
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(document.title).toBe('Sign in — Rangecraft')
    cleanup()

    open('/register')
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(document.title).toBe('Create account — Rangecraft')
  })

  it('opens the practice room on Today and keeps every section URL behind the shell', async () => {
    const sections: ReadonlyArray<[string, string]> = [
      ['/app', 'Today'],
      ['/app/today', 'Today'],
      ['/app/library', 'Range library'],
      ['/app/library/new', 'New range'],
      [`/app/library/${rangeId}`, 'Edit range'],
      [`/app/practice?range=${rangeId}`, 'Practice'],
      ['/app/progress', 'Progress'],
      ['/app/account', 'Account'],
    ]
    for (const [path, title] of sections) {
      open(path)
      // Signed out, every section shows the shell's sign-in card and nothing else.
      expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
      expect(document.title).toBe(`${title} — Rangecraft`)
      cleanup()
    }
  })

  it('answers an unknown address with a way back', () => {
    open('/nowhere/in/particular')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/')
    expect(document.title).toBe('Page not found — Rangecraft')
  })
})
