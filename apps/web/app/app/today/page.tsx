import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { TodayView } from '@/components/today-view'

export const metadata: Metadata = { title: 'Today' }

export default function TodayPage() {
  return (
    <AuthenticatedShell>
      <TodayView />
    </AuthenticatedShell>
  )
}
