import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['node', 'import', 'default'],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
})
