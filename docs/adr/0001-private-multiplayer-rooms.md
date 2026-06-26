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

The old browser HTTP room-event polling path is a temporary compatibility
fallback while WebSocket room coverage lands. The user preference for this
milestone is that task 13 removes that fallback after WebSockets cover room
events; future adapter work should treat the WebSocket stream as the target live
transport rather than designing around a permanent polling path.

The sidecar orders accepted client intents, applies the selected game adapter,
and publishes authoritative snapshots/events to connected players and observers.
Observers connect to the same room stream and receive lobby/game state, but the
server rejects observer gameplay controls and host lifecycle commands.

Reconnect should be sequence-aware. A returning participant or observer should
rejoin through the room identity established by bootstrap, resume from the last
acknowledged server sequence when the event log can satisfy it, or receive a
fresh authoritative snapshot before continuing on the live stream. Clients must
not reconstruct canonical multiplayer state by replaying local browser input.

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

## Server Authority And Event Logs

The authoritative multiplayer stream is a server-ordered room event log plus
current room snapshot. The log should record room lifecycle events, participant
role changes, host commands, accepted gameplay intents, server ticks when a game
requires ticks, settings version, and enough game-specific data to reconstruct
or audit the canonical match.

Existing solo replay modules are useful examples because they record
deterministic events instead of video or board snapshots. Multiplayer should not
reuse the solo client-upload replay contract as authority. A multiplayer replay
or match summary, if saved, should be derived from the server-ordered room log
after the match and must preserve room mode, participant roles, settings, final
state, and the authoritative event ordering.

Game adapters should expose deterministic state transition boundaries that the
room service can call. Pong can start with paddle intents and server ticks;
Space Invaders and Asteroids should be able to add richer input/control intents
without changing room identity, invite, lobby, observer, or leaderboard rules.

The sidecar should publish the same ordered room events that feed the live
WebSocket stream into the event-log path. Durable storage, replay derivation, and
match summaries should consume that server-ordered path instead of trusting
client-uploaded multiplayer history.

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
