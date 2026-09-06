import type { RouteObject } from 'react-router'

import { HomePage } from '@/home'

/** Every URL the app answers, in one place. */
export const routes: RouteObject[] = [{ path: '/', element: <HomePage /> }]
