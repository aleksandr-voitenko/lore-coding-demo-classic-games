# GitHub Memory

This file covers repository automation under `.github/`.

## CI Workflow

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main` when
  code or build-affecting files change.
- Documentation-only changes are ignored by CI through `paths-ignore` for
  Markdown files, `docs/**`, and `LICENSE`.
- The single Ubuntu job uses `.node-version`, installs with `npm ci`, then runs
  `npm run build`, `npm run lint`, `npm run typecheck`,
  `npm run test:coverage:core`, installs Playwright Chromium with Linux
  dependencies, and runs `npm run test:e2e`.
- The workflow cancels older in-progress runs for the same ref and uses read-only
  repository permissions.
- On failure, the workflow uploads `reports/playwright` so browser traces,
  videos, screenshots, and the HTML report are recoverable.
