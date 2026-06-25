# Multiplayer Library Memory

This folder owns pure private-room domain models and transport-neutral protocol
types for multiplayer work. Keep WebSocket APIs, HTTP route parsing, server
stores, sidecar runtime state, persistence, and React components outside this
folder.

## Files

- `room.ts` owns the reusable private-room model: signed-in hosts, guest
  observers, player seats, generic game settings, invite paths, host-only
  lifecycle/settings commands, and immutable room transitions.
- `protocol.ts` owns the shared realtime envelope types. The envelope should
  stay stable across games: connection messages identify the room, room commands
  wrap the private-room command model, game input carries `gameId` plus a nested
  game payload, and server messages carry room snapshots, events, acks,
  rejections, and ping-style timing messages.

## Protocol Boundaries

- Do not add one top-level transport message per game. Add game-specific input
  or snapshot payloads behind the generic `game.input` and game-snapshot
  envelopes so Pong, Space Invaders, Asteroids, and later games can share the
  same realtime room service.
- Current Pong aliases in `protocol.ts` exist to keep the existing Pong
  multiplayer UI/runtime typed while the sidecar protocol is introduced. Future
  game integrations should narrow by `gameId` at the edge that understands that
  game, not in the room transport envelope itself.
- Protocol tests should remain deterministic data-shape checks using TypeScript
  `satisfies` objects and small runtime assertions unless a real parser or
  validator is added for the protocol boundary.
