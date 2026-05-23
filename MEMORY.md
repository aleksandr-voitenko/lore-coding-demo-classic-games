# Project Memory

This file is compact project context for agents and maintainers. Keep public
setup and usage instructions in `README.md`; keep durable implementation
patterns and constraints here.

## Current Shape

- This is a Next.js App Router game collection. `src/app/page.tsx` renders the
  launcher route, and `src/components/game-launcher.tsx` owns the game-card menu
  plus selected-game state.
- The launcher currently exposes Classic Snake, Tetris, Breakout, Minesweeper,
  Space Invaders, Pong, 2048, and Simon.
- Each game follows a split between pure gameplay rules in `src/lib` and browser
  orchestration in React components under `src/components`.
- `src/components/game-layout.tsx` is the stable shared game UI barrel. Focused
  implementations live beside it in `game-layout-shell.tsx`,
  `game-board-actions.tsx`, `game-help-screen.tsx`, `game-abandon-dialog.tsx`,
  and `game-ui-hooks.ts`. Shared keyboard input filtering and keydown/keyup
  listener registration live in `src/components/game-input.ts`.
- shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
  `@/*` import alias. The shared button is `src/components/ui/button.tsx`.

## Game Ownership

- `src/components/*-game.tsx` files own React state, browser events, timers,
  controls, overlays, pause/resume/restart flows, and menu return behavior.
- `src/components/*-board.tsx` files render board cells, game pieces, and
  code-native game artwork for the active state.
- `src/lib/*-game-engine.ts` files own deterministic rules, scoring, progression,
  win/loss states, and state transitions.
- `src/lib/*.test.ts` contains deterministic Vitest coverage for engines,
  leaderboard behavior, API routes, SQLite persistence, and Snake pickup
  feedback. Avoid adding new `src/components/*.test.tsx` tests until the project
  has Playwright support or another accepted component/UI testing approach;
  static markup assertions have proven too fragile for new UI behavior.

## Game Modules

- Snake: `src/lib/snake-game-engine.ts`, `src/components/snake-game.tsx`,
  `src/components/snake-board.tsx`, `src/lib/snake-food-feedback.ts`.
- Tetris: `src/lib/tetris-game-engine.ts`, `src/components/tetris-game.tsx`,
  `src/components/tetris-board.tsx`.
- Breakout: `src/lib/breakout-game-engine.ts`,
  `src/components/breakout-game.tsx`, `src/components/breakout-board.tsx`.
- Minesweeper: `src/lib/minesweeper-game-engine.ts`,
  `src/components/minesweeper-game.tsx`,
  `src/components/minesweeper-board.tsx`.
- Space Invaders: `src/lib/space-invaders-game-engine.ts`,
  `src/components/space-invaders-game.tsx`,
  `src/components/space-invaders-board.tsx`.
- Pong: `src/lib/pong-game-engine.ts`, `src/components/pong-game.tsx`,
  `src/components/pong-board.tsx`.
- 2048: `src/lib/twenty-forty-eight-game-engine.ts`,
  `src/components/twenty-forty-eight-game.tsx`,
  `src/components/twenty-forty-eight-board.tsx`.
- Simon: `src/lib/simon-game-engine.ts`, `src/components/simon-game.tsx`,
  `src/components/simon-board.tsx`.

## Leaderboard

- `src/lib/leaderboard.ts` contains shared leaderboard key creation,
  normalization, ranking, pending-entry, and client API helpers.
- `src/hooks/use-game-leaderboard.ts` owns leaderboard loading, submission
  state, failure state, player-name state, slots, and pending-score completion
  for all games.
- `src/components/game-leaderboard.tsx` renders the shared top-three list and
  save-score form used by game overlays.
- `src/app/api/leaderboard/route.ts` exposes the generic leaderboard API.
- `src/lib/server/sqlite-leaderboard-store.ts` is the current server store. It
  persists entries under stable game-and-parameter keys such as
  `snake|board=19`, `tetris|board=10x20|level=3`, or
  `minesweeper|board=9x9|mines=10`.
- The default database path remains `.data/snake-leaderboard.sqlite` so existing
  Snake deployments keep their data. `GAME_LEADERBOARD_SQLITE_PATH` is the
  preferred durable VPS override; `SNAKE_LEADERBOARD_SQLITE_PATH` is still
  honored as a fallback.
- The SQLite store migrates legacy `snake_scores` rows into board-scoped
  `leaderboard_scores` keys when the generic schema initializes.
- Most games rank higher scores first. Minesweeper submits only won boards and
  ranks lower elapsed times first.
- The store boundary is intentionally small so a future Postgres adapter can
  replace SQLite without changing the client API.

## Assets

- `public/images/snake-game-card.png` contains Classic Snake menu artwork sourced
  from Clear_code's CC0 Snake game assets on OpenGameArt.
- The other launcher cards use local SVG artwork in `public/images`, named
  `<game>-game-card.svg`.
- Board artwork is generally code-native inside board components rather than
  external sprite sheets.

