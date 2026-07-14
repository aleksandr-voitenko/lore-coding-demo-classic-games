import { describe, expect, it } from "vitest";

import {
  BATTLE_CITY_TICK_MS,
  type BattleCityFrameInput,
} from "./battle-city-game-engine";
import {
  applyBattleCityReplayAdvanceFrame,
  applyBattleCityReplayEvent,
  createBattleCityReplayLeaderboardKey,
  createInitialBattleCityReplayGame,
  getBattleCityReplayAdvanceFrameBatchSize,
  getBattleCityReplayAdvanceFrameElapsedMs,
  MAX_BATTLE_CITY_REPLAY_FRAMES,
  parseBattleCityReplayPayload,
  BATTLE_CITY_REPLAY_SCHEMA_VERSION,
  type BattleCityReplayEvent,
  type BattleCityReplayAdvanceEvent,
  type BattleCityReplayPayload,
  type BattleCityReplayPlaybackState,
} from "./battle-city-replay";

function createReplayPayload(
  overrides: Partial<BattleCityReplayPayload> = {},
): BattleCityReplayPayload {
  const payload = {
    events: [
      {
        elapsedMs: 5,
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        elapsedMs: 10,
        endElapsedMs: 20,
        frameCount: 2,
        input: {
          direction: "left",
          fireRequested: true,
        },
        seq: 1,
        tick: 0,
        type: "advance",
      },
      {
        elapsedMs: 20,
        frameCount: 3,
        seq: 2,
        tick: 2,
        type: "pause",
      },
      {
        elapsedMs: 20,
        seq: 3,
        tick: 5,
        type: "resume",
      },
      {
        elapsedMs: 30,
        endElapsedMs: 30,
        frameCount: 1,
        input: {
          direction: null,
          fireRequested: false,
        },
        seq: 4,
        tick: 5,
        type: "advance",
      },
    ],
    finalBaseAlive: false,
    finalCycle: 1,
    finalLives: 2,
    finalScore: 1_200,
    finalStage: 1,
    finalStatus: "lost",
    finalTick: 6,
    gameId: "battle-city",
    initialTick: 12,
    leaderboardKey: createBattleCityReplayLeaderboardKey(),
    runId: "run-1",
    schemaVersion: BATTLE_CITY_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-07-13T12:00:00.000Z",
    startingStage: 1,
    ...overrides,
  };

  return payload as BattleCityReplayPayload;
}

function applyReplayEvents(replay: BattleCityReplayPayload) {
  return replay.events.reduce<BattleCityReplayPlaybackState>(
    (current, event) => applyBattleCityReplayEvent(current, event),
    createInitialBattleCityReplayGame(replay),
  );
}

function createAdvanceEvent(
  seq: number,
  input: BattleCityFrameInput,
  { frameCount = 1, tick = seq }: { frameCount?: number; tick?: number } = {},
): BattleCityReplayAdvanceEvent {
  const elapsedMs = Math.round(tick * BATTLE_CITY_TICK_MS);

  return {
    elapsedMs,
    endElapsedMs: Math.round(
      elapsedMs + (frameCount - 1) * BATTLE_CITY_TICK_MS,
    ),
    frameCount,
    input,
    seq,
    tick,
    type: "advance",
  };
}

function createTerminalLossReplay(seed: number) {
  const replaySeed = {
    initialTick: 0,
    seed,
    startingStage: 1,
  } satisfies Pick<
    BattleCityReplayPayload,
    "initialTick" | "seed" | "startingStage"
  >;
  const startEvent: BattleCityReplayEvent = {
    elapsedMs: 0,
    seq: 0,
    tick: 0,
    type: "start",
  };
  const advanceEvent = createAdvanceEvent(
    1,
    {
      direction: null,
      fireRequested: false,
    },
    { frameCount: 1, tick: 0 },
  );
  let frameCount = 0;
  let replayState = createInitialBattleCityReplayGame(replaySeed);

  replayState = applyBattleCityReplayEvent(replayState, startEvent);

  while (replayState.game.status !== "lost" && frameCount < 20_000) {
    replayState = applyBattleCityReplayAdvanceFrame(replayState, advanceEvent);
    frameCount += 1;
  }

  if (replayState.game.status !== "lost") {
    throw new Error(
      `Expected generated Tank Patrol replay to end lost, got ${replayState.game.status}.`,
    );
  }

  advanceEvent.frameCount = frameCount;
  advanceEvent.endElapsedMs = Math.round(
    (frameCount - 1) * BATTLE_CITY_TICK_MS,
  );

  return createReplayPayload({
    events: [startEvent, advanceEvent],
    finalBaseAlive: replayState.game.baseAlive,
    finalCycle: replayState.game.cycle as 1 | 2,
    finalLives: replayState.game.lives,
    finalScore: replayState.game.score,
    finalStage: replayState.game.stage,
    finalStatus: replayState.game.status,
    finalTick: frameCount,
    ...replaySeed,
  });
}

