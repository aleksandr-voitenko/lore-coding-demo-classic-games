# Multiplayer Library Memory

Pure private-room models, settings, support registry, and transport-neutral
protocols live here. WebSockets, HTTP parsing, process-local authority/storage,
and React belong outside this folder; server behavior is in
`../server/MEMORY.md`.

## Domain Ownership

- `game-registry.ts` defines supported multiplayer ids and the single default
  (Pong). The other registered games are Space Invaders, Asteroids, and Tank
  Patrol under stable `battle-city`. Labels belong to `../game-catalog.ts`;
  launcher cards own rendered order, filtered by this registry. Client renderer
  and server adapter maps must exhaust `MultiplayerGameId`, with implementation
  imports local to their owning layers.
- `room.ts` owns immutable party/match transitions. Creation seats the signed-in
  host in Player 1; guest Play takes an eligible open seat between matches or
  falls back to Watching within capacity. Watchers are derived from occupancy,
  so an unseated host counts toward `observerLimit` while retaining ownership.
  Creation/replacement require exactly two required seats.
- Party code/membership survive host-only match replacement. It advances
  `matchId`, remaps occupied slots by ordinal (including gaps), and changes
  settings/seats atomically. Seat changes and replacement require lobby/finished
  state; restart establishes a new generation from active or finished state.
  Host ownership may transfer on explicit leave. Tank Patrol always starts
  Stage 1 with `player-1`/`player-2` and no launcher parameters.
- FIFO next-match queueing/cancellation preserves existing players. Promotion
  fills lobby openings and runs at start/restart/replacement; it never inserts
  watchers into the existing running roster. Leave frees seat/queue membership;
  the model validates a signed-in host successor or returns party closure.
  The server chooses a connected successor and clears credentials/held input.
- `settings.ts` owns shared types, iterative JSON-tree validation/copying, and
  admission normalization (`room.ts` re-exports the types). Creation, updates,
  and replacement admit at most 32 containers per path (settings root 1,
  parameters 2) and 16 KiB of serialized UTF-8 including game id, keys,
  punctuation, and escaping. Copies preserve special keys such as `__proto__`
  as data and never share nested references. Snapshot structural validation
  remains total without an admission-depth limit; keep that separate from safe
  mutation/serialization limits (`LC-20260905-5EDA`).

## Protocol Boundaries

- `protocol.ts` owns generic room, nested game input/snapshot, event, ack,
  rejection, and connection/timing envelopes. Protocol v6 carries match ids in
  snapshots, reconnect cursors, acknowledgements, and match-scoped commands.
  Keep envelope types catalog-generic through `GameId`; runtime support is the
  registry/adapter boundary's decision.
- Game-specific aliases live beside their game contracts, e.g.
  `../pong-multiplayer.ts`, not in the generic protocol (`LC-20260626-MPPT`).
  Narrow by `gameId` in the adapter/renderer that understands the nested
  payload; do not add a top-level transport message for each game.
- Sequence fields order the live volatile stream. Current reconnect uses a
  fresh authoritative snapshot, with no retained event history. Any future
  bounded catch-up window needs a cursor/retention policy. Multiplayer summaries
  remain server-derived and mode-scoped, separate from solo replay/profile and
  leaderboard persistence (`LC-20260709-MPRT`).
- Live browser snapshots, guest room commands, and game inputs use WebSockets.
  Public HTTP supports creation/invite reads and authenticated host commands;
  the sidecar HTTP bridge is internal, not a polling/live-command fallback.
- `protocol-validation.ts` supplies dependency-free runtime guards shared by
  browser WebSocket/HTTP and internal service HTTP boundaries. Validate full
  generic room invariants, nested identity/generation, sequence/timestamp fields,
  and envelope structure. Game state is an opaque object; game-specific extras
  belong to their adapter/renderer. Accept forward-compatible extra fields.
- Keep guards total: iterative settings traversal accepts deep valid JSON,
  rejects cycles/shared-reference graphs, and returns false on reflective access
  failures. Tests pair typed `satisfies` examples with malformed runtime inputs,
  cover every known discriminant, and exercise nested invariants and extra fields.
