import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// `findBy*`/`waitFor` have their own 1s budget, separate from the Vitest
// testTimeout. The practice overlay mounts behind a lazy import, which can take
// longer than that when the suite runs workers in parallel on a busy machine.
configure({ asyncUtilTimeout: 5000 })

// Unmount React trees between tests so the jsdom DOM doesn't leak across cases.
afterEach(() => {
  cleanup()
})
