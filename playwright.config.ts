import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    retries: process.env.CI ? 2 : 0,
    testDir: './e2e',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: 'pnpm dev',
              reuseExistingServer: !process.env.CI,
              url: baseURL,
          },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
})