import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'

export const metadata: Metadata = { title: 'Practice room' }

export default function AppPage() {
  return <AuthenticatedShell />
}
