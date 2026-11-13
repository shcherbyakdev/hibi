import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Integration tests need the local stack: npm run test:integration.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
