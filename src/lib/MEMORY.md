# Library Memory

Deterministic engines and shared logic under `src/lib/`. Room contracts and
Node-only authority/storage have narrower context in
[multiplayer/MEMORY.md](multiplayer/MEMORY.md) and [server/MEMORY.md](server/MEMORY.md).

## Boundaries

- Keep `*-game-engine.ts` as the public facade for rules, scoring, progression,
  terminal states, and presets. Split cohesive internals under `<game>/` only
  when they justify the navigation cost; preserve public imports and state shapes.
- Inject randomness/time for deterministic transitions and tests. Keep browser
  events, timers, rendering, audio, and DOM effects in components; deterministic
  explosion, popup, and power-up state may belong in engines.
- Presets remain in game state so restart, replay, rendering, accessibility, and
  leaderboard keys retain the selected parameters.
- Space Invaders and Asteroids internals live in their named folders. Their
  `multiplayer-types.ts` contracts and `multiplayer-state.ts` solo/shared-state
  conversion and immutable cloning remain re-exported by multiplayer facades.
  Keep world/lifecycle orchestration in the game facades so collision, scoring,
  respawn, and RNG-call order stay auditable. Space Invaders mine-blast sequencing
  stays in its facade even though player-shot/effect helpers are extracted.
  Source: `LC-20260714-MPST`.

## Game-specific invariants

- Space Invaders cyan needles survive direct collisions with every player-shot
  kind in solo and co-op; player shields still absorb them. New solo recordings
  use replay V2. V1 playback explicitly selects destructible needles through
  `advanceSpaceInvadersGame`'s collision rules, preserving saved outcomes.
- Space Invaders co-op has independent `ship-a`/`ship-b` ships sharing score,
  alien wave, and lives. Ships pass through each other. One enemy shot may destroy
  both on the same tick and spend two lives; when only one life remains,
  authoritative randomness selects the respawning ship. Simultaneous power-up
  pickup also uses authoritative randomness (`space-invaders-multiplayer.ts`).
- Asteroids co-op shares score, wave, asteroid/saucer world, and lives across
  `ship-a`/`ship-b`. Position, velocity, explosion/respawn state, cooldowns, and
  upgrades remain per-ship. Ships pass through each other, friendly fire is off,
  and player bullets do not collide with each other. A body hazard can destroy
  both ships and spend two lives;
  randomness chooses the final respawn when only one life remains. Saucers target
  a random active ship; each shot destroys at most one randomly selected hit ship.
  Ship upgrades go to the collector, score/life effects to the team; simultaneous
  pickups use authoritative randomness. Independent respawns use separated
  positions and invulnerability. Game over waits for the last explosion; terminal
  summaries retain shared score/wave/lives and occupied-seat attribution
  (`asteroids-multiplayer.ts`, `asteroids/multiplayer-types.ts`).
- Snake pickup kinds and introduction thresholds derive from
  `SNAKE_PICKUP_INTRODUCTION_ORDER`; the additional level cap permits only red
  apples in level 1, yellow apples from level 2, purple diamonds from level 3,
  then subsequent kinds in order. Level generation owns size, obstacle coverage,
  doors, and key thresholds. Closed doors kill; entering an open door rebuilds
  level-local progression while preserving score and updating best score.
  Initial hazard placement reserves
  the snake, first red food, route to it, head neighbors, and the entire rightward
  starting lane (`snake-game-engine.ts`). `snake-food-feedback.ts` supplies pure
  pickup presentation metadata outside engine and React rendering.

## Tank Patrol

- Preserve the `battle-city` implementation, replay, persisted-id, and asset
  namespace. `battle-city-game-engine.ts` is the solo/co-op facade; geometry,
  ordered projectile resolution, scoring, and state predicates live in
  `battle-city/{geometry,projectiles,scoring,state}.ts`. Keep frame lifecycle and
  enemy/player/fire/spawn/pickup/ending sequencing in the facade
  (`LC-20260714-TPIR`).
- The 35 maps form a displayed Stage 1-70 cycle. Stages 36-70 reuse maps with
  the Stage 35 enemy mix, then reset to Stage 1 (`battle-city/stage-progression.ts`).
- Terrain is a 26x26 grid of 8x8-pixel cells with 4x4-pixel wall fragments. Tanks
  move in fractional 1/8-cell (one-pixel) steps; projectile positions are centers.
  Explicitly derive integer cells for terrain access. A normal shell probes a
  16-pixel face, removing up to four intact fragments across two touched cells;
  maximum shells clear both cells. Resolve terrain/headquarters before shell and
  tank collisions. Non-shield impacts hold their slots for nine frames; newborn
  shells collide at the muzzle before moving on the next frame.
- Explosion counters are **24 tank-handler updates** (`battle-city/constants.ts`,
  `battle-city-game-engine.projectiles.test.ts`): players update on three of four
  frames, fast enemies every frame, other enemy slots on alternating parity.
  Spawn counters are 28 handler updates: player spawning takes 37-38 video frames,
  enemy spawning 55-56 depending on frame/slot phase. Preserve these distinct
  cadences. Browser elapsed time accumulates into fixed 60.0988 Hz simulation
  frames (`battle-city/fixed-step.ts`), independently of callback frequency.
