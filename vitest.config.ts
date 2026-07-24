import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run the canonical source tests. The segregated build directories
    // (public-free-build / private-pro-build) carry their own copies and are
    // validated independently with `vitest run --root <dir>`.
    include: ["src/**/*.test.ts"],
    exclude: ["public-free-build/**", "private-pro-build/**", "node_modules/**", "dist/**"],
  },
});
