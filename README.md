# Classic Games Lore Coding Demo

This demo is a Next.js App Router game collection used to demonstrate
[agentic-lore-coding](https://github.com/aleksandr-voitenko/agentic-lore-coding).
It opens to a card-based menu with Classic games like Snake, Tetris, Breakout, Minesweeper, Asteroids and many others.

All the code in this repository was created using AI agents and the Lore Coding Method. The code was reviewed, but never edited in an IDE. Instead, all edits were performed using an AI agent while working on a specific task.

## Features

- Nine classic games with deterministic gameplay rules and polished browser
  controls.
- Asteroids includes vector-style ship thrust, wraparound movement,
  asteroid splitting, UFO saucers, waves, lives, bonus lives, scoring, and
  persistent board power-ups, and difficulty-scoped records.
- Simon uses Easy, Medium, and Hard difficulty presets for target sequence
  length while keeping records scoped to the selected difficulty.
- Minesweeper uses traditional Easy, Medium, and Hard minefield presets with
  records scoped to the selected difficulty.
- Snake includes level progression through key-and-door exits, timed special
  foods, obstacle islands, and a full-board win state.
- SQLite-backed, parameter-scoped top-three leaderboards for every game.
  Minesweeper ranks fastest clears; the other games rank higher scores.
- Name-and-password player accounts with private profile stats for signed-in
  play sessions, including total play time and per-game best metrics.
- Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong, Simon, 2048, and
  Asteroids replay recording with server-issued runs, signed-in replay saves,
  and profile playback for the latest saved run.
- Closable in-game Help screens and Escape-to-menu abandon confirmations.
- Local game-card artwork for every game in the launcher.

## Try it with Docker

```bash
docker run --rm -p 3000:3000 aleksandrvoitenko/lore-coding-demo-classic-games
```

Open [http://localhost:3000](http://localhost:3000) to choose a game from the
menu.

## Building from source

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

Build and run the experimental multiplayer room sidecar in a separate terminal:

```bash
npm run build:sidecar
npm run start:sidecar
```

The sidecar defaults to `127.0.0.1:3001`, exposes `GET /healthz`, accepts public
room WebSocket upgrades on `/multiplayer/rooms`, and serves the internal JSON
room service on `/_internal/multiplayer/rooms`:

- `POST /_internal/multiplayer/rooms` creates a room.
- `GET /_internal/multiplayer/rooms/<code>` reads a room snapshot.
- `POST /_internal/multiplayer/rooms/<code>` applies a parsed room command.

Override the bind address and path with `MULTIPLAYER_SIDECAR_HOST`,
`MULTIPLAYER_SIDECAR_PORT`, `MULTIPLAYER_SIDECAR_WEBSOCKET_PATH`, and
`MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH` when wiring it behind a local proxy. The
sidecar pushes fresh snapshots for subscribed running rooms every 33ms by
default; tune that with `MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS` during
latency testing. Use `16` for local full-snapshot experiments, keep `33` for
production-like smoothing work, and use `50` as a lower-bandwidth fallback. Full
16ms snapshots are useful for local comparison against
the fastest game ticks, but production multiplayer should rely on client visual
interpolation, projection, local input prediction, and reconciliation over
authoritative sidecar snapshots instead of broadcasting every render frame. Next
API routes continue using their local in-process room store unless
`MULTIPLAYER_ROOM_SERVICE_URL` points at the sidecar room service base URL, for
example `http://127.0.0.1:3001/_internal/multiplayer/rooms`.

Multiplayer room state is intentionally volatile. The sidecar keeps room
ordering, live cursor catch-up, and game state in process memory only; it does
not write inputs, ticks, power-up awards, or other per-event room history into
SQLite. Restarting the sidecar abandons waiting and active rooms owned by that
process, so players should create a new room after a restart instead of
expecting replay-log recovery.

Browser room streams are enabled with
`NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL`. Use an absolute endpoint such as
`ws://127.0.0.1:3001/multiplayer/rooms` for local sidecar testing, or a
same-origin path such as `/multiplayer/rooms` when a proxy routes WebSocket
upgrades beside the Next app. Existing rooms require this WebSocket stream for
live lobby snapshots, guest join/seat commands, and game input; when it is unset
or unavailable, the room UI surfaces a stream connection error instead of using
browser HTTP polling. Host lifecycle and settings commands continue to use the
Next HTTP API so signed-in-host authorization stays on the authenticated route
until the WebSocket sidecar has its own authenticated host session model.

The sidecar room service endpoints are internal service endpoints; public HTTP
room creation and host authorization should still flow through the Next API
routes. If the internal hop needs a bearer token, set the same secret in
`MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN` for the Next process and
`MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN` for the sidecar process.

## Stack

- Node.js 22
- TypeScript
- Next.js App Router
- React with the React Compiler enabled
- SQLite through `better-sqlite3`
- Tailwind CSS v4
- shadcn/ui
- Vitest
- Playwright
- ESLint
- Docker

## Persistent Storage

Leaderboards, player accounts, signed-in sessions, profile stats, and saved
replays use SQLite.
Leaderboard records are stored under game-and-parameter keys such as
`snake|mode=levels` or `tetris|board=10x20|level=3`. Signed-in play sessions also
store the selected leaderboard key so profile stats can report both per-game
totals and parameter-aware history.

Player names are unique after trimming, whitespace collapsing, and
case-insensitive comparison. Passwords are salted and hashed in SQLite; existing
passwordless demo names remain reserved and cannot be claimed through sign-up.

The default database path is `.data/snake-leaderboard.sqlite`, kept for
compatibility with existing Snake deployments. On a VPS, set
`GAME_LEADERBOARD_SQLITE_PATH` to durable storage.

Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong, Simon, 2048, and
Asteroids record replay events during play after the server issues a run id and
seed. Replay events include active-play elapsed time so playback mirrors player
hesitation while excluding Pause and Help time. Minesweeper and Simon replays
also include board-local schematic cursor streams sampled from mouse movement
every 50ms.
Signed-in players can save the completed run from the final screen; the profile
page stores one latest replay per user and game and links back into the
launcher at `/?replay=snake`, `/?replay=tetris`, `/?replay=breakout`,
`/?replay=minesweeper`, `/?replay=space-invaders`, `/?replay=pong`,
`/?replay=simon`, `/?replay=twenty-forty-eight`, or `/?replay=asteroids` for
client playback.

## Docker

Build the production image locally with:

```bash
docker build -t lore-coding-demo .
```

Run it with a mounted data directory so SQLite state survives container
replacement:

```bash
docker run --rm -p 3000:3000 \
  -v "$PWD/.data:/data" \
  lore-coding-demo
```

The image uses Next.js standalone output and listens on port `3000`.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Run the deterministic Vitest suite. |
| `npm run test:agent` | Write JSON/JUnit results and coverage under `reports/`. |
| `npm run test:coverage` | Generate broad all-source coverage under `reports/coverage/`. |
| `npm run test:coverage:core` | Run the thresholded core coverage gate under `reports/coverage-core/`. |
| `npm run test:e2e:install` | Install the Chromium browser used by Playwright. |
| `npm run test:e2e` | Run the focused Chromium Playwright smoke suite. |
| `npm run test:e2e:sidecar` | Build the multiplayer sidecar, then run the isolated Chromium Playwright smoke with Next wired to the sidecar WebSocket and internal room service. |
| `npm run test:e2e:headed` | Run the Playwright suite in a visible browser. |
| `npm run test:e2e:ui` | Open Playwright's interactive test runner. |
| `npm run typecheck` | Run TypeScript without emitting. |
| `npm run lint` | Run ESLint. |
| `npm run check:deps` | Run dependency-cruiser to enforce source dependency boundaries. |
| `npm run check:unused` | Run Knip to catch unused files, exports, and dependencies. |
| `npm run lore-coding -- --file <path>` | Validate a Lore Coding commit message file. |
| `npm run build` | Build the Next.js app. |

GitHub Actions runs these checks on pushes to `main` and pull requests that
change code or build-affecting files: `npm ci`, `npm run build`,
`npm run lint`, `npm run typecheck`, `npm run check:deps`,
`npm run check:unused`,
`npm run test:coverage:core`, and `npm run test:e2e`. Documentation-only
changes such as Markdown, `docs/**`, and `LICENSE` are ignored by CI.

After those checks pass on a push to `main`, GitHub Actions builds the
`linux/amd64` and `linux/arm64` Docker images and pushes a multi-platform
manifest to Docker Hub using the `DOCKERHUB_USERNAME` and `DOCKERHUB_IMAGE`
repository variables plus the `DOCKERHUB_TOKEN` repository secret. The
published tags are `latest`, `main`, and the short commit SHA.

## Lore Coding Validation

The repository includes a dependency-free Agentic Lore Coding validator at
`.githooks/lore-coding.mjs`, a local Git `commit-msg` hook wrapper at
`.githooks/commit-msg`, and an install-time hook setup script at
`.githooks/install-lore-coding-hooks.mjs`.

`npm install` runs the package `prepare` script, which configures this clone
with:

```bash
git config core.hooksPath .githooks
```

The installer only does this inside a Git worktree, skips in CI, and does not
overwrite an existing custom `core.hooksPath`. Set
`LORE_CODING_INSTALL_HOOKS=0` before installing dependencies to skip automatic
hook setup. If your package manager skips lifecycle scripts, run the Git config
command manually.

After the hook path is configured, `git commit` passes the proposed
commit-message file to the hook. The hook runs:

```bash
node .githooks/lore-coding.mjs --edit "$1"
```

If validation fails, Git aborts the commit and prints stable `LORE###` error
codes with the offending line, expected format, fix guidance, and an example.
The validator rejects assistant wrapper prose, Markdown code fences, malformed
subjects, unsupported task types, malformed scopes, missing or empty required
sections, out-of-order sections, missing or malformed `Lore-ID:` trailers,
legacy `Links:` sections, malformed `Lore-Link:` trailers, and linked Lore IDs
that do not exist in reachable history.

Run it manually against a message file with:

```bash
npm run lore-coding -- --file .git/COMMIT_EDITMSG
```

Explain an error code with:

```bash
npm run lore-coding -- explain LORE047
```

Every task commit must end with a `Lore-ID:` trailer. Related tasks use
repeatable `Lore-Link:` trailers with a stable Lore ID, an em dash, and a reason:

```text
Lore-ID: LC-20260530-4D61
Lore-Link: LC-20260529-18A1 — established validator behavior extended here
```

This first version is local-only; CI does not run Lore Coding validation yet.

## UI Components

shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
`@/*` import alias. Add components with:

```bash
npx shadcn@latest add <component>
```
