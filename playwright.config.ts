import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;
// Use the real GPU on Windows dev machines; CI runners have none and fall back to software GL (slow).
const gpuArgs = process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : [];
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: process.env.CI ? 90_000 : 60_000,
  workers: process.env.CI ? 1 : 2,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run build && npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args: gpuArgs } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], launchOptions: { args: gpuArgs } } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
});
