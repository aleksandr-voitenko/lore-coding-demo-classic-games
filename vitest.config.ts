import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      reportsDirectory: "reports/coverage",
      reporter: [
        "text-summary",
        "json",
        "json-summary",
        "lcovonly",
        "cobertura",
      ],
      reportOnFailure: true,
    },
  },
});
