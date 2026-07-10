# Server Library Memory

This file covers Node-only server helpers and storage adapters under
`src/lib/server/`.

## Leaderboard Store Boundary

- Production modules in this folder import `server-only` so Next fails the build
  if a client component accidentally pulls Node-only storage, cookie, or crypto
  helpers into a browser bundle. Add the same marker to new Next-facing runtime
  modules under this boundary; tests use the shared Vitest resolver alias for the
  empty server marker implementation.
- `multiplayer-room-runtime.ts` and `multiplayer-room-websocket.ts` are the
  intentional exceptions: they avoid importing `server-only` so the standalone
  realtime sidecar can reuse the same in-memory service and WebSocket gateway
  under normal Node resolution. Next API routes should import
  `multiplayer-room-store.ts`, not the runtime or gateway directly.
- `leaderboard-store.ts` defines the small `LeaderboardStore` interface used by
  the API route and tests. Keep parsing, validation, normalized submissions, JSON
  response shaping, and rank calculation behind this boundary.
- `sqlite-app-schema.ts` owns shared SQLite path preparation and schema
  initialization for leaderboards, users, password hashes, user sessions, and
  signed-in game sessions.
- `sqlite-leaderboard-store.ts` is the current production leaderboard store. It
  uses `better-sqlite3`, initializes the shared schema, and exposes
  `getLeaderboardStore()` as the default singleton.
- `password-auth.ts` owns server-only password hashing and verification using
  Node `crypto.scrypt` with per-user salts.
- `sqlite-user-profile-store.ts` owns user registration, password login,
  signed-in session persistence, game-session recording, and aggregate profile
  stats.
- `sqlite-replay-store.ts` owns generic server-issued replay runs and one latest
  saved replay per signed-in user/game. Keep generic `createReplayRun`,
  `saveReplay`, and `getReplay` behavior available for future games while
  preserving Snake wrapper methods for the current replay MVP.
- `multiplayer-room-store.ts` is the private-room API MVP facade. It imports
  `server-only`, exposes the Next-facing singleton, and re-exports the runtime
  types/class from `multiplayer-room-runtime.ts`. The default remains the local
  in-process store; setting `MULTIPLAYER_ROOM_SERVICE_URL` switches Next API
  routes to the HTTP room service client.
- `multiplayer-room-service-client.ts` is the guarded Next-to-sidecar HTTP
  adapter. It implements the room store contract over `POST <base>`,
  `GET <base>/<code>`, and `POST <base>/<code>`, sends
  `MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN` when configured, and maps
  sidecar or upstream failures back into store-style results for route handlers.
- `multiplayer-room-runtime.ts` wraps the pure room model with process-local room
  state, deterministic id/code/time factories for tests, snapshot sequence
  numbers for API routes, and adapter-owned runtimes that expose optional
  server-owned game snapshots. It retains the current canonical room/game state,
  not an internal history of accepted inputs or snapshot advances; current
  WebSocket reconnects recover from a fresh authoritative snapshot. Room state
  is intentionally volatile: the in-process store or sidecar owns server
  authority while the room exists, and in-progress games may be abandoned if
  that process restarts.
- `multiplayer-room-websocket.ts` owns the reusable Node WebSocket gateway for
  the realtime sidecar. It adapts the generic protocol envelopes to the room
  runtime, accepts an injectable `MultiplayerRoomStore`, rejects public
  WebSocket lifecycle/settings commands because signed-in host authorization
  lives on the authenticated HTTP room route, broadcasts authoritative room
  snapshots after accepted WebSocket commands, runs a subscribed-room snapshot
  pump so server-owned games keep advancing when HTTP polling is disabled,
  exposes a narrow snapshot fanout method for sidecar-owned mutations, and keeps
  game-specific payloads nested behind `game.input` dispatch. Its public factory
  defaults inbound client messages to 64 KiB through `ws` `maxPayload` while
  preserving explicit caller overrides.
- `multiplayer-room-sidecar.ts` owns the standalone Node HTTP/WebSocket process
  wrapper around the gateway. It parses `MULTIPLAYER_SIDECAR_HOST`,
  `MULTIPLAYER_SIDECAR_PORT`, `MULTIPLAYER_SIDECAR_WEBSOCKET_PATH`,
  `MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH`,
  `MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS`, and optional
  `MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN`. It exposes `/healthz`, keeps
  public WebSocket upgrades on `/multiplayer/rooms` by default, serves internal
  JSON room create/get/command endpoints on `/_internal/multiplayer/rooms` by
  default, passes one in-process room store to both those HTTP endpoints and the
  WebSocket gateway, and fans successful internal room command POST results back
  to already-subscribed WebSocket clients as authoritative `room.snapshot`
  messages. It is emitted through `tsconfig.sidecar.json` because the main app
  TypeScript config typechecks only and does not emit runtime JavaScript. Keep
  sidecar-emitted runtime imports resolvable by plain Node after TypeScript emits
  CommonJS; TypeScript path aliases are not rewritten in emitted output.
