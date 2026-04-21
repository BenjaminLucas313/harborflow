import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Load .env before each test file so DATABASE_URL is available
    // for integration tests.
    setupFiles: ["dotenv/config"],
  },
  resolve: {
    alias: {
      // Mirror the @/* path alias from tsconfig.json
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
