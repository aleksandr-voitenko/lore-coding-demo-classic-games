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
- Shared UI primitives live in `src/components/game-layout.tsx`; shared keyboard
  input filtering lives in `src/components/game-input.ts`.
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
  feedback.

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

- `src/lib/snake-leaderboard.ts` contains shared leaderboard normalization and
  client API helpers.
- `src/hooks/use-snake-leaderboard.ts` owns Snake leaderboard loading,
  submission state, failure state, player-name state, slots, and pending-score
  completion.
- `src/app/api/snake/leaderboard/route.ts` exposes the Snake leaderboard API.
- `src/lib/server/sqlite-snake-leaderboard-store.ts` is the current server store.
  The default database path is `.data/snake-leaderboard.sqlite`; set
  `SNAKE_LEADERBOARD_SQLITE_PATH` for durable VPS storage.
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
- Preserve existing launcher integration when adding a game: extend the launcher
  catalog, add engine tests, add focused game and board components, add menu
  artwork, and update user-facing docs if the catalog changes.
- Prefer comparing meaningful game states or structured outputs in tests over
  many isolated field assertions unless field-level assertions produce clearer
  failures.
- Keep local UI consistent with the shared game layout and shadcn button
  patterns.
- Use `GameBoardStage` and `GameBoardActions` from
  `src/components/game-layout.tsx` for the right-side action rail beside game
  boards. Realtime games provide Help/Pause-or-Resume/Restart, while turn-based
  games such as Minesweeper and 2048 omit the pause action.
- Use `GameHelpScreen` and `useGameHelpScreen` from
  `src/components/game-layout.tsx` for game Help overlays. Realtime games should
  pause when Help opens from an active run and resume only when Help caused the
  pause; turn-based games should block keyboard input while Help is visible.
  Controls sections use compact keyboard/mouse rows; use arrow glyphs only for
  arrow keys and text labels for other keys or pointer actions. Rules sections
  remain short bullet lists.
- Use `useGameEscapeToMenu` and `GameAbandonDialog` from
  `src/components/game-layout.tsx` for Escape-to-menu behavior. `ready` games
  return directly to the launcher, non-`ready` games show the abandon
  confirmation, and realtime games pass their existing pause/resume callbacks
  with `shouldPauseBeforeConfirm` for active or paused states. Keep this hook
  disabled while Help is visible so Help owns Escape until it closes.

## Verification Commands

- `npm test` runs deterministic Vitest coverage.
- `npm run typecheck` runs TypeScript without emitting.
- `npm run lint` runs ESLint.
- `npm run build` builds the Next.js app.
