import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { RangeEditor } from '@/components/range-editor'

export const metadata: Metadata = { title: 'New range' }

export default function NewRangePage() {
  return (
    <AuthenticatedShell>
      <RangeEditor />
    </AuthenticatedShell>
  )
}
