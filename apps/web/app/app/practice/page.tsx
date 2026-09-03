import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { PracticeHost } from '@/components/practice-host'

export const metadata: Metadata = { title: 'Practice' }

/**
 * The drill reads its whole setup from the query string, so `PracticeHost`
 * calls `useSearchParams` and has to sit behind a Suspense boundary: the shell
 * around it can still be prerendered while the drill itself renders on the client.
 */
export default function PracticePage() {
  return (
    <AuthenticatedShell>
      <Suspense
        fallback={
          <p className="library-state" aria-busy="true">
            Loading this drill…
          </p>
        }
      >
        <PracticeHost />
      </Suspense>
    </AuthenticatedShell>
  )
}
