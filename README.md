# Task Workflow Test

Task Workflow Test is a Next.js App Router project used for task-based development
practice. The app currently centers on a polished Snake game with deterministic
gameplay tests, SQLite-backed leaderboard persistence, timed special foods, obstacle
islands, and a full-board win state.

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

Open [http://localhost:3000](http://localhost:3000) to play the game.

The server leaderboard uses SQLite. By default the database is created at
`.data/snake-leaderboard.sqlite`, which is ignored by git. On a VPS, set
`SNAKE_LEADERBOARD_SQLITE_PATH` to a path on durable storage. The API depends on
a small leaderboard store interface, so a future Postgres adapter can replace
the SQLite adapter without changing the client API.

## Project Map

- `src/app/page.tsx` renders the Snake game route.
- `src/components/snake-game.tsx` owns React state, browser events, timers,
  board rendering, controls, and leaderboard UI orchestration.
- `src/lib/snake-game-engine.ts` contains pure gameplay rules for movement,
  food placement, scoring, timed-food behavior, obstacles, win/loss state, and
  speed.
- `src/lib/snake-leaderboard.ts` contains shared leaderboard normalization and
  client API helpers.
- `src/lib/server/sqlite-snake-leaderboard-store.ts` contains the SQLite-backed
  leaderboard store used by `src/app/api/snake/leaderboard/route.ts`.
- `src/lib/snake-food-feedback.ts` derives pickup feedback labels from gameplay
  state transitions.
- `src/lib/*.test.ts` contains deterministic Vitest coverage for gameplay,
  leaderboard persistence, and pickup feedback behavior.

When changing gameplay rules, prefer adding or updating engine tests with
injected randomness or time. Keep browser-only concerns in the React component
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
