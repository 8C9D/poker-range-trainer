import type { Metadata } from 'next'

import { AccountView } from '@/components/account-view'
import { AuthenticatedShell } from '@/components/authenticated-shell'

export const metadata: Metadata = { title: 'Account' }

export default function AccountPage() {
  return (
    <AuthenticatedShell>
      <AccountView />
    </AuthenticatedShell>
  )
}
