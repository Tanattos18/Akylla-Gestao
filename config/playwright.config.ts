import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de interface (Fase 6 · 6.2): fluxos principais no navegador contra a
 * web (3000) e a API (3001) já no ar. A CI sobe os dois antes de rodar.
 * Cada execução cria uma empresa própria (tests/e2e/global-setup.ts).
 */
export default defineConfig({
  testDir: "../tests/e2e",
  globalSetup: "../tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  outputDir: "../test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Local: E2E_BROWSER_CHANNEL=chromium usa o Chromium completo do
        // Playwright quando o "headless shell" não foi baixado.
        ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
      },
    },
  ],
});
