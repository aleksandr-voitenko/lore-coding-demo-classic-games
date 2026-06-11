module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Keep the source dependency graph acyclic.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Source imports must resolve through TypeScript, Next, or npm.",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: "lib-not-to-ui-or-app",
      severity: "error",
      comment:
        "Shared library code owns pure rules and helpers; React UI and App Router code compose it.",
      from: {
        path: "^src/lib/",
      },
      to: {
        path: ["^src/components/", "^src/hooks/", "^src/app/"],
      },
    },
    {
      name: "shared-lib-not-to-server",
      severity: "error",
      comment:
        "Pure/shared library modules must not depend on Node-only server storage adapters.",
      from: {
        path: "^src/lib/",
        pathNot: "^src/lib/server/",
      },
      to: {
        path: "^src/lib/server/",
      },
    },
    {
      name: "client-not-to-server-lib",
      severity: "error",
      comment:
        "Components and hooks run in browser-owned surfaces and must not import server storage helpers.",
      from: {
        path: "^src/(components|hooks)/",
      },
      to: {
        path: "^src/lib/server/",
      },
    },
    {
      name: "ui-not-to-app",
      severity: "error",
      comment:
        "Components and hooks stay reusable; App Router modules compose them instead of being imported back.",
      from: {
        path: "^src/(components|hooks)/",
      },
      to: {
        path: "^src/app/",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-bundled",
        "npm-no-pkg",
      ],
    },
    includeOnly: "^src",
    skipAnalysisNotInRules: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
