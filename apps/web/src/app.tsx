import { useRoutes } from 'react-router'

import { routes } from '@/routes'

/** The whole client: one explicit route table, rendered wherever the URL says. */
export function App() {
  return useRoutes(routes)
}
