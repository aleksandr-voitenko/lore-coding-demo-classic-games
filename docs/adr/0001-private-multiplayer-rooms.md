# ADR 0001: Private Multiplayer Rooms

Status: Accepted for future implementation
Date: 2026-06-25

## Context

The app currently supports solo classic games with deterministic engines, guest
leaderboard submissions, signed-in profile sessions, and signed-in latest replay
saves. Multiplayer needs a durable architecture boundary before runtime work so
future Pong, Space Invaders, and Asteroids implementations do not treat browser
state, solo leaderboard keys, or solo replay uploads as multiplayer authority.

The first multiplayer target is Pong, but the room, lobby, authority, score, and
shell decisions must not be Pong-only.

The production app should keep its current Next.js standalone packaging. Realtime
multiplayer needs WebSocket state and room fanout, but that should not require a
custom Next server or make the App Router process own long-lived socket runtime.

## Decision

Multiplayer will use private invite rooms, not matchmaking. A signed-in user
creates a room and becomes the room owner/host. Room invites use root launcher
URLs in the form `/?room=<code>`, where `<code>` identifies a private room.

Realtime multiplayer will use one reusable WebSocket sidecar behind the same
external proxy as the Next app. The proxy should route normal HTTP traffic to the
standalone Next server and upgrade the room WebSocket stream to the sidecar. The
Next app remains responsible for App Router pages and HTTP room bootstrap; it
must not be replaced with a custom Next server to host sockets.

The server remains the authoritative owner and orderer for room lifecycle, room
membership, game settings, game start/pause/restart commands, and canonical game
state. The host controls room settings and lifecycle commands, but the host
browser does not simulate the canonical game for the room. Clients send
validated intents; the server orders them, applies the selected game adapter, and
publishes authoritative state/events back to players and observers.

The durable multiplayer shape is one reusable private-room shell, one generic
realtime protocol/transport, one server runtime game-adapter registry, and one
client renderer/input registry. Pong is the first registered adapter and proof
point for the contract; it must not become the architecture that later games have
to route through.

## Participants

- `Host`: the signed-in room owner. The host can change room settings, start the
  game, pause or resume when the game supports pause, and restart the room.
  Server routes derive host ownership from the authenticated session, not from a
  client-submitted user id.
- `Player`: a participant occupying a game play slot. Non-host players may join
  as guests by entering a display name. Guest display names are room-scoped
  labels and are not profile identities.
- `Observer`: a non-playing participant who can join an active or waiting room
  at any time through the invite URL. Observers receive room state but cannot
  submit gameplay controls or host lifecycle commands.

The initial model only requires the host to be signed in. Later signed-in player
participation can be added without changing the private-room decision, but guest
participants must not be treated as profile owners.

## Invite And Lobby Flow

Room creation starts from a signed-in host action. If a signed-out user attempts
to create a room, the app should require sign-in before creating or owning the
room.

Opening `/?room=<code>` should resolve the room and enter a room-aware shell. If
the room is waiting for players, the shell shows lobby state, settings, join
controls, the invite URL, current players, and observer count. If the room is
already active, eligible guests can join open player slots when the game allows
it, and observers can join without waiting for a new round.

Room codes are private invite identifiers, not matchmaking queues or public
discovery handles. Invalid, expired, or unavailable room codes should fail into a
clear room-join state rather than silently starting a solo game.

## Realtime Transport

HTTP room bootstrap and WebSocket room streaming are separate responsibilities.
HTTP routes create rooms, resolve invite codes, validate host/player/observer
admission, return the initial room snapshot, and provide the connection details
needed for the active room stream. The WebSocket sidecar owns the long-lived
stream for waiting and active rooms after that bootstrap succeeds.

The transport is game-agnostic. Every message should use a shared room envelope
that identifies the room, game, participant/session context, role, message kind,
and server sequence when applicable. Generic room payloads cover lifecycle,
membership, settings, observer counts, errors, snapshots, and acknowledgements.
Gameplay payloads are adapter-owned data inside the shared envelope: Pong can
define paddle intents and state frames first, while Space Invaders and Asteroids
only influence the adapter shape until they have their own runtime work.

