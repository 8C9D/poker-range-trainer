import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { RangeLibrary } from '@/components/range-library'

export const metadata: Metadata = { title: 'Range library' }

export default function LibraryPage() {
  return (
    <AuthenticatedShell>
      <RangeLibrary />
    </AuthenticatedShell>
  )
}
