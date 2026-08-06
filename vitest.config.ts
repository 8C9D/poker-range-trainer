import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// jsdom + Testing Library for component tests; the React plugin handles JSX/TSX
// transforms (this config does not inherit vite.config.ts plugins).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The mobile/ Expo app carries its own Jest toolchain; keep its tests out of
    // the web Vitest run so they are never picked up here. archived/ holds
    // features cut from v1 whose code is expected not to compile.
    exclude: [...configDefaults.exclude, 'mobile/**', 'archived/**'],
    // The 13x13-grid screens render hundreds of cells per userEvent step, which can
    // exceed the 5s default when the full suite runs workers in parallel (they pass
    // in isolation). Give every test more headroom rather than sprinkling per-test
    // timeouts.
    testTimeout: 20000,
  },
})
