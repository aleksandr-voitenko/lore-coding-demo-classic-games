# GitHub Memory

This file covers repository automation under `.github/`.

## CI Workflow

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main` when
  code or build-affecting files change.
- Documentation-only changes are ignored by CI through `paths-ignore` for
  Markdown files, `docs/**`, and `LICENSE`.
- The first Ubuntu job uses `.node-version`, installs with `npm ci`, then runs
  `npm run build`, `npm run lint`, `npm run typecheck`,
  `npm run check:deps`, `npm run check:unused`,
  `npm run test:coverage:core`, installs Playwright Chromium with Linux
  dependencies, then runs `npm run test:e2e` and the isolated
  `npm run test:e2e:sidecar` suite. The sidecar command rebuilds and starts the
  emitted production sidecar before exercising its browser flows.
- The Docker publish job depends on the full build/check/test job and only runs
  for successful pushes to `main`, never for pull requests. It logs in to
  Docker Hub with `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, uses
  `DOCKERHUB_IMAGE` as the image name, uses QEMU and Buildx to build
  `linux/amd64` and `linux/arm64`, and publishes `latest`, `main`, and short SHA
  tags as multi-platform manifests.
- The workflow cancels older in-progress runs for the same ref and uses read-only
  repository permissions.
- On failure, the workflow uploads `reports/playwright` and
  `reports/playwright-sidecar` so browser traces, videos, screenshots, and HTML
  reports from either suite are recoverable.
