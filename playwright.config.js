import { defineConfig, devices } from '@playwright/test';

// E2E smoke tests only — "does the app boot and render," not integration
// coverage (that's supabase/tests/*.sql for the backend, Vitest for /lib
// and hooks). Every Supabase call this suite's pages make is mocked at the
// network layer (see e2e/smoke.spec.js) — this never touches the linked
// project. `npm run build` must be run before this config's webServer
// starts (a separate CI step, see ci.yml's e2e job) with
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY set to any placeholder values —
// supabaseClient.js throws at import time if they're unset at all, but
// their actual value is otherwise unused since no real request ever
// reaches a server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // The build itself is a separate CI step, not chained here — chaining
  // `npm run build && npm run preview` as one webServer command crashed
  // outright in local testing (a native memory-allocation failure spawning
  // it as a single compound command), and splitting it is also just
  // clearer: a build failure and a preview-server failure are different
  // problems, worth seeing as distinct steps.
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