The browser room UI requires the WebSocket stream for live room snapshots,
guest-capable room commands, and game input. Public browser HTTP remains for
room creation, invite snapshot lookups, and authenticated host-only
lifecycle/settings commands, while the sidecar HTTP room service remains an
internal Next-to-sidecar bridge rather than a browser live-transport fallback.

The sidecar orders accepted client intents, applies the selected game adapter,
and publishes authoritative snapshots/events to connected players and observers.
Observers connect to the same room stream and receive lobby/game state, but the
server rejects observer gameplay controls and host lifecycle commands.

Reconnect should be sequence-aware. A returning participant or observer should
rejoin through the room identity established by bootstrap and resume from the
last acknowledged server sequence only when the sidecar still has the volatile
in-process events needed to catch up that cursor. If that in-memory window cannot
satisfy the cursor, the client receives a fresh authoritative snapshot before
continuing on the live stream. If the sidecar process restarted and the room is
gone, the in-progress game is abandoned and the room must be recreated. Clients
must not reconstruct canonical multiplayer state by replaying local browser
input.

## Shared Game Adapter Contract

The private-room shell owns invite resolution, lobby state, participant lists,
observer presentation, host controls, shared room status, and the active-room
container. It should render game-specific surfaces through a client registry
keyed by `gameId`, not by branching the shell around Pong.

The server runtime should route game-specific behavior through an adapter
registry keyed by `gameId`. Each adapter owns its settings defaults and
validation, required seats and role mapping, accepted input payloads, initial
state creation, deterministic application of ordered intents and server ticks,
authoritative snapshot projection, terminal result data, and any match-summary
fields. The room service owns room identity, membership, sequencing, admission,
host authorization, observer permissions, and dispatch to the selected adapter.

The client renderer/input registry should pair each `gameId` with a renderer
that consumes authoritative server snapshots/events and an input mapper that
emits adapter-owned intents through the generic transport envelope. Client
renderers may keep local UI affordance state such as pressed keys, but canonical
game state, score authority, replay derivation, and result ordering stay on the
server path.

## Space Invaders Two-Ship Co-op Rules

The Space Invaders co-op milestone should implement two independent player
ships, not a shared cannon. The private room has two required player seats:
`ship-a` and `ship-b`. Each seated player controls exactly one ship. Observers
can watch the shared board but cannot control either ship.

Both ships fight the same alien wave and contribute to one shared score. Lives
are also a shared team pool in this version, while ship positions, respawn
state, active power-ups, shots, and control input are player-specific where the
engine needs ownership.

Player ships do not collide with each other. They may overlap or pass through
each other without displacement or damage. Enemy shots can hit either ship. If a
single enemy shot collides with both ships on the same tick, both ships are
destroyed and the shared lives pool loses two lives. If only one shared life
remains in that simultaneous-hit case, the server chooses randomly which ship is
eligible to respawn from that last life.

Power-ups are awarded to the first ship that collects them. If a power-up touches
both ships on the same tick, the server chooses the recipient randomly. That
random choice is part of the authoritative server-ordered game state and must be
deterministic in tests.

## Asteroids Two-Ship Co-op Rules

The Asteroids co-op milestone should implement two independent player ships in
one shared asteroid field. The private room has two required player seats:
`ship-a` and `ship-b`. Each seated player controls exactly one ship. Observers
can watch the shared board but cannot control either ship.

Both ships share one score, one wave progression, one asteroid field, one saucer
state, and one lives pool. Ship position, heading, velocity, thrust state,
explosion state, respawn invulnerability, shot cooldown, and ship-specific
power-up upgrades are owned per ship.

Player ships pass through each other. They do not collide, bounce, block, damage
each other, or trigger friendly-fire outcomes. Player bullets do not hit
friendly ships, and player bullets do not collide with each other.

Asteroids can destroy either ship. If an asteroid overlaps both ships on the
same tick, both ships are destroyed and the shared lives pool loses two lives.
If only one shared life remains when both ships would otherwise spend a life on
the same tick, the server chooses randomly which ship receives that final
respawn path.

Saucers choose a random active ship as their firing target, using authoritative
server randomness that can be deterministic in tests. A saucer shot is consumed
by a collision and can destroy only one ship. If a saucer shot overlaps both
ships on the same tick, the server chooses randomly which hit ship is destroyed
and removes the shot after that single collision.

