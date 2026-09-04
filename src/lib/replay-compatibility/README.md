# Saved replay compatibility fixtures

These fixtures capture the unchanged game engines and replay adapters at commit
`721d749f26af3bec9eaec7f8e137e1701a66df7f`. They supplement the existing replay
repeatability tests with fixed expected outcomes, so changing an engine cannot
silently change both the test run and its expected result. Tank Patrol already
has fixed schema V1 outcomes in `../battle-city-replay.test.ts`.

Run them with:

```sh
npm test -- src/lib/replay-compatibility/replay-compatibility.test.ts
```

## Fixture format and scope

Each scenario's `payload` contains literal saved-replay metadata, including its
schema version, seed, initial parameters, leaderboard key, terminal score/status,
game-specific terminal fields, and `finalTick`. The test expands `eventRuns`,
passes the complete payload through the corresponding public replay parser,
requires the parsed payload to match, and initializes playback from that parsed
payload. Final game results must agree with the saved metadata.

An event run repeats its literal `event` exactly `count` times. Expansion assigns
zero-based `seq` values. `tick` starts at zero, is stamped before incrementing,
and increments only for the literal `tickEventTypes` recorded in the fixture.
These rules match the live recorders: Snake, Tetris, Breakout, Pong, Space
Invaders, and Asteroids advance on `advance`; Simon counts every semantic event;
2048 counts directional `move` inputs, including ineffective moves. Minesweeper
uses elapsed seconds rather than an event counter; this five-event fixture stays
within the first second, so all event ticks and its final time/score are zero.
The expanded terminal tick must equal the literal saved `finalTick`.

`elapsedMs = seq * 16` supplies fixed monotonic active-time timestamps. Snake's
`nowMs` and `expiresAt` values are fixed literals too. These are supported scripted
payloads, not captures of browser callback cadence. Existing cursor and playback
tests continue to cover scheduling and visual timing separately. Pong includes
the supported legacy and side-aware movement events, even though the current
solo UI only emits player-paddle inputs.

Checkpoint counts are the number of applied events; zero captures the initial
state. The test checks the readable partial state and the complete game-state
hash at each checkpoint and at the end. It also rejects a game that becomes
terminal before the final recorded input, even when later inputs would otherwise
leave that terminal board unchanged.

Hashes are SHA-256 over JSON with recursively sorted object keys and unchanged
array order. Integers remain exact. Finite fractional state values are rounded
to six decimal places to tolerate sub-pixel floating point differences across
platforms; the readable checkpoint values use the same normalization. No engine
inputs or gameplay calculations are rounded by these tests.

## Captured scenarios

| Game / schema / seed | Inputs / final tick | Checkpoints and behavior |
| --- | ---: | --- |
| Tetris / V1 / 4321 | 18 / 0 | Event 7: rotation, lateral movement, soft drop and first lock, score 35. Event 12: further seeded piece locks, score 167. Spawn collision loses at score 217 without a gravity tick. |
| Minesweeper / V3 / 1234 | 5 / 0 | Event 2: flag before mine placement. Event 3: protected first reveal places the seeded minefield and reveals eight safe cells. Unflagging and a fixed mine reveal lose. |
| Space Invaders / V1 / 4321 | 3,349 / 3,338 | Event 160: moved-player salvo scores 20. Events 500 and 1,000: enemy projectiles and recovery with two lives remaining. The fixed advance sequence ends lost with zero lives. |
| Asteroids / V3 / 4321 | 1,444 / 1,439 | Event 27: rotation, thrust and a fired bullet during initial protection. Event 250: protection expired. Event 750: one life spent. Continued hazards and saucer activity end the last explosion at zero lives. |
| Snake / V1 / 1234 | 141 / 98 | Events 48/59/71: five pickups spawn a key, its collection opens the exit, and entering it starts level 2 with score preserved and progression reset. Events 116/117/134: seeded timed apple spawn, exact expiry, and replacement-apple collection. Crossing the bottom wall loses at score 10. |
| Breakout / V1 / 4321 | 2,338 / 2,332 | Event 3: paddle movement with the ball attached before serving. Event 137: first scoring brick collision. Event 919: first lost life and ready serve. Seeded wall/brick/paddle bounces and three lost lives end at score 1,050. |
| Pong / V1 / 1234 | 1,045 / 667 | Event 43: legacy and side-aware paddle inputs move both paddles before serving. Event 124: CPU scores and the next left serve becomes ready. Event 274: CPU paddle return. Five lost rallies plus score ticks leave 450 points. Initial serve side is explicit; this replay adapter does not use the seed. |
| Simon / V3 / 5678, easy | 143 / 143 | Events 1/32/135: first seeded pad, round-four input, and partially completed final round. Eight correct sequences win. |
| Simon / V3 / 5678, medium | 39 / 39 | Events 1/32/37: first seeded pad, round-four input, and visible incorrect-pad feedback. The miss transition then loses at score 3. |
| 2048 / V1 / 4321 | 261 / 260 | Events 0/5/201: initial seeded tiles, first four directional inputs, and later merging/spawning. A blocked board loses after 258 effective moves at score 3,076. |

The JSON was captured once from the reference revision using temporary scripts.
During capture only, Snake used path search to discover a legal route through
food, key, exit, and timed apple. Simon followed the then-current seeded sequence;
Minesweeper selected a then-current mine; the continuous games advanced until
their captured terminal boundary. The resulting actions and outcomes are all
literal fixture data. Tests perform no path search, outcome discovery, or fixture
regeneration.

## Maintaining compatibility

Do not regenerate these fixtures just to make a refactor pass. A mismatch calls
for reviewing the changed state and event boundary against the documented source
revision and persisted replay schema. If gameplay changes intentionally, decide
the replay-version compatibility policy before replacing any expected outcome.
Keep old fixtures when their schema remains supported, and capture additional
scenarios for new behavior separately.
