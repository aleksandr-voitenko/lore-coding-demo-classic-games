# Library Memory

This file covers deterministic game engines and shared source logic under
`src/lib/`.

## Engine Boundaries

- `*-game-engine.ts` files own deterministic rules, scoring, progression,
  win/loss states, launcher preset normalization, and state transitions.
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
  Keys use stable game-and-parameter segments such as `snake|board=19` or
  `tetris|board=10x20|level=3`.
- `game-ui-flow.ts` owns pure Help and Escape/back-to-menu state transitions.
  React hooks in `src/components/game-ui-hooks.ts` should delegate decisions here
  and only apply effects such as pause, resume, or back-to-menu callbacks.
- `snake-food-feedback.ts` keeps Snake pickup feedback metadata outside both the
  engine and React rendering code.
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
