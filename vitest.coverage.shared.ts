import { fileURLToPath } from "node:url";

export const vitestResolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
};

export const coverageBase = {
  provider: "v8" as const,
  exclude: ["src/**/*.test.{ts,tsx}"],
  reporter: [
    "text-summary",
    "json",
    "json-summary",
    "lcovonly",
    "cobertura",
  ],
  reportOnFailure: true,
};
