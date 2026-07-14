# Library Memory

This file covers deterministic game engines and shared source logic under
`src/lib/`.

## Engine Boundaries

- `*-game-engine.ts` files own deterministic rules, scoring, progression,
  win/loss states, launcher preset normalization, and state transitions.
- Keep `*-game-engine.ts` as the public facade imported by components and tests.
  Large engines may split implementation internals under `src/lib/<game>/`
  when cohesive subsystems outgrow one file, but smaller engines should stay
  single-file until the added navigation cost is justified.
- Space Invaders uses `src/lib/space-invaders/` internals behind
  `space-invaders-game-engine.ts`: `types.ts`, `constants.ts`, `formation.ts`,
  `hitboxes.ts`, `projectiles.ts`, `player-shots.ts`, `effects.ts`,
  `scoring.ts`, plus shared geometry/random helpers. Player-shot resolution and
  effect helpers are extracted; keep lifecycle ordering and mine-blast handling
  in the facade unless a later refactor can move them without obscuring
  cross-system behavior.
- The Space Invaders private-room co-op milestone is two independent ships, not
  a shared cannon. Seats are `ship-a` and `ship-b`; each player controls one
  ship; score, alien wave, and lives are shared. Player ships do not collide
  with each other. A simultaneous enemy-shot hit on both ships destroys both and
  spends two shared lives; if only one shared life remains, authoritative
  randomness chooses the respawning ship. If a power-up touches both ships on
  the same tick, authoritative randomness chooses the recipient.
- Asteroids uses `src/lib/asteroids/` internals behind
  `asteroids-game-engine.ts`: `types.ts`, `constants.ts`, `difficulty.ts`,
  `asteroids.ts`, `projectiles.ts`, `saucers.ts`, `power-ups.ts`, `scoring.ts`,
  `geometry.ts`, and `ship.ts`. Keep lifecycle/world tick orchestration in the
  facade so ship, bullet, asteroid, saucer, power-up, scoring, and respawn
  ordering stays easy to audit.
- Tank Patrol retains the internal `battle-city` namespace and uses
  `battle-city-game-engine.ts` as the deterministic facade for its single-player
  campaign and private-room co-op rules. The 35 maps form a displayed 70-stage
  cycle;
  Stages 36-70 reuse the maps with the Stage 35 enemy mix before resetting.
  Keep 26x26 terrain mutation, 4x4 wall fragments, tank and projectile
  collision, enemy spawning and decisions, headquarters defense, scoring,
  lives, and stage progression in pure library code.
  Tank coordinates are fractional 26x26-grid positions resolved in 1/8-cell
  (one original pixel) steps, while projectile coordinates are center points;
  terrain reads and mutations must always derive integer cells explicitly.
  A normal shell probes a 16-pixel face and removes up to four intact 4x4
  fragments across the two touched 8x8 cells; a maximum shell clears both
  touched cells. Resolve
  terrain/headquarters impacts before shell-vs-shell and tank collisions, keep
  non-shield impacts in their nine-frame slot-holding phase, and collision-test
  newborn shells at the muzzle before moving them on the next frame.
  Explosion counters represent 21 tank-handler updates: the player handler runs
  on three of four frames, fast enemies run every frame, and other enemy slots
  alternate parity. Do not replace these cadences with uniform wall-clock ticks.
  Spawn counters similarly represent 28 handler updates, so player spawning is
  37-38 video frames and enemy spawning is 55-56 depending on frame/slot phase.
  Run enemy tank handlers before the player handler, then resolve player fire
  before the separate enemy-fire pass; this ordering affects collisions,
  activation frames, muzzle placement, and deterministic RNG trajectories.
  Rebase the frame clock when an ending tail begins, then carry that phase
  through results and the following stage setup as the hardware does.
  Browser time is accumulated into fixed 60.0988 Hz simulation frames; do not
  couple gameplay speed directly to callback frequency.
  Private-room play uses `battle-city-multiplayer.ts` and the same deterministic
  engine, always starts Stage 1, and processes Player 2 before Player 1 where
  the original ordering matters. P1 spawns at row 24/column 8 and P2 at row
  24/column 16. Each player starts with three lives and owns their score,
  one-time 20,000-point bonus-life flag, upgrade tier, shield, kill counts,
  bullet slots, and elimination state. Continue while either player has lives;
  losing the headquarters or eliminating both ends the team run. An eliminated
  player stays inactive for the current stage, with a side game-over marker;
  a late score-earned life retains them for the following stage. Multiplayer
  permits six active enemies instead of four and advances the spawn interval by
  20 ticks.
  Friendly shells are consumed when they hit the teammate; an unshielded active
  teammate receives the original `0xC8` player-handler movement stun without
  losing a life and may still fire. Star, helmet, tank, pickup score, and the
  score-earned extra life apply to the collector; grenade, clock, and shovel
  alter shared world state. Stage results retain separate player counts and
  scores, and a surviving strict total-kill leader receives 1,000 points; a tie
  awards neither player. Keep the multiplayer snapshot/history path separate
  from the solo `battle-city` replay V1 contract and campaign leaderboard. As
  long as replay schema V1 uses the current engine, preserve its original solo
  final-life and slot-sorted shell-collision paths; multiplayer's cross-player
  object-slot ordering must remain behind the multiplayer-state guard.