## Implementation Patterns

- Keep browser-only concerns in React components and reusable state rules in
  `src/lib`.
- When changing gameplay rules, add or update deterministic engine tests with
  injected randomness, time, or explicit state fixtures as needed.
- Vitest resolves the `@/*` import alias to `src/`, matching the app import
  pattern for component tests.
- Preserve existing launcher integration when adding a game: extend the launcher
  catalog, add engine tests, add focused game and board components, add menu
  artwork, and update user-facing docs if the catalog changes.
- Prefer comparing meaningful game states or structured outputs in tests over
  many isolated field assertions unless field-level assertions produce clearer
  failures.
- Keep local UI consistent with the shared game layout and shadcn button
  patterns.
- Use `shouldIgnoreGameKeyDown`, `registerGameKeyDown`, and
  `registerGameKeyUp` from `src/components/game-input.ts` for game-level global
  keyboard handlers that should ignore Help overlays, pending leaderboard entry,
  and typing targets.
- For held-key movement, keep transient key state out of React render state and
  drive movement through engine helpers on an interval until keyup/blur/modal
  cleanup. Breakout's paddle uses the pure
  `src/components/breakout-paddle-input.ts` state helper for this pattern.
- Keep `src/components/game-layout.tsx` as the stable import surface for game
  components. Put new shared layout, action, Help, dialog, or flow-hook
  implementation details in focused sibling modules so the barrel does not
  regain unrelated responsibilities.
- Pre-game parameters live on launcher cards as real select controls, while
  fixed mode/record/count metadata is kept off the cards. `GameLauncher` owns
  the selected presets and passes them into games as `initial*` props; changing
  parameters after opening a game means returning to the launcher.
- Engines that expose launcher presets keep those values in game state so
  restart, terminal-state replay, board rendering, and accessibility labels
  preserve the selected board size, target, lives, mines, alien count, or start
  level.
- Keep per-game metrics and live status details in `GameSidebar`; do not add
  separate information strips below `GameBoardStage`. Board dimensions belong in
  board accessibility labels or real settings controls rather than decorative
  visible metadata.
- Use `GameBoardStage` and `GameBoardActions` from
  `src/components/game-layout.tsx` for the right-side action rail beside game
  boards. The Back action belongs at the top of that rail and uses the shared
  Escape-to-menu handler. Realtime games provide Back, Help, Pause-or-Resume,
  and Restart, while turn-based games such as Minesweeper and 2048 provide
  Back, Help, and Restart and omit the pause action.
- Use `GameEndScreen` and `GameEndSummary` from
  `src/components/game-layout.tsx` for terminal won/lost overlays. They provide
  the shared high-contrast end-screen surface and final-result typography used
  across all games; keep per-game content limited to titles, metric labels,
  values, leaderboard forms, leaderboard panels, and action buttons.
- Use `GameHelpScreen` and `useGameHelpScreen` from
  `src/components/game-layout.tsx` for game Help overlays. Realtime games should
  pause when Help opens from an active run and resume only when Help caused the
  pause; turn-based games should block keyboard input while Help is visible.
  Controls sections use compact keyboard/mouse rows; use arrow glyphs only for
  arrow keys and text labels for other keys or pointer actions. Rules sections
  remain short bullet lists.
- Use `useGameEscapeToMenu` and `GameAbandonDialog` from
  `src/components/game-layout.tsx` for Escape-to-menu behavior. `ready` and
  terminal `lost`/`won` games return directly to the launcher; active unfinished
  games show the abandon confirmation. Realtime games pass their existing pause/
  resume callbacks with `shouldPauseBeforeConfirm` for active or paused states.
  Keep this hook disabled while Help is visible so Help owns Escape until it
  closes. Use the hook's returned `requestBackToMenu` callback for Back buttons
  so clicks and Escape follow the same direct-return or abandon-confirmation
  path.
- Keep shared Help and Escape/back-to-menu state transitions in
  `src/lib/game-ui-flow.ts`; `game-layout.tsx` hooks should apply the transition
  effects rather than reimplementing the pause/resume/dialog state machine.

## Verification Commands

- `npm test` runs deterministic Vitest coverage.
- `npm run test:coverage` runs Vitest with V8 coverage and writes reports under
  `reports/coverage/`. This is the broad all-source diagnostic report, so it
  includes currently untested interactive client orchestration.
- `npm run test:coverage:core` runs the thresholded core coverage gate and
  writes reports under `reports/coverage-core/`. It covers deterministic engines,
  server/API helpers, pure board renderers, shared input filtering, and utilities
  with minimum thresholds of statements 90%, branches 85%, functions 90%, and
  lines 90%.
- `npm run test:agent` runs Vitest with V8 coverage and writes machine-readable
  test results to `reports/vitest/results.json` and `reports/vitest/junit.xml`
  plus machine-readable coverage under `reports/coverage/`.
- `npm run typecheck` runs TypeScript without emitting.
- `npm run lint` runs ESLint.
- `npm run build` builds the Next.js app.
