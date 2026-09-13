# Project Memory

Repository-wide context; public setup and usage live in `README.md`. Read child
memory for local constraints instead of duplicating it here.

## Architecture and Ownership

- Next.js App Router collection of ten games. `src/lib/game-catalog.ts` owns
  stable ids, public labels, and card artwork metadata. Tank Patrol's public
  rename preserves `battle-city` in code, storage, replay URLs, and board assets
  so existing records remain valid.
- `src/app/page.tsx` renders the launcher. Components own browser orchestration
  and rendering; deterministic engines and shared contracts live in `src/lib`;
  Node-only storage and room services live in `src/lib/server`.
  See `src/MEMORY.md`, then `src/app/MEMORY.md`, `src/components/MEMORY.md`,
  `src/lib/MEMORY.md`, and `src/lib/server/MEMORY.md` for their boundaries.
- Solo games use engine/game/board modules. Launcher config owns card parameters;
  the playable registry loads games lazily. Shared UI is exported through
  `src/components/game-layout.tsx`; use existing input and leaderboard helpers.
- Private multiplayer uses server-authoritative, volatile parties and game
  adapters, with WebSocket delivery through a separate Node sidecar. Pure room
  models/protocols are documented in `src/lib/multiplayer/MEMORY.md`; lifecycle,
  retention, credentials, and social admission belong in server memory.
  `docs/adr/` preserves architecture rationale for rooms, smoothing, and friends.
- `public/images/MEMORY.md` owns card/sprite asset and cache-version constraints;
  `e2e/MEMORY.md` owns browser acceptance strategy;
  `.github/MEMORY.md` owns CI/publishing; `.githooks/MEMORY.md` owns Lore tooling.

## Durable Cross-Cutting Contracts

- Keep browser events, timers, DOM rendering, and effects playback outside pure
  game rules. Adding a game requires aligned catalog/playable registration,
  engine tests, game/board components, menu art, and public documentation.
- Launcher parameters use real selects and flow through `initial*` props into
  game state. Restart, replay, rendering, accessible labels, and leaderboard keys
  must preserve those selections. Tank Patrol's campaign timing, 35-map/70-stage
  cycle, and two-player rules are detailed in `src/lib/MEMORY.md`.
- Leaderboards are top-three, game-and-parameter scoped. Snake level progression
  uses `snake|mode=levels` because its board grows during play. Minesweeper saves
  only wins and ranks lower elapsed time first; other games rank higher scores.
- Profiles, auth, and sessions share contracts in `src/lib/user-profile.ts`,
  hooks in `src/hooks`, routes under `src/app/api`, and SQLite server stores.
  Profile stats count signed-in play only; guest play and guest leaderboard
  saves remain allowed. Normalized display names are unique, passwords are
  salted hashes, and private identity comes from the HTTP-only session cookie.
- All ten solo games record deterministic events after server-issued replay
  runs, including guest play. Saving/downloading a profile replay requires auth;
  SQLite retains one latest replay per user/game. Shared replay helpers live in
  `src/lib/game-replay.ts`, with game-specific `*-replay.ts` contracts and
  `/api/replays/<game>[/run]` routes. Profile links use `/?replay=<game-id>`.
  Private-room sessions/outcomes never feed solo replays, profile game sessions,
  or solo leaderboards. Preserve replay compatibility when changing engines.
- Accounts, leaderboards, sessions, replays, and the durable social graph share
  SQLite. Presence leases, room membership/capabilities, matches, and queues are
  volatile; durable social rows must not reconstruct room state after restart.

## Runtime and Verification

- `Dockerfile` builds Next's standalone server and stores SQLite under `/data`.
  The default non-container database remains `.data/snake-leaderboard.sqlite`.
  `GAME_LEADERBOARD_SQLITE_PATH` overrides it, with legacy
  `SNAKE_LEADERBOARD_SQLITE_PATH` fallback.
- `npm run dev:multiplayer` discovers or accepts one exact LAN IPv4 host and
  aligns the printed URL, browser WebSocket URL, and Next dev-origin allowlist.
  Its parser rejects protocols, ports, paths, hostnames, IPv6, and wildcards.
  Ordinary dev leaves that allowlist unset unless the override is supplied.
- UI uses Tailwind v4, shadcn `base-nova`, and `@/*` imports; the shared button is
  `src/components/ui/button.tsx`.
- `npm test` runs Vitest. `npm run test:coverage:core` gates library logic,
  API routes, pure board renderers, and shared input filtering at 90% statements,
  functions, and lines / 85% branches. Run it for significant core changes and
  after large implementation tasks before reporting completion.
- Standard checks: `npm run typecheck`, `npm run lint`, `npm run check:deps`,
  `npm run check:unused`, and `npm run build`. Browser checks are
  `npm run test:e2e` and `npm run test:e2e:sidecar`; the latter builds and tests
  the emitted sidecar with a separately wired Next server.
- CI gates code-affecting changes on those checks and both browser suites, then
  publishes Docker images after successful `main` pushes; Markdown-only changes
  are ignored. Lore validation remains local:
  `npm run lore-coding -- --file <path>`. Package `prepare` installs the hook
  unless skipped or a custom hook path exists; see `.githooks/MEMORY.md` for
  the installer contract.
