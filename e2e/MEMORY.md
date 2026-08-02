# E2E Memory

This file covers Playwright browser-flow coverage under `e2e/`.

## Strategy

- Playwright owns rendered browser behavior that is too user-facing or fragile
  for broad TSX markup assertions: launcher handoff, configurable parameters,
  Help/Escape flows, real keyboard/pointer input, responsive overlays, and
  leaderboard client/server integration.
- `game-layout.spec.ts` covers shared board/stats geometry, high-contrast ready
  screens, and dark app-theme game palette regressions. Dark palette checks
  compare rendered game chrome to the resolved per-game CSS variables so tests
  can tolerate browser color serialization differences.
- Keep the suite focused as a smoke/regression layer over the browser experience.
  Deterministic game rules and pure helpers belong in Vitest near `src/lib`.
- `support/app.ts` contains small route and interaction helpers such as
  `openLauncher`, `openGame`, and `selectGameParameter`.
- `support/fixtures.ts` extends Playwright with automatic console error and
  page-error collection; tests should finish with no captured browser issues.

## Local Server And Artifacts

- `playwright.config.ts` starts the Next dev server on `127.0.0.1:3100` and does
  not reuse an existing server.
- The Playwright run sets `GAME_LEADERBOARD_SQLITE_PATH` to an isolated temp
  SQLite database so local leaderboard data is not touched.
- Artifacts live under `reports/playwright/`: failure screenshots, retained
  traces/videos, and the HTML report.
- The configured project is focused Chromium with one worker. Keep this narrow
  unless a task specifically needs broader browser coverage.
- `e2e/playwright.sidecar.config.ts` is the isolated realtime-sidecar entry
  point. It starts the built sidecar on `127.0.0.1:3111`, starts Next on
  `127.0.0.1:3110` with `MULTIPLAYER_ROOM_SERVICE_URL` and
  `NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL` pointed at that sidecar, supplies the
  same test-only room-service bearer secret to both processes, and only
  discovers `e2e/sidecar/**/*.e2e.ts`.
- Sidecar e2e files intentionally use the `.e2e.ts` suffix rather than
  `.spec.ts` so `npm run test:e2e` remains the default Next-only smoke suite.
- Sidecar e2e coverage is the acceptance path for WebSocket-only live room
  delivery. The isolated sidecar suite should prove that WebSocket room events
  cover the host, guest, observer, lifecycle, and active-game delivery paths
  needed by the shared room shell and registered game adapters.
- `sidecar/pong-private-room.e2e.ts` also owns the two-account host invitation
  path because Play/Watch must stay disabled until the live party stream is
  active. It covers friendship setup, linkless Watch creation, party-code
  redaction, accessible admission help, local cancellation, external decline,
  and focus recovery when the pending action disappears asynchronously.
- `sidecar/tank-patrol-private-room.e2e.ts` covers Tank Patrol's required
  Player 1/Player 2 seat claims, authoritative Stage 1 start, both rendered
  tanks, and bidirectional held-movement delivery across two browser contexts.
- CI runs both the default `npm run test:e2e` smoke and the separate
  `npm run test:e2e:sidecar` acceptance path. Sidecar artifacts remain isolated
  under `reports/playwright-sidecar/` so failures from either suite can be
  diagnosed without merging their discovery boundaries.
