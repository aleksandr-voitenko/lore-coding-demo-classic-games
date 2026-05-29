# Server Library Memory

This file covers Node-only server helpers and storage adapters under
`src/lib/server/`.

## Leaderboard Store Boundary

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
- Keep this adapter boundary small so a future Postgres store can replace SQLite
  without changing the client API or game components.

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
  rows.
- `users` are keyed by normalized display name and store nullable password
  hashes for backward-compatible migration. New signups must set a password hash;
  legacy passwordless users remain reserved names and cannot be claimed through
  sign-up. `user_sessions` stores hashed cookie tokens, and `game_sessions`
  stores only signed-in play sessions with active duration, final score, result,
  sort direction, game id, and leaderboard key.
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
