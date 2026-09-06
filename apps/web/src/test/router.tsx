import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

/**
 * Render `ui` inside a router that believes it is at `path`, the way the route
 * table mounts it, so `Link`, `useLocation` and friends have their context.
 */
export function renderAt(
  ui: ReactElement,
  path: string,
  options: RenderOptions = {},
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  }
  return render(ui, { ...options, wrapper: Wrapper })
}
