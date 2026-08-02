# Classic Games Lore Coding Demo

This demo is a Next.js App Router game collection used to demonstrate
[agentic-lore-coding](https://github.com/aleksandr-voitenko/agentic-lore-coding).
It opens to a card-based menu with Classic games like Snake, Tetris, Breakout,
Minesweeper, Asteroids, Tank Patrol, and many others.

All the code in this repository was created using AI agents and the Lore Coding Method. The code was reviewed, but never edited in an IDE. Instead, all edits were performed using an AI agent while working on a specific task.

## Features

- Ten classic games with deterministic gameplay rules and polished browser
  controls.
- Tank Patrol provides a single-player campaign across 35 maps and the
  original 70-stage difficulty cycle, including Stage 1-35 selection,
  NES-pixel movement, partial wall destruction, NTSC-paced tank and shell
  lifecycles, enemy waves, timed results, and a headquarters to defend. Its
  online private-room mode adds server-authoritative two-player co-op starting
  from Stage 1 with original-style rules and spawn points.
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
- Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong, Simon, 2048,
  Asteroids, and the Tank Patrol single-player campaign support replay
  recording with server-issued runs, signed-in replay saves, and profile
  playback for the latest saved run.
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

For local multiplayer testing on another device in the same network, run both
the sidecar and Next dev server through the wrapper:

```bash
npm run dev:multiplayer
```

The wrapper binds Next and the sidecar to `0.0.0.0`, discovers a private LAN IPv4
address for browser WebSocket URLs, prints the shareable app URL, and adds that
exact host to Next's development-origin allowlist. Override the detected address
when the machine has multiple network interfaces:

```bash
MULTIPLAYER_DEV_PUBLIC_HOST=10.125.3.39 npm run dev:multiplayer
```

The detected or overridden public host must be a bare dotted-decimal IPv4
address. The wrapper rejects protocols, ports, paths, hostnames, IPv6 literals,
and wildcards instead of forwarding them to Next's development-origin matcher.

Optional wrapper overrides include `MULTIPLAYER_DEV_NEXT_PORT`,
`MULTIPLAYER_DEV_SIDECAR_PORT`, and
`MULTIPLAYER_DEV_SNAPSHOT_INTERVAL_MS`. Sidecar-specific settings such as
`MULTIPLAYER_SIDECAR_MAX_ROOMS` are inherited by the child process. Next still
talks to the sidecar through
`127.0.0.1`; only browser-facing URLs use the detected LAN address.

Build and run the experimental multiplayer room sidecar in a separate terminal:

```bash
npm run start:sidecar
```

The start script rebuilds the sidecar before launching it so local runtime code
matches the current TypeScript source.

The sidecar defaults to `127.0.0.1:3001`, exposes `GET /healthz`, accepts public
room WebSocket upgrades on `/multiplayer/rooms`, and serves the internal JSON
room service on `/_internal/multiplayer/rooms`:

- `POST /_internal/multiplayer/rooms/v5` creates a room.
- `GET /_internal/multiplayer/rooms/<code>` reads a room snapshot.
- `POST /_internal/multiplayer/rooms/v5/<code>` applies a parsed room command.

Override the bind address and path with `MULTIPLAYER_SIDECAR_HOST`,
`MULTIPLAYER_SIDECAR_PORT`, `MULTIPLAYER_SIDECAR_WEBSOCKET_PATH`, and
`MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH` when wiring it behind a local proxy. The
sidecar retains at most 256 rooms by default; set
`MULTIPLAYER_SIDECAR_MAX_ROOMS` to a positive integer when a deployment needs a
different per-process capacity. A party allows eight watchers and four live
WebSocket tabs per participant by default. Tune those independent fanout bounds
with `MULTIPLAYER_SIDECAR_MAX_OBSERVERS_PER_PARTY` (a non-negative integer) and
`MULTIPLAYER_SIDECAR_MAX_CONNECTIONS_PER_PARTICIPANT` (a positive integer).

The sidecar pushes fresh snapshots for subscribed running rooms every 33ms by
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

Tank Patrol private rooms require both Player 1 and Player 2 seats and always
begin at Stage 1. Each player starts at the original P1/P2 spawn point with
three lives and keeps an individual score, upgrade tier, and stage kill totals.
A friendly shell is consumed on impact and briefly stuns an unprotected teammate
instead of destroying them. The co-op enemy field allows six simultaneous
tanks and advances enemy spawning faster than solo play; the team remains in
the battle until both players are eliminated or the headquarters is destroyed.
Star, helmet, tank, pickup score, and score-earned extra-life rewards belong to
the collecting player, while grenade, clock, and shovel effects apply to the
shared battlefield. Stage results show both players separately, and a surviving
strict kill leader receives the original 1,000-point bonus; ties receive no
bonus.

These multiplayer sessions remain separate from Tank Patrol's single-player
replay and leaderboard paths. Private-room inputs and outcomes are not saved as
profile replays or submitted to the solo campaign leaderboard.

Private-room codes now identify a volatile party rather than one disposable
match. The signed-in host automatically occupies Player 1, and a guest choosing
`Join game` atomically receives Player 2 while it is available between matches;
`Watch` joins without taking a seat, and a play join falls back to watching when
both seats are occupied or a match is active. In the lobby or after a finished
match, the host can choose any supported multiplayer game without creating or
sharing another link. That atomic replacement keeps the party code and members,
maps each occupied slot to the same ordinal seat in the next game, increments the
match generation, and clears the previous game runtime. Seats and games cannot
be changed during a running or paused match. When an adapter reaches its natural
terminal state, the room becomes finished automatically so the host can choose
the next game. The Party panel remains visible beside active and finished games,
separates the two player slots from Watching, and shows watcher capacity. A
watcher can join an open slot between matches or enter the FIFO `Next match`
queue while play is active; queued players are promoted only at a restart or
game-replacement boundary, never into a running game. `Watch instead` releases a
seat only between matches and cannot exceed the watcher limit. A full or active
play attempt falls back to watching only while watcher capacity remains.

Leaving the party is distinct from navigating back to the library. A seated
player who leaves has held input cleared and frees the slot without changing the
completed match's participant attribution. If the host leaves, ownership moves
to the earliest connected signed-in member; when no such member exists, the
party closes for everyone. The closing and departing-member messages are
terminal client events, clear room-scoped credentials, and do not reconnect the
old membership.

Volatile rooms also have bounded idle retention. An unconnected lobby expires
after 60 minutes without a successful participant or host command; an
unconnected running or paused room expires after two hours; and a completed
game or explicitly finished room expires after 30 minutes. Passive invite
reads, connection handshakes, diagnostics pings, snapshot delivery, and
server-owned game ticks do not refresh those clocks. Public participant ids in
room snapshots are not credentials. Room creation and guest admission return a
separate opaque participant capability only to that participant, and the browser
keeps it in account-scoped session storage for same-tab navigation and reloads.
A WebSocket authenticated with a capability that still belongs to the room
protects it from expiry, and the final recognized disconnect grants the room its
full state-specific
grace period again.

The sidecar sweeps expired rooms about once a minute and also checks retention
during room operations. At capacity it removes expired rooms first, then the
oldest unconnected terminal room, then the oldest unconnected lobby. It never
capacity-evicts nonterminal running or paused games or rooms with recognized
participant connections; if no safe candidate exists, creation returns a
retryable `503`. Expired room codes return `410 room-expired` for up to five
minutes so clients can explain what happened, then fall back to the ordinary
`404` response. Both retained expired-code markers and live rooms remain
bounded by the configured capacity.

Append `multiplayerDiagnostics=1` to a room URL to show a small client-side
diagnostics overlay with snapshot rate, jitter, ping, stream sequence gaps, and
recent tick catch-up and projection-reconciliation rates. Use
`multiplayerDiagnostics=log` to also emit the same summary to the browser
console while testing real network conditions.

### Multiplayer latency lab

Use the latency proxy to put repeatable internet-like conditions between browser
clients and the sidecar WebSocket stream. The proxy models target round-trip
time by delaying each WebSocket direction by roughly half of the configured RTT,
with optional jitter and message loss.

Run the sidecar, proxy, and Next dev server in separate terminals:

```bash
npm run start:sidecar
MULTIPLAYER_LATENCY_PROXY_PROFILE=normal npm run start:latency-proxy
MULTIPLAYER_ROOM_SERVICE_URL=http://127.0.0.1:3001/_internal/multiplayer/rooms \
NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL=ws://127.0.0.1:3002/multiplayer/rooms \
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Open a private room with `multiplayerDiagnostics=1`, for example
`http://127.0.0.1:3000/?room=<code>&multiplayerDiagnostics=1`.

Latency proxy profiles:

| Profile | Target ping | Jitter | Drop rate | Use |
| --- | ---: | ---: | ---: | --- |
| `lan` | 0ms | 0ms | 0% | Baseline comparison |
| `good` | 40ms | 5ms | 0% | Good nearby internet |
| `normal` | 80ms | 15ms | 0% | Typical friend play |
| `rough` | 120ms | 30ms | 0% | Noticeably delayed play |
| `bad` | 180ms | 50ms | 2% | Stress testing only |

Override any profile with:

- `MULTIPLAYER_LATENCY_PROXY_RTT_MS`
- `MULTIPLAYER_LATENCY_PROXY_JITTER_MS`
- `MULTIPLAYER_LATENCY_PROXY_DROP_RATE`
- `MULTIPLAYER_LATENCY_PROXY_SEED`

Healthy manual test signals:

- `Snapshots` stays close to the configured sidecar rate, about `30/s` at the
  33ms default.
- `Ping` roughly matches the selected profile.
- `Stream gaps` stays at `0`; any growth means the live room stream is missing
  authoritative room sequence numbers.
- `Jitter` should stay in the healthy or warning band for playable sessions.
- `Tick catch-up` and `Reconciled` are recent per-second rates, not lifetime
  totals. They can be non-zero in healthy games, but high rates should not
  produce visible snapping. Asteroids is the most sensitive game because thrust,
  rotation, saucers, shots, and rocks are all continuous motion.

The sidecar latency smoke can be run through the proxy with:

```bash
npm run test:e2e:sidecar:latency -- --grep "Multiplayer diagnostics"
```

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
The gateway resolves participant capabilities during resume and derives seat and
game-input actors from the bound socket. Participant ids submitted without a
valid capability cannot resume or authorize commands, and public observer joins
cannot attach an account identity. Anonymous invite previews receive one
bootstrap snapshot but are not retained as room subscribers; only recognized
members receive ongoing fanout. Per-participant connection ceilings prevent one
capability from creating unbounded subscriber tabs.

The sidecar room service endpoints are internal service endpoints; public HTTP
room creation and host authorization should still flow through the Next API
routes. If the internal hop needs a bearer token, set the same secret in
`MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN` for the Next process and
`MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN` for the sidecar process.
Party queue, capacity, and leave mutations require protocol version 5. The Next process
preflights the authenticated internal collection endpoint, then sends create and
command POSTs through its advertised `/v5` mutation path with
`x-multiplayer-room-protocol-version: 5`; the sidecar rejects legacy paths or a
missing/mismatched header before reading a mutation body. Browser create and
host-command POSTs likewise use `/api/multiplayer/rooms/v5` and
`/api/multiplayer/rooms/<code>/v5`; the v4, v3, v2, and unversioned POST routes
return 426. Browser
`connection.hello` and `connection.resume` messages and the corresponding
bootstrap carry the same version, and a mismatched bootstrap closes without
reconnecting. During a rolling mixed-version deployment, room mutations and
stream activation therefore fail closed until the selected processes and the
browser bundle are compatible. Room snapshots expose a positive `matchId`;
game snapshots, reconnect cursors, acknowledgements, input, seat, settings, and
lifecycle commands carry the same generation. Restart creates a fresh runtime
and advances the match id, while stale-generation commands are rejected before
the current runtime advances.

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

Snake, Tetris, Breakout, Minesweeper, Space Invaders, Pong, Simon, 2048,
Asteroids, and the Tank Patrol single-player campaign record replay events
during play after the server issues a run id and seed. Replay events include
active-play elapsed time so playback mirrors player hesitation while excluding
Pause and Help time.
Minesweeper and Simon replays also include board-local schematic cursor streams
sampled from mouse movement every 50ms.
Signed-in players can save the completed run from the final screen; the profile
page stores one latest replay per user and game and links back into the
launcher at `/?replay=snake`, `/?replay=tetris`, `/?replay=breakout`,
`/?replay=minesweeper`, `/?replay=space-invaders`, `/?replay=pong`,
`/?replay=simon`, `/?replay=twenty-forty-eight`, `/?replay=asteroids`, or
`/?replay=battle-city` for client playback.

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
`npm run test:coverage:core`, `npm run test:e2e`, and
`npm run test:e2e:sidecar`. The sidecar suite rebuilds and starts the emitted
multiplayer sidecar before exercising its isolated browser flows.
Documentation-only changes such as Markdown, `docs/**`, and `LICENSE` are
ignored by CI.

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
