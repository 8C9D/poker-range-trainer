import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['node', 'import', 'default'],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.integration.ts', 'src/**/*.integration.test.ts'],
  },
})
