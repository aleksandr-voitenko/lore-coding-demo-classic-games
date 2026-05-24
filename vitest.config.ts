import { configDefaults, defineConfig } from "vitest/config";

import { coverageBase, vitestResolve } from "./vitest.coverage.shared";

export default defineConfig({
  resolve: vitestResolve,
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      ...coverageBase,
      include: ["src/**/*.{ts,tsx}"],
      reportsDirectory: "reports/coverage",
    },
  },
});
