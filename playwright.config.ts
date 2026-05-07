import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',

  // Tests share the dev database — must run sequentially.
  workers: 1,
  fullyParallel: false,

  // Retry on CI; no retries locally so failures are obvious immediately.
  retries: process.env.CI ? 2 : 0,

  // Fail the suite if any test is accidentally left as test.only.
  forbidOnly: !!process.env.CI,

  timeout: 30_000,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Increase navigation timeout for Next.js dev server cold starts.
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Reuse a running dev server locally; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
