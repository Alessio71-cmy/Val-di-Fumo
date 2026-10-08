import { defineConfig, devices } from '@playwright/test';

/**
 * Test end-to-end su Chromium (l'unico browser disponibile in questo ambiente).
 * NON sostituiscono i test su dispositivi fisici (iPhone/Safari, secondo telefono, modalità aereo reale, GPS reale):
 * vedi docs/TEST-REPORT.md per la distinzione fra test automatici, simulazioni e prove su dispositivo.
 *
 * Il server è `vite preview` sulla cartella dist/ (build di produzione, con service worker).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    serviceWorkers: 'allow',
    trace: 'off',
    screenshot: 'off',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
