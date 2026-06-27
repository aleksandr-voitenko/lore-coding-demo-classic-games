# ADR 0002: Realtime Multiplayer Smoothing Model

Status: Accepted for implementation
Date: 2026-06-27

## Context

Private-room multiplayer now uses a reusable WebSocket sidecar that publishes
authoritative room snapshots. The current default sidecar cadence is 50ms, while
solo Pong and Asteroids advance at 16ms and Space Invaders advances at 34ms. If
the browser renders only each received authoritative snapshot, server-owned
motion can look stepped even though the server simulation is correct.

Lowering the sidecar to full 16ms snapshots is useful during local timing
experiments because it makes stepping easy to compare against the fastest local
game ticks. It is not the production strategy: it increases fanout, JSON
serialization, socket traffic, and client parsing for every subscribed room, and
it still does not solve jitter, packet delay, or short gaps between received
snapshots. Production multiplayer should keep the server authoritative and make
the browser smooth the visual path between server states.

The existing authority boundary from ADR 0001 remains unchanged. The sidecar and
server game adapters own canonical room state, accepted input ordering, ticks,
collisions, scoring, lives, power-up awards, terminal summaries, and server
sequence numbers. Clients may only predict or project what the player sees.

## Decision

Multiplayer renderers should consume authoritative snapshots as the source of
truth and maintain a separate visual presentation state. That visual state may
interpolate between recent server snapshots, project motion briefly from the
latest server snapshot, and predict the local player's own input response before
the next authoritative snapshot arrives.

Projection is visual-only. It must not create score changes, collision results,
life changes, power-up collection, random outcomes, terminal states, replay
events, or room sequence changes. Those outcomes remain server-authored and
arrive through snapshots or later event messages.

Local input prediction should apply only to the local player's controlled entity
and only for immediate visual responsiveness. The client still sends the input
intent to the sidecar; the server orders it and publishes the authoritative
result. Remote players and shared hazards should prefer interpolation or short
projection from server snapshots instead of inventing authoritative outcomes.

Reconciliation should compare the predicted visual state to each newer
authoritative snapshot. Small differences should blend toward the server state
over a short window so motion does not snap. Large differences, role changes,
round resets, terminal states, pause/resume, respawns, power-up awards, and score
or life changes should snap to the server state because correctness matters more
than visual continuity for those boundaries.

Visual projection should be bounded. The initial maximum projection window is
120ms from the newest authoritative snapshot, matching the existing Pong
multiplayer projection helper. Future game-specific projection helpers should
use 120ms or less unless a later ADR records why a different window is safe. If
no fresh snapshot arrives before that window expires, the renderer should hold
or ease toward the last authoritative state instead of continuing to simulate
farther ahead. This keeps short gaps smooth without letting the browser drift
into an alternate game.

## Snapshot Interval Guidance

Use these sidecar snapshot intervals while building and testing smoothing:

- `16ms`: local experiment mode. This approximates the fastest Pong and
  Asteroids tick cadence and is useful for comparing full-snapshot rendering
  against projected rendering. Do not treat it as the production answer.
- `33ms`: production-like smoothing mode. This approximates 30Hz authoritative
  snapshots while leaving the browser responsible for 60Hz visual rendering,
  interpolation, local prediction, and reconciliation.
- `50ms`: lower-bandwidth fallback. This is the current sidecar default and
  should remain usable with smoothing, but it needs the projection window above
  so visual state does not drift across longer gaps.

Server game adapters may continue to tick at game-specific rates. The sidecar
snapshot interval controls how often subscribed rooms are sampled and broadcast,
not how often the authoritative simulation is allowed to advance. A single
snapshot pump may catch up multiple server ticks and publish one fresh
authoritative snapshot for that room sequence.

## Consequences

Future client work needs a per-game visual adapter beside the existing
renderer/input adapter shape. That adapter should understand how to interpolate
or project game-specific positions while treating server-authored discrete
events as reconciliation boundaries.

Tests for the sidecar and runtime should characterize the current timing
contract: interval normalization, subscribed-room pumping, and catch-up behavior
must stay stable while visual smoothing is added above the transport layer.

This ADR does not require React room components, game projection code, new
protocol messages, or a production interval change in this slice.
