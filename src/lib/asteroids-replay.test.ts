import { describe, expect, it } from "vitest";

import {
  applyAsteroidsReplayEvent,
  createAsteroidsReplayLeaderboardKey,
  createInitialAsteroidsReplayGame,
  parseAsteroidsReplayPayload,
  ASTEROIDS_REPLAY_SCHEMA_VERSION,
  type AsteroidsReplayEvent,
  type AsteroidsReplayPayload,
  type AsteroidsReplayPlaybackState,
} from "./asteroids-replay";

function createReplayPayload(
  overrides: Partial<AsteroidsReplayPayload> = {},
): AsteroidsReplayPayload {
  const boardHeight = overrides.boardHeight ?? 480;
  const boardWidth = overrides.boardWidth ?? 640;
  const startingAsteroidCount = overrides.startingAsteroidCount ?? 6;

  return {
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        controls: {
          rotateLeft: false,
          rotateRight: true,
          thrust: true,
        },
        seq: 1,
        tick: 0,
        type: "control",
      },
      {
        seq: 2,
        tick: 0,
        type: "fire",
      },
      {
        seq: 3,
        tick: 0,
        type: "advance",
      },
    ],
    finalAsteroidCount: 5,
    finalLives: 0,
    finalScore: 120,
    finalStatus: "lost",
    finalTick: 1,
    finalWave: 2,
    gameId: "asteroids",
    leaderboardKey: createAsteroidsReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingAsteroidCount,
    }),
    runId: "run-1",
    schemaVersion: ASTEROIDS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-09T12:00:00.000Z",
    startingAsteroidCount,
    ...overrides,
  };
}

function applyReplayEvents(replay: AsteroidsReplayPayload) {
  return replay.events.reduce<AsteroidsReplayPlaybackState>(
    (current, event) => applyAsteroidsReplayEvent(current, event),
    createInitialAsteroidsReplayGame(replay),
  );
}

function createTerminalReplay(seed: number) {
  const boardHeight = 480;
  const boardWidth = 640;
  const startingAsteroidCount = 6;
  const replaySeed = {
    boardHeight,
    boardWidth,
    seed,
    startingAsteroidCount,
  };
  const events: AsteroidsReplayEvent[] = [
    {
      seq: 0,
      tick: 0,
      type: "start",
    },
    {
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: true,
      },
      seq: 1,
      tick: 0,
      type: "control",
    },
  ];
  let tick = 0;
  let replayState = createInitialAsteroidsReplayGame(replaySeed);

  replayState = applyAsteroidsReplayEvent(replayState, events[0]!);
  replayState = applyAsteroidsReplayEvent(replayState, events[1]!);

  while (replayState.game.status === "running" && events.length < 120_000) {
    const event: AsteroidsReplayEvent = {
      seq: events.length,
      tick,
      type: "advance",
    };

    events.push(event);
    replayState = applyAsteroidsReplayEvent(replayState, event);
    tick += 1;
  }

  if (replayState.game.status !== "lost") {
    throw new Error(
      `Expected generated replay to end lost, got ${replayState.game.status}.`,
    );
  }

  return createReplayPayload({
    boardHeight,
    boardWidth,
    events,
    finalAsteroidCount: replayState.game.asteroids.length,
    finalLives: replayState.game.lives,
    finalScore: replayState.game.score,
    finalStatus: replayState.game.status,
    finalTick: tick,
    finalWave: replayState.game.wave,
    leaderboardKey: createAsteroidsReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingAsteroidCount,
    }),
    seed,
    startingAsteroidCount,
  });
}

describe("asteroids replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseAsteroidsReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardHeight: 480,
        boardWidth: 640,
        events: expect.arrayContaining([
          expect.objectContaining({ type: "control" }),
          expect.objectContaining({ type: "fire" }),
          expect.objectContaining({ type: "advance" }),
        ]),
        finalAsteroidCount: 5,
        finalLives: 0,
        gameId: "asteroids",
        startingAsteroidCount: 6,
      },
      success: true,
    });

    expect(
      parseAsteroidsReplayPayload(
        createReplayPayload({
          leaderboardKey: "asteroids|board=640x480|rocks=4",
        }),
      ),
    ).toEqual({
      error: "Asteroids replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseAsteroidsReplayPayload(
        createReplayPayload({
          startingAsteroidCount: 5,
        }),
      ),
    ).toEqual({
      error: "Asteroids replay parameters are not supported.",
      success: false,
    });
    expect(
      parseAsteroidsReplayPayload(
        createReplayPayload({
          events: [
            {
              controls: {
                rotateLeft: true,
                rotateRight: false,
              },
              seq: 0,
              tick: 0,
              type: "control",
            } as unknown as AsteroidsReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Asteroids replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseAsteroidsReplayPayload(
        createReplayPayload({
          finalLives: 1,
        }),
      ),
    ).toEqual({
      error: "Asteroids replay final state is not supported.",
      success: false,
    });
  });

  it("rejects terminal won replay payloads because Asteroids is endless", () => {
    expect(
      parseAsteroidsReplayPayload(
        createReplayPayload({
          finalStatus: "won",
        }),
      ),
    ).toEqual({
      error: "Asteroids replay final state is not supported.",
      success: false,
    });
  });

  it("applies control, fire, and advance events", () => {
    const replay = createReplayPayload();
    const replayState = applyReplayEvents(replay);

    expect(replayState.controls).toEqual({
      rotateLeft: false,
      rotateRight: true,
      thrust: true,
    });
    expect(replayState.game.status).toBe("running");
    expect(replayState.game.bullets).toHaveLength(1);
    expect(replayState.game.ship.angle).toBe(277);
    expect(replayState.game.ship.isThrusting).toBe(true);
  });

  it("replays a seeded terminal loss to the same final Asteroids state", () => {
    const replay = createTerminalReplay(4321);
    const firstResult = applyReplayEvents(replay);
    const secondResult = applyReplayEvents(replay);

    expect(firstResult.game).toEqual(secondResult.game);
    expect(firstResult.controls).toEqual(secondResult.controls);
    expect(firstResult.game).toMatchObject({
      boardHeight: replay.boardHeight,
      boardWidth: replay.boardWidth,
      lives: replay.finalLives,
      score: replay.finalScore,
      startingAsteroidCount: replay.startingAsteroidCount,
      status: replay.finalStatus,
      wave: replay.finalWave,
    });
    expect(firstResult.game.asteroids).toHaveLength(replay.finalAsteroidCount);
  });
});
