import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import '@/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from '@/app'

const container = document.getElementById('root')
if (!container) throw new Error('index.html has no #root element to mount into.')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
