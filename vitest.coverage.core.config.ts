import { configDefaults, defineConfig } from "vitest/config";

import { coverageBase, vitestResolve } from "./vitest.coverage.shared";

const coreCoverageInclude = [
  "src/lib/**/*.{ts,tsx}",
  "src/app/api/**/*.{ts,tsx}",
  "src/components/*-board.tsx",
  "src/components/game-input.ts",
];

const coreCoverageThresholds = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
};

export default defineConfig({
  resolve: vitestResolve,
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      ...coverageBase,
      include: coreCoverageInclude,
      reportsDirectory: "reports/coverage-core",
      thresholds: coreCoverageThresholds,
    },
  },
});
