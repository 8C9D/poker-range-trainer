import { defineConfig, devices } from '@playwright/test'

const baseURL = 'https://localhost:4443'
const ci = process.env.CI !== undefined

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'], grep: /@cross-browser/ },
    { name: 'webkit', use: devices['Desktop Safari'], grep: /@cross-browser/ },
    { name: 'phone', use: devices['iPhone 13'], grep: /@cross-browser/ },
  ],
  webServer: {
    command: 'node stack.ts',
    url: `${baseURL}/api/v1/health/ready`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 20_000 },
  },
})