function playLegacyV1Golden({
  initialTick,
  mode,
  seed,
}: {
  initialTick: number;
  mode: "passive" | "scripted" | "shooter";
  seed: number;
}) {
  const directionOrder = ["up", "right", "down", "left"] as const;
  let state = createInitialBattleCityReplayGame({
    initialTick,
    seed,
    startingStage: 1,
  });
  state = applyBattleCityReplayEvent(state, {
    elapsedMs: 0,
    seq: 0,
    tick: 0,
    type: "start",
  });
  const advanceEvent = createAdvanceEvent(1, {
    direction: null,
    fireRequested: false,
  });
  let frame = 0;

  while (state.game.status !== "lost" && frame < 200_000) {
    advanceEvent.input =
      mode === "passive"
        ? { direction: null, fireRequested: false }
        : mode === "shooter"
          ? { direction: "up", fireRequested: frame % 8 === 0 }
          : {
              direction: directionOrder[Math.floor(frame / 180) % 4]!,
              fireRequested: frame % 11 === 0,
            };
    state = applyBattleCityReplayAdvanceFrame(state, advanceEvent);
    frame += 1;
  }

  return {
    baseAlive: state.game.baseAlive,
    cycle: state.game.cycle,
    destroyedEnemyCount: state.game.destroyedEnemyCount,
    frame,
    initialTick,
    lives: state.game.lives,
    mode,
    score: state.game.score,
    seed,
    stage: state.game.stage,
    status: state.game.status,
    tick: state.game.tick,
  };
}