- Run enemy handlers before players, then player fire before the separate
  enemy-fire pass. Ordering determines collisions, activation, muzzle placement,
  and RNG trajectories. Rebase the frame clock at ending-tail entry and carry
  its phase through results and the next stage setup.
- `battle-city-multiplayer.ts` requires both `player-1`/`player-2` seats and starts
  Stage 1. Process P2 before P1 where original ordering matters. P1 starts at
  row 24/column 8, P2 at row 24/column 16, each with three lives. Scores, the
  one-time 20,000-point bonus-life flag, upgrades, shields, kill counts, shell
  slots, and elimination state are individual. Six enemies replace solo's four;
  the spawn interval is 20 ticks faster.
- Continue until headquarters loss or both players are eliminated. An eliminated
  player stays inactive for that stage with a side game-over marker; a late
  score-earned life can retain them for the following stage. Friendly shells are
  consumed; an unshielded active teammate receives `0xC8` player-handler updates
  of movement stun without losing a life and can still fire. Star, helmet, tank,
  pickup score, and score-earned lives belong to the collector; grenade, clock,
  and shovel affect the shared world. Results keep separate counts/scores; a
  surviving strict total-kill leader receives 1,000 points, with no tie bonus.
- Co-op snapshots/outcomes remain separate from solo replay V1 and the campaign
  leaderboard. While V1 uses this engine, preserve solo final-life and slot-sorted
  shell-collision behavior; multiplayer cross-player object-slot ordering stays
  behind the multiplayer-state guard (`LC-20260714-TPMP`).

## Shared clients and UI logic

- `leaderboard.ts` owns scoped keys, normalization, top-three ranking,
  pending-entry calculation, and client requests. `global-leaderboard.ts` selects
  default launcher targets; preserve separate game/parameter rankings and
  Minesweeper's ascending times. Snake progression uses `snake|mode=levels`.
- `user-profile.ts` owns shared auth/profile/session contracts, validation, and
  `/api/auth/*`, `/api/me`, `/api/game-sessions` clients.
- `game-catalog.ts` is the server-safe source of game ids, labels, artwork metadata,
  and versioned URLs. Launcher config enriches it with descriptions/parameters;
  `src/components/game-launcher-playables.ts` owns lazy components. Server pages
  must not import launcher config.
- `game-ui-flow.ts` owns pure Help and Escape/menu decisions;
  `src/components/game-ui-hooks.ts` applies pause/resume/navigation effects.
  `utils.ts` provides shared class-name merging.

## Browser social contract

- `social.ts` owns client-safe vocabulary, validation, entity ids, and canonical
  account-pair ordering. Exact discovery reuses normalized display-name keys from
  `user-profile.ts`: one minimal identity, no fuzzy directory. Passwordless legacy
  accounts cannot participate. SQLite transactions, authorization, and invitation
  admission stay server-side.
- `social-client.ts` validates successful payloads and typed errors, including
  numeric `Retry-After`. Accepted credentials must correlate to the requested
  invitation, recipient, participant, and authoritative snapshot.
  `social-mutation-coordinator.ts` fences async actions by account epoch and token,
  so old settlements cannot expose credentials or clear a newer pending action.
- `social-presence-client.ts` owns one cryptographic per-document lease id,
  serialized renew/release operations, and increasing operation generations.
  Renew every 15 seconds only while visible against the server's 45-second TTL;
  use best-effort keepalive release. Requests time out so a stall cannot block
  subsequent renewal/recovery. Server ordering, legacy rollout, and required
  handshake capabilities are documented in [server/MEMORY.md](server/MEMORY.md).
- Logout gives authenticated release a bounded head start before cookie deletion;
  TTL is the fallback. The signed-out update clears desired presence without a
  second request after cookie deletion; failed logout can resume the held lease.
  Source: `LC-20260803-SWEB`.

## Replays and verification

- `game-replay.ts` owns run ids, seeds, seeded RNG, active-play clocks, API/client
  helpers, base validation, and cursor sampling. Each `*-replay.ts` owns its
  game's payload parsing and deterministic event application. Record engine
  inputs/events, not video or board snapshots; each event requires active elapsed
  milliseconds and parsers reject missing timing. Minesweeper/Simon cursor streams
  use normalized board-local coordinates and never affect engine state.
- Tank Patrol uses run-length-encoded frame inputs and compact paused-frame spans.
  Playback checks reconstructed score, stage, cycle, lives, and headquarters
  against saved metadata (`src/components/battle-city-replay-player.tsx`,
  `LC-20260713-TPRP`).
- Nearby Vitest suites use injected randomness/time and explicit state fixtures.
  Prefer meaningful complete-state/structured assertions. Core coverage includes
  `src/lib/**/*.{ts,tsx}` (`vitest.coverage.core.config.ts`); keep pure behavior
  testable without DOM orchestration.
- [replay-compatibility/README.md](replay-compatibility/README.md) documents fixed
  seeded inputs and intermediate/terminal goldens for the nine solo games other
  than Tank Patrol, whose V1 goldens are in `battle-city-replay.test.ts`. Preserve
  old expectations while their schemas remain supported; review replay-version
  policy before intentional gameplay changes, and never regenerate goldens merely
  to make a refactor pass (`LC-20260905-2260`).
