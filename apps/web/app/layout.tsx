import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import './globals.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'Rangecraft — Poker Range Trainer',
    template: '%s — Rangecraft',
  },
  description: 'Build and drill confident Texas Hold’em preflop ranges.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