describe("Tank Patrol replay", () => {
  it("parses the campaign contract and rejects unsupported parameters, losses, and input", () => {
    expect(parseBattleCityReplayPayload(createReplayPayload())).toMatchObject({
      payload: {
        finalBaseAlive: false,
        finalCycle: 1,
        finalLives: 2,
        finalStage: 1,
        gameId: "battle-city",
        initialTick: 12,
        startingStage: 1,
      },
      success: true,
    });

    expect(
      parseBattleCityReplayPayload(
        createReplayPayload({
          leaderboardKey: "battle-city|mode=single-stage",
        }),
      ),
    ).toEqual({
      error: "Tank Patrol replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(createReplayPayload({ startingStage: 36 })),
    ).toEqual({
      error: "Tank Patrol replay parameters are not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(createReplayPayload({ initialTick: -1 })),
    ).toEqual({
      error: "Tank Patrol replay parameters are not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(
        createReplayPayload({
          finalBaseAlive: true,
          finalLives: 1,
        }),
      ),
    ).toEqual({
      error: "Tank Patrol replay final state is not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(
        createReplayPayload({
          events: [
            {
              elapsedMs: 0,
              endElapsedMs: 0,
              frameCount: 1,
              input: {
                direction: "diagonal",
                fireRequested: false,
              },
              seq: 0,
              tick: 0,
              type: "advance",
            } as unknown as BattleCityReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Tank Patrol replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(
        createReplayPayload({
          events: [],
          finalTick: 0,
        }),
      ),
    ).toEqual({
      error: "Tank Patrol replay event sequence is not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(createReplayPayload({ finalTick: 7 })),
    ).toEqual({
      error: "Tank Patrol replay event sequence is not supported.",
      success: false,
    });
    expect(
      parseBattleCityReplayPayload(
        createReplayPayload({
          events: [
            {
              elapsedMs: 0,
              seq: 0,
              tick: 0,
              type: "start",
            },
            createAdvanceEvent(
              1,
              { direction: null, fireRequested: false },
              {
                frameCount: MAX_BATTLE_CITY_REPLAY_FRAMES + 1,
                tick: 0,
              },
            ),
          ],
          finalTick: MAX_BATTLE_CITY_REPLAY_FRAMES + 1,
        }),
      ),
    ).toEqual({
      error: "Tank Patrol replay includes an unsupported event.",
      success: false,
    });
  });

  it("recreates the selected ready state including its pre-start frame offset", () => {
    const replayState = createInitialBattleCityReplayGame(
      createReplayPayload({
        initialTick: 87,
        startingStage: 23,
      }),
    );

    expect(replayState.game).toMatchObject({
      cycle: 1,
      stage: 23,
      status: "ready",
      tick: 87,
    });
  });

  it("applies the exact movement and fire input consumed by an advance frame", () => {
    const initial = createInitialBattleCityReplayGame(
      createReplayPayload({ initialTick: 0 }),
    );
    const running: BattleCityReplayPlaybackState = {
      ...initial,
      game: {
        ...initial.game,
        player: {
          ...initial.game.player,
          phase: "active",
          phaseTicks: 0,
        },
        status: "running",
      },
    };
    const advanced = applyBattleCityReplayEvent(
      running,
      createAdvanceEvent(0, {
        direction: "left",
        fireRequested: true,
      }),
    );

    expect(advanced.game.player.col).toBeLessThan(running.game.player.col);
    expect(advanced.game.bullets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "left",
          owner: "player",
        }),
      ]),
    );
  });

  it("preserves paused frame advancement before resuming play", () => {
    const initial = createInitialBattleCityReplayGame(createReplayPayload());
    const running: BattleCityReplayPlaybackState = {
      ...initial,
      game: {
        ...initial.game,
        stageBattleTicks: 14,
        status: "running",
        tick: 31,
      },
    };
    const paused = applyBattleCityReplayEvent(running, {
      elapsedMs: 0,
      frameCount: 7,
      seq: 0,
      tick: 0,
      type: "pause",
    });
    const resumed = applyBattleCityReplayEvent(paused, {
      elapsedMs: 0,
      seq: 1,
      tick: 7,
      type: "resume",
    });

    expect(paused.game.status).toBe("paused");
    expect(paused.game).toMatchObject({
      stageBattleTicks: 21,
      status: "paused",
      tick: 38,
    });
    expect(resumed.game.status).toBe("running");
  });

  it("applies compressed advance runs while preserving their playback timing", () => {
    const event = createAdvanceEvent(
      0,
      {
        direction: null,
        fireRequested: false,
      },
      { frameCount: 3, tick: 0 },
    );

    event.elapsedMs = 100;
    event.endElapsedMs = 140;

    expect(
      [0, 1, 2].map((frameIndex) =>
        getBattleCityReplayAdvanceFrameElapsedMs(event, frameIndex),
      ),
    ).toEqual([100, 120, 140]);

    const initial = createInitialBattleCityReplayGame(
      createReplayPayload({ initialTick: 0 }),
    );
    const running = applyBattleCityReplayEvent(initial, {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    });
    const advanced = applyBattleCityReplayEvent(running, event);

    expect(advanced.game.tick).toBe(running.game.tick + 3);
  });

  it("batches only bounded advance frames that share one playback timestamp", () => {
    const sameTimeEvent = createAdvanceEvent(
      0,
      {
        direction: null,
        fireRequested: false,
      },
      { frameCount: 20_000, tick: 0 },
    );
    const timedEvent = createAdvanceEvent(
      1,
      {
        direction: null,
        fireRequested: false,
      },
      { frameCount: 3, tick: 0 },
    );
    const roundedTimedEvent = createAdvanceEvent(
      2,
      {
        direction: null,
        fireRequested: false,
      },
      { frameCount: 4, tick: 0 },
    );

    sameTimeEvent.elapsedMs = 100;
    sameTimeEvent.endElapsedMs = 100;
    timedEvent.elapsedMs = 100;
    timedEvent.endElapsedMs = 140;
    roundedTimedEvent.elapsedMs = 100;
    roundedTimedEvent.endElapsedMs = 101;

    const batchSize = getBattleCityReplayAdvanceFrameBatchSize(
      sameTimeEvent,
      0,
    );

    expect(batchSize).toBe(128);
    expect(
      getBattleCityReplayAdvanceFrameBatchSize(
        sameTimeEvent,
        sameTimeEvent.frameCount - 1,
      ),
    ).toBe(1);
    expect(getBattleCityReplayAdvanceFrameBatchSize(timedEvent, 0)).toBe(1);
    expect(
      getBattleCityReplayAdvanceFrameBatchSize(roundedTimedEvent, 0),
    ).toBe(2);
    expect(
      getBattleCityReplayAdvanceFrameBatchSize(roundedTimedEvent, 2),
    ).toBe(2);
  });

  it("replays a seeded terminal loss to the same complete Tank Patrol state", () => {
    const replay = createTerminalLossReplay(4_321);
    const firstResult = applyReplayEvents(replay);
    const secondResult = applyReplayEvents(replay);

    expect(parseBattleCityReplayPayload(replay)).toMatchObject({ success: true });
    expect(firstResult.game).toEqual(secondResult.game);
    expect(firstResult.game).toMatchObject({
      baseAlive: replay.finalBaseAlive,
      cycle: replay.finalCycle,
      lives: replay.finalLives,
      score: replay.finalScore,
      stage: replay.finalStage,
      status: replay.finalStatus,
    });
  });

  it("preserves deterministic schema V1 outcomes from before multiplayer", () => {
    expect(
      [
        { initialTick: 0, mode: "passive", seed: 4_321 },
        { initialTick: 0, mode: "shooter", seed: 2_468 },
        { initialTick: 37, mode: "scripted", seed: 9_876 },
      ].map((scenario) =>
        playLegacyV1Golden(
          scenario as Parameters<typeof playLegacyV1Golden>[0],
        ),
      ),
    ).toEqual([
      {
        baseAlive: false,
        cycle: 1,
        destroyedEnemyCount: 0,
        frame: 3_573,
        initialTick: 0,
        lives: 0,
        mode: "passive",
        score: 0,
        seed: 4_321,
        stage: 1,
        status: "lost",
        tick: 556,
      },
      {
        baseAlive: true,
        cycle: 1,
        destroyedEnemyCount: 1,
        frame: 2_413,
        initialTick: 0,
        lives: 0,
        mode: "shooter",
        score: 100,
        seed: 2_468,
        stage: 1,
        status: "lost",
        tick: 565,
      },
      {
        baseAlive: false,
        cycle: 1,
        destroyedEnemyCount: 0,
        frame: 1_168,
        initialTick: 37,
        lives: 3,
        mode: "scripted",
        score: 0,
        seed: 9_876,
        stage: 1,
        status: "lost",
        tick: 556,
      },
    ]);
  });
});
