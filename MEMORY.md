# Project Memory

This file is compact repository-wide context for agents and maintainers. Keep
public setup and usage instructions in `README.md`; keep durable implementation
patterns and constraints in scoped `MEMORY.md` files near the code they describe.

## Repository Shape

- This is a Next.js App Router classic game collection. The launcher currently
  exposes Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong,
  2048, Simon, and Asteroids.
- `src/` owns application source. See `src/MEMORY.md` for App Router,
  component, hook, library, and server boundaries.
- `public/images/` owns launcher key art and the sprite-backed board assets.
  See `public/images/MEMORY.md`.
- `e2e/` owns rendered browser-flow coverage. See `e2e/MEMORY.md`.
- `scripts/` owns repository-local development tooling, including the
  dependency-free Agentic Lore Coding validator. See `scripts/MEMORY.md`.
- `.github/` owns CI workflow behavior. See `.github/MEMORY.md`.
- `Dockerfile` owns the production container image. It builds the Next.js
  standalone server bundle and runs with SQLite storage under `/data`.

## Major Boundaries

- The root route is the game launcher: `src/app/page.tsx` renders
  `GameLauncher`; `src/components/game-launcher-config.ts` owns the game-card
  catalog and parameter registry, `src/components/game-launcher-playables.ts`
  owns the lazy playable component registry, and
  `src/components/game-launcher.tsx` owns selected-game browser state and menu
  rendering.
- Games split browser orchestration from reusable rules: `src/components/*-game.tsx`
  owns React state and browser events, `src/components/*-board.tsx` renders the
  board, and `src/lib/*-game-engine.ts` owns deterministic game state transitions.
- Shared game UI is exported through `src/components/game-layout.tsx`; focused
  implementation modules live beside it in `src/components/`.
- Leaderboards cross source folders: shared key/ranking/client helpers live in
  `src/lib/leaderboard.ts`, the React state hook lives in `src/hooks/`, shared
  UI lives in `src/components/`, the API route lives in `src/app/api/`, and the
  current server store lives in `src/lib/server/`.
- User profiles cross the same boundaries: `src/lib/user-profile.ts` owns shared
  user/session/auth types and client helpers, `src/hooks/use-current-user.tsx`
  owns browser auth state, `src/hooks/use-game-session.ts` records signed-in play
  sessions, `/api/auth/*`, `/api/me`, and `/api/game-sessions` expose server
  routes, and `/profile` renders aggregate stats for the current session.
- Replays cross the same client/server boundary: `src/lib/game-replay.ts` owns
  shared run ids, seed normalization, deterministic replay random creation, API
  paths, client helpers, and base payload validation; `src/lib/snake-replay.ts`,
  `src/lib/tetris-replay.ts`, `src/lib/minesweeper-replay.ts`, and
  `src/lib/twenty-forty-eight-replay.ts` own game-specific events and replay
  application helpers. `/api/replays/<game>/run` issues replay run ids and seeds
  for supported replay games;
  `/api/replays/<game>` saves/downloads the current signed-in user's latest
  replay; `/profile` links saved replays back to `/?replay=snake`,
  `/?replay=tetris`, `/?replay=minesweeper`, or `/?replay=twenty-forty-eight`.

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
- Leaderboard keys are game-and-parameter scoped. Snake uses the stable
  `snake|mode=levels` key for its level-progression run because board size
  changes during play. Most games rank higher scores first; Minesweeper submits
  only won boards and ranks lower elapsed times first.
- The default leaderboard database path remains `.data/snake-leaderboard.sqlite`
  for existing Snake deployments. `GAME_LEADERBOARD_SQLITE_PATH` is the preferred
  durable override, with `SNAKE_LEADERBOARD_SQLITE_PATH` still honored as a
  fallback.
- Profile stats count only signed-in sessions. Guest play and guest leaderboard
  saves remain allowed but do not create `game_sessions` rows. First-party auth
  uses normalized unique display names plus salted password hashes; private
  profile access is derived from the HTTP-only session cookie, never client ids.
- Replay recording may run during guest play for supported replay games, but
  persisted profile replays are signed-in and scoped by user and game. The MVP
  keeps one latest replay per user/game in SQLite.
- shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
  `@/*` import alias. The shared button is `src/components/ui/button.tsx`.

## Verification

- `npm test` runs deterministic Vitest coverage.
- `npm run test:coverage:core` runs the thresholded core coverage gate for
  deterministic engines, server/API helpers, pure board renderers, shared input
  filtering, and utilities.
- Run coverage checks when code changes are significant, especially when they
  touch core coverage surfaces or add new branches that CI will gate with
  `npm run test:coverage:core`.
- `npm run test:e2e` runs the focused Chromium Playwright smoke suite. Browser
  flow details live in `e2e/MEMORY.md`.
- `npm run typecheck`, `npm run lint`, and `npm run build` are the standard
  TypeScript, ESLint, and Next build checks.
- `npm run lore-coding -- --file <path>` validates a Lore Coding commit message file.
  `npm install` runs `scripts/install-lore-coding-hooks.mjs` through the package
  `prepare` script to configure `core.hooksPath .githooks` for local clones;
  CI does not run Lore Coding validation yet.
- CI repeats the build, static checks, core coverage gate, and Playwright suite
  for code-affecting changes, then publishes the Docker image to Docker Hub
  after successful `main` pushes. See `.github/MEMORY.md`.
