import { describe, expect, it } from "vitest";

import {
  applySpaceInvadersReplayEvent,
  createInitialSpaceInvadersReplayGame,
  createSpaceInvadersReplayLeaderboardKey,
  parseSpaceInvadersReplayPayload,
  SPACE_INVADERS_REPLAY_SCHEMA_VERSION,
  type SpaceInvadersReplayEvent,
  type SpaceInvadersReplayPayload,
  type SpaceInvadersReplayPlaybackState,
} from "./space-invaders-replay";

function createReplayPayload(
  overrides: Partial<SpaceInvadersReplayPayload> = {},
): SpaceInvadersReplayPayload {
  const alienCount = overrides.alienCount ?? 24;
  const boardHeight = overrides.boardHeight ?? 560;
  const boardWidth = overrides.boardWidth ?? 420;

  return {
    alienCount,
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        direction: "right",
        seq: 1,
        tick: 0,
        type: "move",
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
    finalInvaderCount: 8,
    finalLives: 0,
    finalScore: 160,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "space-invaders",
    leaderboardKey: createSpaceInvadersReplayLeaderboardKey({
      alienCount,
      boardHeight,
      boardWidth,
    }),
    runId: "run-1",
    schemaVersion: SPACE_INVADERS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  };
}

function applyReplayEvents(replay: SpaceInvadersReplayPayload) {
  return replay.events.reduce<SpaceInvadersReplayPlaybackState>(
    (current, event) => applySpaceInvadersReplayEvent(current, event),
    createInitialSpaceInvadersReplayGame(replay),
  );
}

function createTerminalLossReplay(seed: number) {
  const alienCount = 24;
  const boardHeight = 560;
  const boardWidth = 420;
  const replaySeed = {
    alienCount,
    boardHeight,
    boardWidth,
    seed,
  };
  const events: SpaceInvadersReplayEvent[] = [
    {
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let tick = 0;
  let replayState = createInitialSpaceInvadersReplayGame(replaySeed);

  replayState = applySpaceInvadersReplayEvent(replayState, events[0]!);

  while (replayState.game.status === "running" && events.length < 120_000) {
    const event: SpaceInvadersReplayEvent = {
      seq: events.length,
      tick,
      type: "advance",
    };

    events.push(event);
    replayState = applySpaceInvadersReplayEvent(replayState, event);
    tick += 1;
  }

  if (replayState.game.status !== "lost") {
    throw new Error(
      `Expected generated replay to end lost, got ${replayState.game.status}.`,
    );
  }

  return createReplayPayload({
    alienCount,
    boardHeight,
    boardWidth,
    events,
    finalInvaderCount: replayState.game.invaders.filter((invader) => invader.isActive)
      .length,
    finalLives: replayState.game.lives,
    finalScore: replayState.game.score,
    finalStatus: replayState.game.status,
    finalTick: tick,
    leaderboardKey: createSpaceInvadersReplayLeaderboardKey({
      alienCount,
      boardHeight,
      boardWidth,
    }),
    seed,
  });
}

describe("space invaders replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseSpaceInvadersReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        alienCount: 24,
        boardHeight: 560,
        boardWidth: 420,
        events: expect.arrayContaining([
          expect.objectContaining({ type: "move" }),
          expect.objectContaining({ type: "fire" }),
          expect.objectContaining({ type: "advance" }),
        ]),
        finalInvaderCount: 8,
        finalLives: 0,
        gameId: "space-invaders",
      },
      success: true,
    });

    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          leaderboardKey: "space-invaders|board=420x560|aliens=40",
        }),
      ),
    ).toEqual({
      error: "Space Invaders replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          alienCount: 55,
        }),
      ),
    ).toEqual({
      error: "Space Invaders replay parameters are not supported.",
      success: false,
    });
    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          events: [
            {
              direction: "up",
              seq: 0,
              tick: 0,
              type: "move",
            } as unknown as SpaceInvadersReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Space Invaders replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          finalLives: 1,
        }),
      ),
    ).toEqual({
      error: "Space Invaders replay final state is not supported.",
      success: false,
    });
  });

  it("supports terminal won replay payloads only when no invaders remain", () => {
    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          finalInvaderCount: 0,
          finalLives: 2,
          finalStatus: "won",
        }),
      ),
    ).toMatchObject({
      success: true,
    });
    expect(
      parseSpaceInvadersReplayPayload(
        createReplayPayload({
          finalInvaderCount: 1,
          finalLives: 2,
          finalStatus: "won",
        }),
      ),
    ).toEqual({
      error: "Space Invaders replay final state is not supported.",
      success: false,
    });
  });

  it("applies move, fire, and advance events", () => {
    const replay = createReplayPayload();
    const initialReplayState = createInitialSpaceInvadersReplayGame(replay);
    const replayState = applyReplayEvents(replay);

    expect(replayState.game.status).toBe("running");
    expect(replayState.game.player.x).toBeGreaterThan(
      initialReplayState.game.player.x,
    );
    expect(replayState.game.playerShots).toHaveLength(1);
    expect(replayState.game.nextPlayerShotId).toBe(1);
  });

  it("replays a seeded terminal loss to the same final Space Invaders state", () => {
    const replay = createTerminalLossReplay(4321);
    const firstResult = applyReplayEvents(replay);
    const secondResult = applyReplayEvents(replay);

    expect(firstResult.game).toEqual(secondResult.game);
    expect(firstResult.game).toMatchObject({
      alienCount: replay.alienCount,
      boardHeight: replay.boardHeight,
      boardWidth: replay.boardWidth,
      lives: replay.finalLives,
      score: replay.finalScore,
      status: replay.finalStatus,
    });
    expect(firstResult.game.invaders.filter((invader) => invader.isActive)).toHaveLength(
      replay.finalInvaderCount,
    );
  });
});
