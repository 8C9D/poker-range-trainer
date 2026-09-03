import type { Metadata } from 'next'

import { AuthenticatedShell } from '@/components/authenticated-shell'
import { RangeEditor } from '@/components/range-editor'

export const metadata: Metadata = { title: 'Edit range' }

export default async function EditRangePage({ params }: { params: Promise<{ rangeId: string }> }) {
  const { rangeId } = await params
  return (
    <AuthenticatedShell>
      <RangeEditor rangeId={rangeId} />
    </AuthenticatedShell>
  )
}
