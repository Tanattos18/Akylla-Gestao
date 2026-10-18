import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    fileParallelism: false,
    setupFiles: ["tests/helpers/setup-env.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Fase 6 · 6.1: cobertura dos services/controllers da API
    // (`npm run test:coverage`). Os mínimos ficam logo abaixo do medido em
    // 2026-10-18 (linhas 93,7%): servem de trava contra regressão no lugar
    // do diff-cover. Meta do roteiro: 70% de linhas.
    coverage: {
      provider: "v8",
      include: ["apps/api/src/**/*.service.ts", "apps/api/src/**/*.controller.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: { lines: 90, statements: 88, functions: 93, branches: 72 },
    },
  },
});
