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

## Decision

Multiplayer will use private invite rooms, not matchmaking. A signed-in user
creates a room and becomes the room owner/host. Room invites use root launcher
URLs in the form `/?room=<code>`, where `<code>` identifies a private room.

The server remains the authoritative owner and orderer for room lifecycle, room
membership, game settings, game start/pause/restart commands, and canonical game
state. The host controls room settings and lifecycle commands, but the host
browser does not simulate the canonical game for the room. Clients send
validated intents; the server orders them, applies the selected game adapter, and
publishes authoritative state/events back to players and observers.

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

## Scores, Leaderboards, And Profiles

Multiplayer scores must use mode-scoped leaderboard keys and must not write to
solo leaderboard keys. A private-room Pong result should use a key that includes
the multiplayer mode, for example `pong|mode=private-room|board=420x560|target=5`,
instead of the current solo-style `pong|board=420x560|target=5` key.

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
Where the existing game shell and board-action conventions fit, multiplayer
components should extend those patterns rather than introducing a parallel game
chrome.

## First Rollout Boundaries

The first implementation should target private Pong rooms only:

- signed-in host creates and owns a private room;
- invite URL uses `/?room=<code>`;
- guests join with display names;
- observers can join waiting or active rooms;
- host controls settings, start, pause/resume, and restart;
- server orders inputs and owns canonical Pong state;
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
service, game adapter contract, and server-published state stream rather than a
thin wrapper around the current solo Pong component.

Mode-scoped leaderboard keys preserve comparability between solo and multiplayer
runs. Room-scoped guest display names preserve low-friction joining while keeping
private profile data tied to authenticated sessions.
