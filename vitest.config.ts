import { defineConfig } from 'vitest/config'

// Pure domain logic for this slice runs without a DOM.
export default defineConfig({
  test: {
    environment: 'node',
  },
})
