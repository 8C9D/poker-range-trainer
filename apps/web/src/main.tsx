import '@/lib/zod-config'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import '@/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { routes } from '@/routes'

const container = document.getElementById('root')
if (!container) throw new Error('index.html has no #root element to mount into.')

// A data router, because only a data router can hold a navigation back while a
// screen with unsaved work asks first (`useUnsavedGuard`).
const router = createBrowserRouter(routes)

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