- The Asteroids private-room co-op milestone is two independent ships in one
  shared asteroid field. Seats are `ship-a` and `ship-b`; each player controls
  one ship; score, wave, asteroid field, saucer state, and lives are shared.
  Ship position, velocity, explosion/respawn state, shot cooldown, and ship
  upgrade effects are per-ship. Player ships pass through each other, friendly
  fire is disabled, and player bullets do not collide with each other. An
  asteroid can destroy both ships on the same tick and spend two shared lives;
  if only one life remains in that case, authoritative randomness chooses the
  ship that receives the final respawn path. Saucer targeting chooses a random
  active ship, and each saucer shot is consumed after destroying at most one
  randomly chosen hit ship. Power-up ship upgrades apply to the collecting ship,
  shared score/life effects apply to the team, and simultaneous pickup by both
  ships is resolved by authoritative randomness. Ships respawn independently at
  separated safe-ish positions with invulnerability. Game over waits for the
  final explosion to finish. Terminal summaries initially include only shared
  score, wave, lives, and occupied seats.
- Engines that expose launcher presets keep those values in game state so
  restart, terminal replay, board rendering, accessibility labels, and leaderboard
  keys preserve the selected board size, difficulty, target, lives, alien
  count, or start level.
- Inject randomness, time, and explicit state fixtures into engine helpers when
  needed for deterministic behavior and tests.
- Keep browser events, timers, audio/visual effects, and DOM concerns outside
  engines. Components should schedule and render; engines should calculate.

## Shared Logic

- `leaderboard.ts` owns leaderboard key creation, normalization, sorting,
  top-three ranking, pending-entry calculation, and client fetch/submit helpers.
  Keys use stable game-and-parameter segments such as `snake|mode=levels` or
  `tetris|board=10x20|level=3`.
- `global-leaderboard.ts` owns the default leaderboard targets used by the
  launcher-level overview. Keep those targets aligned with default launcher game
  parameters and preserve Minesweeper's ascending timed ranking; do not use it
  for a single mixed cross-game or cross-parameter ranking.
- `user-profile.ts` owns shared auth, user, game-session, and profile-stat
  types; display-name/password/game-id/session-id validation; and client helpers
  for `/api/auth/*`, `/api/me`, and `/api/game-sessions`.
- `game-replay.ts` owns shared replay run ids, seed normalization, deterministic
  replay random creation, active-play replay clocks, API path/client helpers,
  base replay payload validation, and generic cursor coordinate
  validation/sampling helpers for all future game-specific replay modules.
