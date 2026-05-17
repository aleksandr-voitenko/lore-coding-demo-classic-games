# Task Workflow Test

Task Workflow Test is a Next.js App Router project used for task-based development
practice. The app opens to a card-based game menu and currently includes a
polished Snake game with deterministic gameplay tests, SQLite-backed leaderboard
persistence, timed special foods, obstacle islands, and a full-board win state,
plus a classic Tetris game with tested falling-block rules and line clearing.

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
- `src/components/snake-game.tsx` owns React state, browser events, timers,
  board rendering, controls, menu return, and leaderboard UI orchestration.
- `src/components/tetris-game.tsx` owns React state, browser events, timers,
  board rendering, controls, and menu return for Classic Tetris.
- `public/images/snake-game-card.png` contains the Classic Snake menu artwork,
  sourced from Clear_code's CC0 Snake game assets on OpenGameArt.
- `public/images/tetris-game-card.svg` contains the Classic Tetris menu
  artwork.
- `src/lib/snake-game-engine.ts` contains pure gameplay rules for movement,
  food placement, scoring, timed-food behavior, obstacles, win/loss state, and
  speed.
- `src/lib/tetris-game-engine.ts` contains pure gameplay rules for tetromino
  movement, rotation, locking, line clears, scoring, levels, and loss state.
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
