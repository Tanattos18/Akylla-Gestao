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
  },
});
