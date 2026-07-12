import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the four labeled destinations and the content', () => {
    render(
      <AppShell route={{ screen: 'today' }}>
        <p>Hello content</p>
      </AppShell>,
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('href', '#/today')
    expect(within(nav).getByRole('link', { name: 'Library' })).toHaveAttribute('href', '#/library')
    expect(within(nav).getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '#/progress')
    expect(within(nav).getByRole('link', { name: 'Account' })).toHaveAttribute('href', '#/account')
    expect(screen.getByText('Hello content')).toBeInTheDocument()
  })

  it('marks the active destination with aria-current', () => {
    render(
      <AppShell route={{ screen: 'progress' }}>
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  it('keeps Library active on a range page route', () => {
    render(
      <AppShell route={{ screen: 'range', id: 'abc', tab: 'edit' }}>
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks nothing active on the legacy route', () => {
    render(
      <AppShell route={{ screen: 'legacy' }}>
        <p>content</p>
      </AppShell>,
    )
    for (const name of ['Today', 'Library', 'Progress', 'Account']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })
})
