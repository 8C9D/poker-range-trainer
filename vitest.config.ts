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
    // the web Vitest run so they are never picked up here.
    exclude: [...configDefaults.exclude, 'mobile/**'],
  },
})
