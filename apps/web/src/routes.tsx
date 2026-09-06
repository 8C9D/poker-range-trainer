import type { ReactNode } from 'react'
import { Link, Navigate, useParams, type RouteObject } from 'react-router'

import { AccountView } from '@/components/account-view'
import { AuthForm } from '@/components/auth-form'
import { AuthenticatedShell } from '@/components/authenticated-shell'
import { PracticeHost } from '@/components/practice-host'
import { ProgressView } from '@/components/progress-view'
import { RangeEditor } from '@/components/range-editor'
import { RangeLibrary } from '@/components/range-library'
import { TodayView } from '@/components/today-view'
import { HomePage } from '@/home'
import { useDocumentTitle } from '@/lib/document-title'

interface PageProps {
  title?: string
  children: ReactNode
}

/** A routed page: sets the tab title, renders its content. */
function Page({ title, children }: PageProps) {
  useDocumentTitle(title)
  return children
}

/**
 * A page of the practice room: the same, inside the authenticated shell. Every
 * route mounts its own shell, as the Next pages did, so the session is checked
 * whenever a section opens.
 */
function AppPage({ title, children }: PageProps) {
  useDocumentTitle(title)
  return <AuthenticatedShell>{children}</AuthenticatedShell>
}

function EditRangePage() {
  const { rangeId } = useParams<'rangeId'>()
  return rangeId === undefined ? <NotFoundPage /> : <RangeEditor rangeId={rangeId} />
}

function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <main className="state-page">
      <section className="state-card">
        <h1>Page not found</h1>
        <p>There is nothing at this address.</p>
        <Link className="button button-primary" to="/">
          Back to the start
        </Link>
      </section>
    </main>
  )
}

/** Every URL the app answers, in one place. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Page>
        <HomePage />
      </Page>
    ),
  },
  {
    path: '/login',
    element: (
      <Page title="Sign in">
        <AuthForm mode="login" />
      </Page>
    ),
  },
  {
    path: '/register',
    element: (
      <Page title="Create account">
        <AuthForm mode="register" />
      </Page>
    ),
  },
  {
    path: '/app',
    children: [
      // The practice room opens on Today: what is due, and one action to start it.
      { index: true, element: <Navigate to="/app/today" replace /> },
      {
        path: 'today',
        element: (
          <AppPage title="Today">
            <TodayView />
          </AppPage>
        ),
      },
      {
        path: 'library',
        element: (
          <AppPage title="Range library">
            <RangeLibrary />
          </AppPage>
        ),
      },
      {
        path: 'library/new',
        element: (
          <AppPage title="New range">
            <RangeEditor />
          </AppPage>
        ),
      },
      {
        path: 'library/:rangeId',
        element: (
          <AppPage title="Edit range">
            <EditRangePage />
          </AppPage>
        ),
      },
      {
        path: 'practice',
        element: (
          <AppPage title="Practice">
            <PracticeHost />
          </AppPage>
        ),
      },
      {
        path: 'progress',
        element: (
          <AppPage title="Progress">
            <ProgressView />
          </AppPage>
        ),
      },
      {
        path: 'account',
        element: (
          <AppPage title="Account">
            <AccountView />
          </AppPage>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]
