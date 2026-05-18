# Task Workflow Test

Task Workflow Test is a Next.js App Router project used for task-based development
practice. The app opens to a card-based game menu and currently includes a
polished Snake game with deterministic gameplay tests, SQLite-backed leaderboard
persistence, timed special foods, obstacle islands, and a full-board win state,
plus classic Tetris, Breakout, Minesweeper, and Space Invaders games with tested
falling-block, paddle, ball, brick, minefield, flagging, reveal, invader
formation, cannon, projectile, scoring, and end-state rules.

## Stack

- Node.js 22.22.2
- TypeScript
- Next.js App Router
- React with the React Compiler enabled
- SQLite through `better-sqlite3`
- Tailwind CSS v4
- shadcn/ui
- Vitest
- ESLint

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to choose a game from the
menu.

The server leaderboard uses SQLite. By default the database is created at
`.data/snake-leaderboard.sqlite`, which is ignored by git. On a VPS, set
`SNAKE_LEADERBOARD_SQLITE_PATH` to a path on durable storage. The API depends on
a small leaderboard store interface, so a future Postgres adapter can replace
the SQLite adapter without changing the client API.

## Project Map

- `src/app/page.tsx` renders the game launcher route.
- `src/components/game-launcher.tsx` owns the game-card menu and selected game
  state.
- `src/components/snake-game.tsx` owns Snake React state, browser events,
  timers, controls, overlays, menu return, and composition of focused Snake UI
  pieces.
- `src/components/snake-board.tsx` renders the Snake board cells, active food
  labels, and pickup feedback.
- `src/hooks/use-snake-leaderboard.ts` owns Snake leaderboard loading,
  submission state, failure state, and pending-score completion.
- `src/components/tetris-game.tsx` owns Tetris React state, browser events,
  timers, controls, overlays, and menu return for Classic Tetris.
- `src/components/tetris-board.tsx` renders the Tetris board cells and exports
  the shared tetromino cell classes used by Tetris previews.
- `src/components/breakout-game.tsx` owns Breakout React state, browser events,
  timers, controls, overlays, and menu return for Classic Breakout.
- `src/components/breakout-board.tsx` renders Breakout bricks, ball, paddle, and
  board state using code-native game artwork.
- `src/components/minesweeper-game.tsx` owns Minesweeper React state, browser
  events, elapsed-time tracking, reveal/flag controls, overlays, and menu return
  for Classic Minesweeper.
- `src/components/minesweeper-board.tsx` renders the Minesweeper cell grid,
  covered/revealed/flagged/mine states, and context-menu flagging behavior.
- `src/components/space-invaders-game.tsx` owns Space Invaders React state,
  browser events, timers, controls, overlays, and menu return for Classic Space
  Invaders.
- `src/components/space-invaders-board.tsx` renders the Space Invaders
  formation, player cannon, shot, base line, and board state using code-native
  game artwork.
- `src/components/game-layout.tsx` and `src/components/game-input.ts` contain
  shared game layout primitives and keyboard input helpers.
- `public/images/snake-game-card.png` contains the Classic Snake menu artwork,
  sourced from Clear_code's CC0 Snake game assets on OpenGameArt.
- `public/images/tetris-game-card.svg` contains the Classic Tetris menu
  artwork.
- `public/images/breakout-game-card.svg` contains the Classic Breakout menu
  artwork.
- `public/images/minesweeper-game-card.svg` contains the Classic Minesweeper
  menu artwork.
- `public/images/space-invaders-game-card.svg` contains the Classic Space
  Invaders menu artwork.
- `src/lib/snake-game-engine.ts` contains pure gameplay rules for movement,
  food placement, scoring, timed-food behavior, obstacles, win/loss state, and
  speed.
- `src/lib/tetris-game-engine.ts` contains pure gameplay rules for tetromino
  movement, rotation, locking, line clears, scoring, levels, and loss state.
- `src/lib/breakout-game-engine.ts` contains pure gameplay rules for paddle
  movement, ball collisions, brick removal, scoring, lives, and win/loss state.
- `src/lib/minesweeper-game-engine.ts` contains pure gameplay rules for
  delayed mine placement, safe first reveals, adjacent counts, flood reveal,
  flagging, and win/loss state.
- `src/lib/space-invaders-game-engine.ts` contains pure gameplay rules for
  player movement, firing, shot advancement, invader marching, edge drops,
  scoring, and win/loss state.
- `src/lib/snake-leaderboard.ts` contains shared leaderboard normalization and
  client API helpers.
- `src/lib/server/sqlite-snake-leaderboard-store.ts` contains the SQLite-backed
  leaderboard store used by `src/app/api/snake/leaderboard/route.ts`.
- `src/lib/snake-food-feedback.ts` derives pickup feedback labels from gameplay
  state transitions.
- `src/lib/*.test.ts` contains deterministic Vitest coverage for gameplay,
  leaderboard persistence, and pickup feedback behavior.

When changing gameplay rules, prefer adding or updating engine tests with
injected randomness or time. Keep browser-only concerns in the React components
and reusable state rules in `src/lib`.

## Checks

Run the deterministic test suite:

```bash
npm test
```

Run the standard project checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## UI Components

shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
`@/*` import alias. Add components with:

```bash
npx shadcn@latest add <component>
```

The shared button component is available at `src/components/ui/button.tsx`.
