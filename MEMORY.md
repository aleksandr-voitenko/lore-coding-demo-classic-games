# Project Memory

This file is compact repository-wide context for agents and maintainers. Keep
public setup and usage instructions in `README.md`; keep durable implementation
patterns and constraints in scoped `MEMORY.md` files near the code they describe.

## Repository Shape

- This is a Next.js App Router classic game collection. The launcher currently
  exposes Classic Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong,
  2048, and Simon.
- `src/` owns application source. See `src/MEMORY.md` for App Router,
  component, hook, library, and server boundaries.
- `public/images/` owns launcher key art and the sprite-backed board assets.
  See `public/images/MEMORY.md`.
- `e2e/` owns rendered browser-flow coverage. See `e2e/MEMORY.md`.
- `.github/` owns CI workflow behavior. See `.github/MEMORY.md`.

## Major Boundaries

- The root route is the game launcher: `src/app/page.tsx` renders
  `GameLauncher`, and `src/components/game-launcher.tsx` owns the game-card
  catalog plus selected-game state.
- Games split browser orchestration from reusable rules: `src/components/*-game.tsx`
  owns React state and browser events, `src/components/*-board.tsx` renders the
  board, and `src/lib/*-game-engine.ts` owns deterministic game state transitions.
- Shared game UI is exported through `src/components/game-layout.tsx`; focused
  implementation modules live beside it in `src/components/`.
- Leaderboards cross source folders: shared key/ranking/client helpers live in
  `src/lib/leaderboard.ts`, the React state hook lives in `src/hooks/`, shared
  UI lives in `src/components/`, the API route lives in `src/app/api/`, and the
  current server store lives in `src/lib/server/`.

## Cross-Cutting Constraints

- Keep browser-only concerns in React components and reusable gameplay/state
  rules in `src/lib`.
- Preserve launcher integration when adding or changing a game: update the
  launcher catalog, deterministic engine tests, focused game and board
  components, menu artwork, and user-facing docs when the public catalog changes.
- Pre-game parameters live on launcher cards as real select controls. Games
  receive selected values as `initial*` props and keep those values in game state
  so restart, terminal replay, board rendering, accessibility labels, and
  leaderboard keys remain scoped to the chosen parameters.
- Leaderboard keys are game-and-parameter scoped. Most games rank higher scores
  first; Minesweeper submits only won boards and ranks lower elapsed times first.
- The default leaderboard database path remains `.data/snake-leaderboard.sqlite`
  for existing Snake deployments. `GAME_LEADERBOARD_SQLITE_PATH` is the preferred
  durable override, with `SNAKE_LEADERBOARD_SQLITE_PATH` still honored as a
  fallback.
- shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
  `@/*` import alias. The shared button is `src/components/ui/button.tsx`.

## Verification

- `npm test` runs deterministic Vitest coverage.
- `npm run test:coverage:core` runs the thresholded core coverage gate for
  deterministic engines, server/API helpers, pure board renderers, shared input
  filtering, and utilities.
- `npm run test:e2e` runs the focused Chromium Playwright smoke suite. Browser
  flow details live in `e2e/MEMORY.md`.
- `npm run typecheck`, `npm run lint`, and `npm run build` are the standard
  TypeScript, ESLint, and Next build checks.
- CI repeats the build, static checks, core coverage gate, and Playwright suite
  for code-affecting changes. See `.github/MEMORY.md`.
