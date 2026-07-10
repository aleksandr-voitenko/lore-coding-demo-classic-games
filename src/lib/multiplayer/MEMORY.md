# Multiplayer Library Memory

This folder owns pure private-room domain models and transport-neutral protocol
types for multiplayer work. Keep WebSocket APIs, HTTP route parsing, server
stores, sidecar runtime state, persistence, and React components outside this
folder.

## Files

- `game-registry.ts` owns pure multiplayer support membership and default game
  selection. `game-catalog.ts` owns game labels, while the launcher `GAME_CARDS`
  catalog owns rendered card order and filters that order through the registry.
  Client renderer and server adapter maps must be exhaustive over
  `MultiplayerGameId`; keep their actual imports local to their UI and server
  layers.
- `room.ts` owns the reusable private-room model: signed-in hosts, guest
  observers, player seats, generic game settings, invite paths, host-only
  lifecycle/settings commands, and immutable room transitions.
- `protocol.ts` owns the shared realtime envelope types. The envelope should
  stay stable across games: connection messages identify the room, room commands
  wrap the private-room command model, game input carries `gameId` plus a nested
  game payload, and server messages carry room snapshots, events, acks,
  rejections, and ping-style timing messages.
- `protocol-validation.ts` owns dependency-free runtime guards for untrusted
  server messages and room snapshots shared by browser WebSocket, browser HTTP,
  and internal room-service HTTP boundaries.

## Protocol Boundaries

- Keep room settings and generic protocol envelopes catalog-generic through
  `GameId`. A catalog game may have no active multiplayer adapter yet; the
  shared registry identifies runtime support, while adapter dispatch returns
  the existing unsupported-game behavior at the owning runtime boundary.
- Do not add one top-level transport message per game. Add game-specific input
  or snapshot payloads behind the generic `game.input` and game-snapshot
  envelopes so Pong, Space Invaders, Asteroids, and later games can share the
  same realtime room service.
- Keep the protocol aligned with a `gameId`-keyed server adapter registry and a
  matching client renderer/input registry. The envelope carries room identity,
  participant/session context, message kind, and server ordering; adapter-owned
  payloads remain nested behind the game boundary.
- Server sequence fields are the live-stream cursor for volatile in-process
  room events, not a promise of durable replay storage. The sidecar may use a
  bounded memory window for reconnect catch-up while the room exists, but
  clients must fall back to a fresh server snapshot when that cursor is gone.
  Replays or match summaries, if added later, should be compact terminal
  summaries derived from server-owned final state, not client-uploaded
  multiplayer histories or a SQLite-backed per-event log.
- Current Pong aliases in `protocol.ts` exist to keep the existing Pong
  multiplayer UI/runtime typed while the sidecar protocol is introduced. Future
  game integrations should narrow by `gameId` at the edge that understands that
  game, not in the room transport envelope itself.
- Live browser room transport uses the WebSocket stream for snapshots,
  guest-capable room commands, and game input. Public browser HTTP may still
  create rooms and carry authenticated host-only commands, but new protocol work
  should not depend on polling-only message shapes.
- Protocol tests should remain deterministic data-shape checks using TypeScript
  `satisfies` objects and small runtime assertions. Runtime guard tests should
  cover every known top-level discriminant, malformed nested room state, and
  forward-compatible extra fields.
- Runtime validation owns the complete generic room structure and invariants,
  server envelope fields, room/game sequence and timestamp fields, and the
  generic game snapshot envelope. Game state remains an opaque object here;
  game-specific state and snapshot extras belong to the adapter or renderer
  that understands that game instead of being duplicated in the shared codec.
  Keep settings traversal iterative so deeply nested JSON remains valid without
  a recursion limit; reject cyclic/shared-reference graphs, and keep public
  guards total by returning `false` when reflective access fails.
