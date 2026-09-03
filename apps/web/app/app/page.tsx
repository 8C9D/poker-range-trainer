import { redirect } from 'next/navigation'

/** The practice room opens on Today: what is due, and one action to start it. */
export default function AppPage() {
  redirect('/app/today')
}
