import { defineConfig } from "vitest/config";

// Runs against the LOCAL Supabase stack (npm run setup). Env from .env.local.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/test/integration-setup.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