Power-up ownership is split by effect. Ship upgrades such as engine speed,
bullet speed, shield, and shot interval apply only to the ship that collects the
power-up. Team effects such as score and shared lives apply to the shared game
state. If both active ships touch the same power-up on one tick, the server
chooses one active touching ship randomly as the collector.

Ships respawn independently while the other ship can continue playing. Respawn
positions should be separated and safe-ish rather than stacking both ships on
the same point. Respawned ships receive invulnerability. The game ends only
after the final explosion finishes, matching the solo Asteroids feel, rather
than immediately when the shared lives pool reaches zero.

The initial terminal summary should stay compact: shared score, wave, remaining
lives, and occupied seats. Per-ship stats such as shots fired, deaths, pickups,
or contribution can be added later without changing the co-op rules above.

## Tank Patrol Two-Player Co-op Rules

These rules follow the original NES behavior documented by the public
[bit-exact Battle City disassembly](https://github.com/cyneprepou4uk/NES-Games-Disassembly/tree/main/Battle%20City)
and the supplied 26x26 stage projection.

Tank Patrol private rooms reproduce the original simultaneous two-player mode
with two required seats, `player-1` and `player-2`. Player 1 starts at terrain
coordinate `(24, 8)` and Player 2 at `(24, 16)`. Each begins with three lives
and independently owns score, enemy-type kill counts, the 20,000-point extra
life, tank upgrade tier, helmet protection, and respawn lifecycle.

The players share the stage, terrain, enemy wave, clock freeze, headquarters,
and fortress state. Player tanks block one another. Player 1 shells use object
slots `0` and `8`; Player 2 shells use `1` and `9`. Two-player stages permit
six simultaneous enemy tanks in slots `2` through `7`, and the stored enemy
spawn interval is 20 video frames shorter than the corresponding solo stage.
When enemies enter their player-pressure phase, even enemy slots pursue Player
1 and odd enemy slots pursue Player 2, falling back to the surviving player.

Friendly fire consumes the shell and, unless the teammate is protected by a
spawn or helmet shield, prevents that teammate from moving or turning for 200
eligible player-handler updates. The stunned tank may still fire, blinks while
disabled, and a further friendly hit does not extend the timer. Shells from the
two players can cancel one another, while one player's own primary and
secondary shells do not.

Power-up pickup score, stars, helmets, and tank lives belong to the collector.
Grenade, clock, and shovel effects apply to the shared battlefield. Power-up
placement avoids both active players, and Player 2 wins a same-frame pickup tie
because the original handler visits that player first.

A player who exhausts all lives becomes inactive for the rest of the current
stage while an individual side-entering game-over message plays and the
teammate continues. A score-earned extra life from a lingering shell can retain
that player for the next stage, but does not respawn them during the current
one. The team reaches central game over only after the headquarters is
destroyed or both players remain out after same-frame shell scoring and power-up
collection. Stage results keep separate player totals. On a cleared stage, a
surviving player with strictly more kills than the teammate receives 1,000
points; a tie receives no bonus. Multiplayer state and terminal summaries
remain server-authored and mode-scoped. The adapter freezes seat attribution
and the final outcome when the run first becomes terminal, so later room-seat
changes cannot rewrite the result. These rooms do not reuse the solo replay
upload, game-session, or leaderboard paths.

## Server Authority And Volatile Room State

The authoritative multiplayer stream is the sidecar's in-process room state plus
a server-ordered live event sequence while that room exists. The sidecar orders
room lifecycle events, participant role changes, host commands, accepted gameplay
intents, server ticks when a game requires ticks, settings versions, and
game-specific state changes for live publication and short reconnect catch-up.

Room state and per-event history are intentionally volatile. The sidecar does not
persist room inputs, ticks, power-up awards, lifecycle events, cursor windows, or
replay logs to SQLite or another durable store. This avoids spamming the
lightweight app database with high-frequency multiplayer traffic. If the sidecar
process restarts, waiting and active rooms owned by that process are lost; the
product accepts abandoning those in-progress games rather than reconstructing
them from durable per-event storage.

Existing solo replay modules remain examples of deterministic event capture for
solo play, but multiplayer should not reuse the solo client-upload replay
contract as authority and should not add a durable room replay log. A
multiplayer replay or match summary, if saved later, should be a compact terminal
summary derived from the authoritative server state before the room is discarded.
That summary should preserve room mode, participant roles, settings, final
state, and any final ordering data needed by profiles or leaderboards without
storing every room event.

Game adapters should expose deterministic state transition boundaries that the
room service can call. Pong can start with paddle intents and server ticks;
Space Invaders and Asteroids should be able to add richer input/control intents
without changing room identity, invite, lobby, observer, or leaderboard rules.

The sidecar should publish ordered room events to the live WebSocket stream and
may retain a bounded in-memory window for cursor catch-up. Durable storage, if
added for multiplayer at all, is limited to compact terminal summaries or
mode-scoped results and must consume server-derived final state instead of
trusting client-uploaded multiplayer history.

## Scores, Leaderboards, And Profiles

Multiplayer scores must use mode-scoped leaderboard keys and must not write to
solo leaderboard keys. A private-room Pong result should use a key that includes
the multiplayer mode, for example `pong|mode=private-room|board=420x560|target=5`,
instead of the current solo-style `pong|board=420x560|target=5` key.

Terminal multiplayer results should be mode-scoped before they are exposed to
leaderboards, profiles, replays, or match summaries. A game adapter may compute
game-specific result fields, but the room service should attach room mode,
participants, roles, settings, and the authoritative final event order so solo
and multiplayer outcomes remain separate.

Guest player display names may appear in room summaries and multiplayer
leaderboards, but they do not create profile sessions. Profile stats remain
signed-in and server-derived. If multiplayer profile history is added, it should
use explicit multiplayer session semantics and server-derived signed-in user
identity rather than reusing solo `game_sessions` behavior unchanged.

## Shared Components

Room UI should be built as reusable room/lobby/shell surfaces first, with
Pong-specific wrappers passing game-specific settings, slots, controls, board
state, and copy into those surfaces. The long-term target is for the same room
shell, invite link, participant list, observer presentation, host controls, and
lobby state components to support Pong, Space Invaders, and Asteroids.

Pong-specific components may exist for the first rollout, but they should avoid
owning generic room concepts that would later need to be extracted wholesale.
Treat Pong as the first client renderer/input adapter registered into the shared
room shell, not as the component hierarchy that other multiplayer games copy.
Where the existing game shell and board-action conventions fit, multiplayer
components should extend those patterns rather than introducing a parallel game
chrome.

## First Rollout Boundaries

The first implementation should target private Pong rooms only:

- signed-in host creates and owns a private room;
- invite URL uses `/?room=<code>`;
- HTTP bootstrap runs through the Next app while the active room stream runs
  through the reusable WebSocket sidecar behind the same proxy;
- guests join with display names;
- observers can join waiting or active rooms;
- host controls settings, start, pause/resume, and restart;
- server orders inputs and owns canonical Pong state;
- Pong is wired as the first server and client game adapter, while generic room
  behavior stays outside Pong-specific modules;
- multiplayer scores use mode-scoped keys;
- shared room/lobby/shell pieces are shaped for later reuse.

Out of scope for the first slice: matchmaking, public room discovery, peer-to-peer
host simulation, tournament queues, guest account creation, Space Invaders or
Asteroids runtime multiplayer, and replacing existing solo gameplay, solo replay,
or solo leaderboard behavior.

## Consequences

This decision keeps multiplayer authority on the server even for a host-owned
room, which avoids letting one browser become the trust boundary for other
players and observers. It also means future runtime work needs an explicit room
service, game adapter contract, WebSocket sidecar, and server-published state
stream rather than a thin wrapper around the current solo Pong component.

Keeping sockets in a sidecar preserves the standalone Next deployment boundary
and lets realtime runtime scale or restart independently from App Router HTTP
handling. It adds a proxy and service boundary that future implementation must
configure deliberately, but avoids coupling room fanout to a custom Next server.

Mode-scoped leaderboard keys preserve comparability between solo and multiplayer
runs. Room-scoped guest display names preserve low-friction joining while keeping
private profile data tied to authenticated sessions.
