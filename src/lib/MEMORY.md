# Library Memory

This file covers deterministic game engines and shared source logic under
`src/lib/`.

## Engine Boundaries

- `*-game-engine.ts` files own deterministic rules, scoring, progression,
  win/loss states, launcher preset normalization, and state transitions.
- Keep `*-game-engine.ts` as the public facade imported by components and tests.
  Large engines may split implementation internals under `src/lib/<game>/`
  when cohesive subsystems outgrow one file, but smaller engines should stay
  single-file until the added navigation cost is justified.
- Space Invaders uses `src/lib/space-invaders/` internals behind
  `space-invaders-game-engine.ts`: `types.ts`, `constants.ts`, `formation.ts`,
  `hitboxes.ts`, `projectiles.ts`, `scoring.ts`, plus shared geometry/random
  helpers. Keep lifecycle orchestration in the facade unless a later refactor
  can move it without obscuring cross-system behavior.
- Engines that expose launcher presets keep those values in game state so
  restart, terminal replay, board rendering, accessibility labels, and leaderboard
  keys preserve the selected board size, target, lives, mines, alien count, or
  start level.
- Inject randomness, time, and explicit state fixtures into engine helpers when
  needed for deterministic behavior and tests.
- Keep browser events, timers, audio/visual effects, and DOM concerns outside
  engines. Components should schedule and render; engines should calculate.

## Shared Logic

- `leaderboard.ts` owns leaderboard key creation, normalization, sorting,
  top-three ranking, pending-entry calculation, and client fetch/submit helpers.
  Keys use stable game-and-parameter segments such as `snake|mode=levels` or
  `tetris|board=10x20|level=3`.
- `user-profile.ts` owns shared auth, user, game-session, and profile-stat
  types; display-name/password/game-id/session-id validation; and client helpers
  for `/api/auth/*`, `/api/me`, and `/api/game-sessions`.
- `game-replay.ts` owns shared replay run ids, seed normalization, deterministic
  replay random creation, API path/client helpers, and base replay payload
  validation for all future game-specific replay modules.
- `snake-replay.ts`, `tetris-replay.ts`, `breakout-replay.ts`,
  `minesweeper-replay.ts`, and `twenty-forty-eight-replay.ts` own game-specific
  replay payload contracts, event parsing, and deterministic replay event
  application. Replay payloads record engine events such as direction changes,
  advances, timed-food lifecycle events, Tetris moves, rotations, soft drops,
  hard drops, Breakout starts/advances/paddle movement, Minesweeper reveals and
  flag toggles, and 2048 move directions rather than video or full board
  snapshots.
- `game-catalog.ts` owns the pure playable-game id and label catalog plus
  server-safe card artwork metadata and versioned artwork URLs. Launcher config
  should enrich these entries with descriptions and parameters locally, while
  `src/components/game-launcher-playables.ts` keeps the dynamic playable
  component mapping; server pages should use catalog helpers instead of
  importing launcher config.
- `game-ui-flow.ts` owns pure Help and Escape/back-to-menu state transitions.
  React hooks in `src/components/game-ui-hooks.ts` should delegate decisions here
  and only apply effects such as pause, resume, or back-to-menu callbacks.
- `snake-food-feedback.ts` keeps Snake pickup feedback metadata outside both the
  engine and React rendering code.
- Snake pickup progression order lives in
  `SNAKE_PICKUP_INTRODUCTION_ORDER` in `snake-game-engine.ts`; timed-food kinds
  and introduction thresholds are derived from that single order. Level
  progression applies an additional level-number cap so level 1 only has red
  apples, level 2 can unlock yellow apples, level 3 can unlock purple diamonds,
  and later levels continue through the same order.
- Snake level generation in `snake-game-engine.ts` owns the board-size formula,
  level-scaled obstacle coverage, door placement, key spawning threshold,
  closed-door collision loss, and open-door transition. Entering an open door
  creates the next level and preserves only the score from the previous level.
- Snake initial hazard safety reserves the starting snake, first red food,
  first-food route, immediate head neighbors, and the full row to the right of
  the initial head before door and obstacle generation. This keeps the default
  rightward start lane free of generated collision hazards.
- `utils.ts` provides shared utility glue such as class-name merging for shadcn
  and Tailwind components.

## Tests

- `src/lib/*.test.ts` contains deterministic Vitest coverage for engines, shared
  leaderboard behavior, utility helpers, Snake pickup feedback, and pure UI-flow
  transitions.
- When changing gameplay rules, add or update deterministic tests with injected
  randomness, time, or explicit state fixtures as needed.
- Prefer comparing meaningful game states or structured outputs over many
  isolated field assertions unless field-level assertions make failures clearer.
- Core coverage includes `src/lib/**/*.{ts,tsx}` with thresholded coverage. Keep
  pure logic reachable from Vitest instead of hiding important behavior behind
  DOM-only component flows.