- `snake-replay.ts`, `tetris-replay.ts`, `breakout-replay.ts`,
  `minesweeper-replay.ts`, `space-invaders-replay.ts`, `pong-replay.ts`,
  `simon-replay.ts`, `twenty-forty-eight-replay.ts`, `asteroids-replay.ts`, and
  `battle-city-replay.ts` own game-specific replay
  payload contracts, event parsing, and deterministic replay event application.
  Replay payloads record
  engine events such as direction changes, advances, timed-food lifecycle events,
  Tetris moves, rotations, soft drops, hard drops, Breakout
  starts/advances/paddle movement, Minesweeper reveals and flag toggles, Space
  Invaders start/move/fire/advance events, Pong
  starts/advances/paddle movement/score ticks, Simon phase/input events, 2048
  move directions, Asteroids starts/advances/control-state changes/fire events,
  and Tank Patrol starts/run-length-encoded frame-input advances/compact paused
  frame spans rather than video or full board snapshots. Playback verifies that
  the reconstructed terminal score, stage, cycle, lives, and headquarters state
  match the saved metadata. Each replay event requires
  active elapsed milliseconds; parsers reject payloads without event timing.
  Minesweeper and Simon additionally carry separate visual-only cursor event
  streams with board-local normalized coordinates; cursor events do not apply to
  the deterministic game engines.
- `game-catalog.ts` owns the pure playable-game id and label catalog plus
  server-safe card artwork metadata and versioned artwork URLs. Launcher config
  should enrich these entries with descriptions and parameters locally, while
  `src/components/game-launcher-playables.ts` keeps the dynamic playable
  component mapping; server pages should use catalog helpers instead of
  importing launcher config.
- `game-ui-flow.ts` owns pure Help and Escape/back-to-menu state transitions.
  React hooks in `src/components/game-ui-hooks.ts` should delegate decisions here
  and only apply effects such as pause, resume, or back-to-menu callbacks.
- `src/lib/multiplayer/` owns the pure private-room model and protocol types for
  multiplayer work. Keep it generic across games and free of WebSockets,
  route handlers, persistence stores, singleton room state, and React concerns.
- `snake-food-feedback.ts` keeps Snake pickup feedback metadata outside both the
  engine and React rendering code.
- Snake pickup progression order lives in
  `SNAKE_PICKUP_INTRODUCTION_ORDER` in `snake-game-engine.ts`; timed-food kinds
  and introduction thresholds are derived from that single order. Level
  progression applies an additional level-number cap so level 1 only has red
  apples, level 2 can unlock yellow apples, level 3 can unlock purple diamonds,
  and later levels continue through the same order.
- Snake level generation in `snake-game-engine.ts` owns the board-size formula,
  level-scaled obstacle coverage, door placement, key spawning threshold,
  closed-door collision loss, and open-door transition. Entering an open door
  creates the next level and preserves only the score from the previous level.
- Snake initial hazard safety reserves the starting snake, first red food,
  first-food route, immediate head neighbors, and the full row to the right of
  the initial head before door and obstacle generation. This keeps the default
  rightward start lane free of generated collision hazards.
- `utils.ts` provides shared utility glue such as class-name merging for shadcn
  and Tailwind components.

## Tests

- `src/lib/*.test.ts` contains deterministic Vitest coverage for engines, shared
  leaderboard behavior, utility helpers, Snake pickup feedback, and pure UI-flow
  transitions.
- When changing gameplay rules, add or update deterministic tests with injected
  randomness, time, or explicit state fixtures as needed.
- Prefer comparing meaningful game states or structured outputs over many
  isolated field assertions unless field-level assertions make failures clearer.
- Core coverage includes `src/lib/**/*.{ts,tsx}` with thresholded coverage. Keep
  pure logic reachable from Vitest instead of hiding important behavior behind
  DOM-only component flows.
