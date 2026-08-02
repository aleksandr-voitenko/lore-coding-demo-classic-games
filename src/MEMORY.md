# Source Memory

This file covers source-wide architecture under `src/`. More detailed local
rules live in child memory files for `src/app`, `src/components`, `src/lib`, and
`src/lib/server`.

## Source Boundaries

- `src/app/` owns Next.js App Router routes, global CSS import, metadata, and API
  route entry points. See `src/app/MEMORY.md`.
- `src/components/` owns client-side game orchestration, board rendering, shared
  game layout primitives, launcher UI, leaderboard UI, keyboard input helpers,
  and shadcn UI wrappers. See `src/components/MEMORY.md`.
- `src/hooks/` is for reusable React state hooks that are shared across game
  components. It contains `use-game-leaderboard.ts`, which centralizes client
  leaderboard loading, submission, failure, player-name, slot, and pending-score
  state for all games; `use-current-user.tsx`, which owns the signed-in user
  context and auth actions; and `use-game-session.ts`, which records signed-in
  play sessions without moving timing logic into deterministic engines.
  `use-social-overview.ts` retains the last valid signed-in social graph while
  generation-scoping results to the current account, coalesces passive polling
  and focus refreshes, and polls only while the document is visible.
  `use-social-presence.ts` projects launcher surface state into one volatile
  per-document lease through the shared presence controller.
- `src/lib/` owns deterministic game engines and pure/shared logic. See
  `src/lib/MEMORY.md`.
- `src/lib/server/` owns Node-only server storage adapters and parsing helpers.
  See `src/lib/server/MEMORY.md`.

## Game Module Pattern

- Each game keeps reusable rules in `src/lib/<game>-game-engine.ts`, browser
  orchestration in `src/components/<game>-game.tsx`, and board rendering in
  `src/components/<game>-board.tsx`.
- Engine modules expose launcher preset constants/options when the launcher needs
  configurable parameters such as board size, difficulty, target
  score, lives, alien count, start level, or win target.
- Snake has additional shared pickup feedback logic in
  `src/lib/snake-food-feedback.ts`. Keep that effect metadata pure so game
  components can render feedback without moving animation rules into the engine.
- Use the `@/*` alias for source imports. Vitest resolves the same alias to
  `src/`, matching the app import pattern.

## Source-Wide Conventions

- Keep game state transitions deterministic and testable in `src/lib`; components
  should apply DOM events, timers, focus, images, and accessibility labels around
  those transitions.
- Do not add parallel shared UI or leaderboard paths when the existing
  `game-layout`, `game-input`, `leaderboard`, and `use-game-leaderboard`
  surfaces fit.
- Profile stats must be recorded through the shared game-session hook and server
  store. Keep guest play as a no-op for profile stats, and do not trust client
  submissions for user identity; server routes derive the user from the session
  cookie. A terminal-to-nonterminal transition starts a new hook run; late
  terminal request settlements from the previous run must not replace the new
  run's completed session id or submission guard. Name/password auth still uses
  normalized display-name keys, so duplicate account checks and profile
  ownership must remain server-enforced.
- Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong, Simon, 2048,
  Asteroids, and Tank Patrol single-player replay saves are profile-scoped. The
  live solo game components record replay events unconditionally after a
  server-issued run, but `/api/replays/<game>` requires a signed-in session
  before saving or downloading the latest replay for supported replay games.
  Server-authoritative private-room sessions are volatile and must not feed
  these solo replay or leaderboard paths.
- Prefer meaningful whole-state or structured-output assertions in tests. Use
  field-by-field assertions only when they produce clearer failures.
- Prefer Playwright for new rendered UI behavior such as launcher handoff,
  Help/Escape flows, real keyboard/pointer input, responsive overlays, and
  leaderboard client/server integration. Add component tests mainly for static
  markup or pure board-renderer behavior.
