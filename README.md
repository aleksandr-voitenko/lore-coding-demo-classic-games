# Task Workflow Test

Task Workflow Test is a Next.js App Router game collection used for task-based
development practice. It opens to a card-based menu with Classic Snake, Tetris,
Breakout, Minesweeper, Space Invaders, Pong, 2048, and Simon.

## Features

- Classic Snake with SQLite-backed leaderboard persistence, timed special foods,
  obstacle islands, and a full-board win state.
- Classic Tetris, Breakout, Minesweeper, Space Invaders, Pong, 2048, and Simon
  with deterministic gameplay rules and polished browser controls.
- Closable in-game Help screens with controls and rules for every game.
- Local game-card artwork for every game in the launcher.

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

## Persistent Storage

The server leaderboard uses SQLite. By default the database is created at
`.data/snake-leaderboard.sqlite`, which is ignored by git. On a VPS, set
`SNAKE_LEADERBOARD_SQLITE_PATH` to a path on durable storage.

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
