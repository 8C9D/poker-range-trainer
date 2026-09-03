import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { ProgressView } from '@/components/progress-view'

export const metadata: Metadata = { title: 'Progress' }

export default function ProgressPage() {
  return (
    <AuthenticatedShell>
      <ProgressView />
    </AuthenticatedShell>
  )
}
