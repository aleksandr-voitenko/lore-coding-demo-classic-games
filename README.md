# Lore Coding Demo

Lore Coding Demo is a Next.js App Router game collection used to demonstrate
[agentic-lore-coding](https://github.com/aleksandr-voitenko/agentic-lore-coding).
It opens to a card-based menu with Classic Snake, Tetris, Breakout, Minesweeper,
Space Invaders, Pong, 2048, and Simon.

## Features

- Eight classic games with deterministic gameplay rules and polished browser
  controls.
- Classic Snake includes timed special foods, obstacle islands, and a full-board
  win state.
- SQLite-backed, parameter-scoped top-three leaderboards for every game.
  Minesweeper ranks fastest clears; the other games rank higher scores.
- Closable in-game Help screens and Escape-to-menu abandon confirmations.
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
- Playwright
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

Leaderboards use SQLite and store records under game-and-parameter keys such as
`snake|board=19` or `tetris|board=10x20|level=3`.

The default database path is `.data/snake-leaderboard.sqlite`, kept for
compatibility with existing Snake deployments. On a VPS, set
`GAME_LEADERBOARD_SQLITE_PATH` to durable storage. Existing
`SNAKE_LEADERBOARD_SQLITE_PATH` deployments are honored as a fallback.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Run the deterministic Vitest suite. |
| `npm run test:agent` | Write JSON/JUnit results and coverage under `reports/`. |
| `npm run test:coverage` | Generate broad all-source coverage under `reports/coverage/`. |
| `npm run test:coverage:core` | Run the thresholded core coverage gate under `reports/coverage-core/`. |
| `npm run test:e2e:install` | Install the Chromium browser used by Playwright. |
| `npm run test:e2e` | Run the focused Chromium Playwright smoke suite. |
| `npm run test:e2e:headed` | Run the Playwright suite in a visible browser. |
| `npm run test:e2e:ui` | Open Playwright's interactive test runner. |
| `npm run typecheck` | Run TypeScript without emitting. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Build the Next.js app. |

## UI Components

shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
`@/*` import alias. Add components with:

```bash
npx shadcn@latest add <component>
```
