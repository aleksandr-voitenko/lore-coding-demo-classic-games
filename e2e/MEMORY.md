# E2E Memory

Playwright covers rendered interaction; deterministic game rules and pure helpers
belong in nearby Vitest tests.

## Strategy and Helpers

- Cover launcher/parameter handoff, Help/Escape, real keyboard/pointer input,
  responsive overlays, and client/server leaderboard flows. Keep this a focused
  browser regression layer.
- `support/app.ts` provides `openLauncher`, `openGame`, and parameter selection.
  `support/fixtures.ts` automatically collects console/page errors and requires
  an empty issue list at test completion.
- `game-layout.spec.ts` owns board/stats geometry, ready-screen contrast, and
  dark-theme palettes. Compare rendered chrome to resolved per-game CSS variables
  using `support/css-color.ts` to tolerate browser serialization differences.
- `space-invaders-revenge-warning.spec.ts` and
  `space-invaders-muzzle-flash.spec.ts` use seeded runs and controlled clocks to
  verify warning/shield coexistence, marker/weapon placement, two-second warning
  expiry and release-time flashes, pause/resume, reduced motion, and phone layout.
  They attach screenshots to the report. Wait for Running before advancing the
  test clock: asynchronous run creation must first install the game timer
  (Lore `LC-20260913-CD7A`).

## Isolated Suites

- Root `playwright.config.ts` starts a fresh Next dev server on `127.0.0.1:3100`.
  The sidecar config, `e2e/playwright.sidecar.config.ts`, builds/starts the emitted
  sidecar on `3111` and Next on `3110`, wired with the internal room-service URL,
  browser WebSocket URL, and matching test-only bearer credentials.
- Both use Chromium, one worker, no existing-server reuse, and a unique temporary
  SQLite path via `GAME_LEADERBOARD_SQLITE_PATH`; preserve local user data.
- Default `npm run test:e2e` discovers `.spec.ts`; sidecar tests deliberately use
  `sidecar/**/*.e2e.ts` and run via `npm run test:e2e:sidecar`.
  Live host/guest/observer, lifecycle, and active-game WebSocket acceptance belongs
  in the sidecar suite.
- `sidecar/pong-private-room.e2e.ts` also owns cross-game/social party journeys:
  Play/Watch availability requires a live stream; invitation code redaction,
  accessible eligibility help, cancellation/decline, and busy-state acceptance
  gating must hold. Acceptance covers lost committed responses, repeated
  acceptance-in-progress retries, membership-only reacquisition, and local
  handoff failure/retry without another server acceptance.
- That journey preserves watcher membership and ordinal player seats through
  Pong/Asteroids replacements, then verifies live play and same-account reload.
  Preserve local heading/successor focus, remote announcements without focus
  theft, repeated identical Restart announcements, and heading fallback when a
  focused action disappears, including queue promotion without a layout change
  (Lore `LC-20260803-JRNY`).
- `sidecar/tank-patrol-private-room.e2e.ts` verifies both required player seats,
  Stage 1 start, two rendered tanks, and bidirectional authoritative held movement.
- `e2e/playwright.sidecar-latency.config.ts` adds the configurable latency proxy
  through `npm run test:e2e:sidecar:latency`; the Next/sidecar/proxy ports are
  `3120`/`3121`/`3122`. Keep its artifacts separate too.
- Reports live in `reports/playwright/`, `reports/playwright-sidecar/`, and
  `reports/playwright-sidecar-latency/`: HTML reports, failure screenshots, and
  retained failure traces/videos. CI runs the default and sidecar suites and
  uploads both report directories on failure; see `.github/MEMORY.md`.