- Keep this adapter boundary small so a future Postgres store can replace SQLite
  without changing the client API or game components.

## Multiplayer Adapter Target

- The long-term multiplayer runtime is a `gameId`-keyed adapter registry, not a
  Pong-owned room architecture. Pong is the first adapter; later games should
  plug into the same room service, sidecar, protocol envelopes, and result
  pipeline.
- The supported ids and default game live in
  `src/lib/multiplayer/game-registry.ts`; keep the server adapter map exhaustive
  over its `MultiplayerGameId` while leaving adapter implementations in this
  server-only folder.
- A server game adapter owns game settings defaults/validation, seat and role
  mapping, accepted input payloads, initial state, deterministic application of
  server-ordered intents and ticks, authoritative snapshot projection, terminal
  result data, and game-specific match-summary fields. The room service owns
  room identity, membership, admission, host authorization, observer permissions,
  sequencing, and dispatch to the selected adapter.
- The Space Invaders co-op adapter milestone should expose required `ship-a` and
  `ship-b` seats. It owns server-side random choices for simultaneous ambiguous
  outcomes: choosing the respawning ship when a double hit has only one shared
  life left, and choosing the power-up recipient when both ships collect the
  same power-up on one tick. Tests should inject deterministic randomness.
- The Asteroids co-op adapter milestone should expose required `ship-a` and
  `ship-b` seats and keep the room service game-agnostic. It owns server-side
  random choices for saucer targeting, asteroid double-hit final-life
  resolution, saucer-shot double-hit resolution, and simultaneous power-up
  pickup. The adapter should project compact terminal summaries with shared
  score, wave, lives, and occupied seats; per-ship contribution stats are out of
  scope for the first Asteroids co-op slice.
- The current authoritative source is the room's canonical state plus room/game
  sequence counters while the room exists. Do not retain an unbounded internal
  history of high-frequency inputs, ticks, snapshots, or power-up awards. A
  bounded reconnect window may be added when its cursor and retention policy are
  defined; until then reconnect uses a fresh snapshot. If multiplayer
  persistence is needed later, persist compact terminal summaries or mode-scoped
  results derived from server-owned final state, not a durable per-event log.
- Multiplayer results and scores stay mode-scoped, for example private-room
  Pong keys must remain separate from solo Pong keys. Do not write multiplayer
  outcomes through solo replay uploads or unscoped solo leaderboard keys.
- Browser live room delivery uses WebSocket fanout plus the volatile ordered
  event path. Keep public HTTP limited to room creation, invite snapshot reads,
  and authenticated host-only commands; the sidecar HTTP room service remains an
  internal bridge rather than a browser polling or live-command fallback.

## SQLite Assumptions

- `GAME_LEADERBOARD_SQLITE_PATH` is the preferred durable override.
  `SNAKE_LEADERBOARD_SQLITE_PATH` is still honored as a fallback.
- The default path is `.data/snake-leaderboard.sqlite`, intentionally preserved
  for existing Snake deployments.
- `:memory:` is supported for isolated tests and should not trigger directory
  creation.
- The generic schema stores rows in `leaderboard_scores` with stable
  game-and-parameter keys. It maintains separate ascending and descending indexes
  for high-score and low-time rankings.
- `leaderboard_scores` can optionally link to `users` and `game_sessions`, but
  profile stats are derived from `game_sessions`, not from top-three leaderboard
  rows. The SQLite leaderboard insert resolves an optional game-session link in
  the same transaction and stores it only when the session belongs to the
  server-derived score user; guest, missing, and mismatched links remain null.
- `users` are keyed by normalized display name and store nullable password
  hashes for backward-compatible migration. New signups must set a password hash;
  legacy passwordless users remain reserved names and cannot be claimed through
  sign-up. `user_sessions` stores hashed cookie tokens, and `game_sessions`
  stores only signed-in play sessions with active duration, final score, result,
  sort direction, game id, and leaderboard key.
- `game_replay_runs` stores server-issued run ids and seeds. `game_replays`
  stores the latest signed-in replay payload per user/game and is used by the
  profile page to expose the Last Replay action.
- Schema initialization migrates legacy `snake_scores` rows into
  `leaderboard_scores` as `snake|board=<size>` keys.
- Ranking ties use score order, then earlier `created_at`, then `id`, preserving
  deterministic earlier-entry behavior.

## Tests

- `sqlite-leaderboard-store.test.ts` should cover persistence, parameter
  isolation, sort direction, tie ordering, path/env behavior, and legacy Snake
  migration with deterministic ids and timestamps.
- Route tests can inject a `LeaderboardStore` through
  `createLeaderboardRouteHandlers` instead of reaching for the singleton store.
- Auth route tests should inject `SqliteUserProfileStore` doubles for field
  errors/status codes, while store tests cover real SQLite uniqueness,
  password verification, legacy passwordless-name reservation, and session expiry.
