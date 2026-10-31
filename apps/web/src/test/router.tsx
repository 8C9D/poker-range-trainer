import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { useContext, useState, createContext, type ReactElement, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'

const RenderedUi = createContext<ReactNode>(null)

function RoutedUi() {
  return useContext(RenderedUi)
}

/** One router for the life of the render, so `rerender` keeps its location. */
function Host({ path, children }: { path: string; children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: <RoutedUi /> }], { initialEntries: [path] }),
  )
  return (
    <RenderedUi.Provider value={children}>
      <RouterProvider router={router} />
    </RenderedUi.Provider>
  )
}

/**
 * Render `ui` inside a router that believes it is at `path`, the way the route
 * table mounts it. A data router, as in the app, so `Link`, `useLocation` and
 * `useBlocker` all have what they need.
 */
export function renderAt(
  ui: ReactElement,
  path: string,
  options: RenderOptions = {},
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <Host path={path}>{children}</Host>
  }
  return render(ui, { ...options, wrapper: Wrapper })
}
