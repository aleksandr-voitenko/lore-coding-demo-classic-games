import { defineConfig } from "vitest/config";

import { coverageBase, vitestResolve } from "./vitest.coverage.shared";

export default defineConfig({
  resolve: vitestResolve,
  test: {
    coverage: {
      ...coverageBase,
      include: ["src/**/*.{ts,tsx}"],
      reportsDirectory: "reports/coverage",
    },
  },
});
