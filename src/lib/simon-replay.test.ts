import { describe, expect, it } from "vitest";

import {
  getSimonDifficultySettings,
  SIMON_PADS,
  type SimonDifficulty,
  type SimonGameState,
  type SimonPadId,
} from "./simon-game-engine";
import { withReplayElapsed } from "./game-replay.test-helpers";
import {
  applySimonReplayEvent,
  createInitialSimonReplayGame,
  createSimonReplayLeaderboardKey,
  parseSimonReplayPayload,
  SIMON_REPLAY_SCHEMA_VERSION,
  type SimonReplayEvent,
  type SimonReplayEventInput,
  type SimonReplayPayload,
} from "./simon-replay";

type ReplayRecording = {
  events: SimonReplayEvent[];
  nextSeq: number;
  tick: number;
};

function createReplayPayload(
  overrides: Partial<SimonReplayPayload> = {},
): SimonReplayPayload {
  const difficulty = overrides.difficulty ?? "easy";
  const winTarget = overrides.winTarget ?? getSimonDifficultySettings(difficulty).winTarget;

  const payload = {
    difficulty,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        seq: 1,
        tick: 1,
        type: "playback",
      },
      {
        pad: "green",
        seq: 2,
        tick: 2,
        type: "pad",
      },
      {
        seq: 3,
        tick: 3,
        type: "clear",
      },
    ],
    finalInputIndex: 0,
    finalRound: 2,
    finalScore: 1,
    finalSequenceLength: 2,
    finalStatus: "lost",
    finalTick: 4,
    gameId: "simon",
    leaderboardKey: createSimonReplayLeaderboardKey({ difficulty }),
    runId: "run-1",
    schemaVersion: SIMON_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    winTarget,
    ...overrides,
  };

  return {
    ...payload,
    events: withReplayElapsed(payload.events),
  } as SimonReplayPayload;
}

function appendReplayEvent(
  recording: ReplayRecording,
  event: SimonReplayEventInput,
) {
  recording.events.push({
    ...event,
    elapsedMs: Math.max(0, recording.tick * 1_000 + recording.nextSeq),
    seq: recording.nextSeq,
    tick: recording.tick,
  } as unknown as SimonReplayEvent);
  recording.nextSeq += 1;
  recording.tick += 1;

  return recording.events.at(-1)!;
}

function appendAndApplyReplayEvent(
  recording: ReplayRecording,
  game: SimonGameState,
  event: SimonReplayEventInput,
  random: () => number,
) {
  return applySimonReplayEvent(game, appendReplayEvent(recording, event), random);
}

function finishShowingSequence(
  recording: ReplayRecording,
  game: SimonGameState,
  random: () => number,
) {
  let current = game;

  while (current.status === "showing") {
    current = appendAndApplyReplayEvent(recording, current, { type: "playback" }, random);
  }

  return current;
}

function getWrongPad(expectedPad: SimonPadId) {
  return SIMON_PADS.find((pad) => pad !== expectedPad) ?? "green";
}

function createTerminalReplay(finalStatus: "lost" | "won") {
  const seed = 5678;
  const difficulty = (finalStatus === "won" ? "easy" : "medium") satisfies SimonDifficulty;
  const winTarget = getSimonDifficultySettings(difficulty).winTarget;
  const initialReplay = createInitialSimonReplayGame({
    difficulty,
    seed,
    winTarget,
  });
  const recording: ReplayRecording = {
    events: [],
    nextSeq: 0,
    tick: 0,
  };
  let game = appendAndApplyReplayEvent(
    recording,
    initialReplay.game,
    { type: "start" },
    initialReplay.random,
  );

  while (game.status !== "lost" && game.status !== "won") {
    game = finishShowingSequence(recording, game, initialReplay.random);

    if (game.status !== "input") {
      throw new Error(`Expected Simon input phase, got ${game.status}.`);
    }

    const sequence = [...game.sequence];
    const pads =
      finalStatus === "lost"
        ? [getWrongPad(sequence[0] ?? "green")]
        : sequence;

    for (const pad of pads) {
      game = appendAndApplyReplayEvent(
        recording,
        game,
        {
          pad,
          type: "pad",
        },
        initialReplay.random,
      );

      if (game.status === "lost" || game.status === "won") {
        break;
      }

      if (game.activePad !== null) {
        game = appendAndApplyReplayEvent(
          recording,
          game,
          { type: "clear" },
          initialReplay.random,
        );
      }
    }

    if (game.status === "missed" && game.activePad !== null) {
      game = appendAndApplyReplayEvent(
        recording,
        game,
        { type: "clear" },
        initialReplay.random,
      );
    }

    if (game.status === "missed") {
      game = appendAndApplyReplayEvent(
        recording,
        game,
        { type: "advanceMiss" },
        initialReplay.random,
      );
    } else if (game.status === "correct") {
      game = appendAndApplyReplayEvent(
        recording,
        game,
        { type: "advanceRound" },
        initialReplay.random,
      );
    }
  }

  return createReplayPayload({
    events: recording.events,
    finalInputIndex: game.inputIndex,
    finalRound: game.round,
    finalScore: game.score,
    finalSequenceLength: game.sequence.length,
    finalStatus: game.status,
    finalTick: recording.tick,
    difficulty,
    leaderboardKey: createSimonReplayLeaderboardKey({ difficulty }),
    seed,
    winTarget,
  });
}

function applyReplayEvents(payload: SimonReplayPayload) {
  const initialReplay = createInitialSimonReplayGame(payload);

  return payload.events.reduce(
    (current, event) =>
      applySimonReplayEvent(current, event, initialReplay.random),
    initialReplay.game,
  );
}

describe("simon replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseSimonReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        events: expect.arrayContaining([
          expect.objectContaining({ type: "start" }),
          expect.objectContaining({ type: "playback" }),
          expect.objectContaining({ pad: "green", type: "pad" }),
          expect.objectContaining({ type: "clear" }),
        ]),
        finalRound: 2,
        finalScore: 1,
        gameId: "simon",
        difficulty: "easy",
        winTarget: 8,
      },
      success: true,
    });

    expect(
      parseSimonReplayPayload(
        createReplayPayload({
          leaderboardKey: "simon|target=8",
        }),
      ),
    ).toEqual({
      error: "Simon replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseSimonReplayPayload(
        createReplayPayload({
          winTarget: 0,
        }),
      ),
    ).toEqual({
      error: "Simon replay parameters are not supported.",
      success: false,
    });
    expect(
      parseSimonReplayPayload(
        createReplayPayload({
          difficulty: "expert" as SimonDifficulty,
          winTarget: 8,
        }),
      ),
    ).toEqual({
      error: "Simon replay parameters are not supported.",
      success: false,
    });
    expect(
      parseSimonReplayPayload(
        createReplayPayload({
          events: [
            {
              pad: "orange",
              seq: 0,
              tick: 0,
              type: "pad",
            } as unknown as SimonReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Simon replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseSimonReplayPayload(
        createReplayPayload({
          finalSequenceLength: 3,
        }),
      ),
    ).toEqual({
      error: "Simon replay final state is not supported.",
      success: false,
    });
  });

  it("accepts terminal won replay payloads at the target round", () => {
    const payload = createReplayPayload({
      finalInputIndex: 8,
      finalRound: 8,
      finalScore: 8,
      finalSequenceLength: 8,
      finalStatus: "won",
    });

    expect(parseSimonReplayPayload(payload)).toMatchObject({
      payload: {
        difficulty: "easy",
        finalInputIndex: 8,
        finalRound: 8,
        finalStatus: "won",
        winTarget: 8,
      },
      success: true,
    });
  });

  it("applies display, pad selection, flash, and round-advance events in order", () => {
    const payload = createReplayPayload({
      events: [],
      finalInputIndex: 0,
      finalRound: 2,
      finalScore: 1,
      finalSequenceLength: 2,
      finalStatus: "lost",
    });
    const initialReplay = createInitialSimonReplayGame(payload);
    const started = applySimonReplayEvent(
      initialReplay.game,
      { elapsedMs: 0, seq: 0, tick: 0, type: "start" },
      initialReplay.random,
    );
    const inputReady = applySimonReplayEvent(
      started,
      { elapsedMs: 1_000, seq: 1, tick: 1, type: "playback" },
      initialReplay.random,
    );
    const correctPad = inputReady.sequence[0]!;
    const correctFlash = applySimonReplayEvent(
      inputReady,
      { elapsedMs: 2_000, pad: correctPad, seq: 2, tick: 2, type: "pad" },
      initialReplay.random,
    );
    const correctPause = applySimonReplayEvent(
      correctFlash,
      { elapsedMs: 3_000, seq: 3, tick: 3, type: "clear" },
      initialReplay.random,
    );
    const nextRound = applySimonReplayEvent(
      correctPause,
      { elapsedMs: 4_000, seq: 4, tick: 4, type: "advanceRound" },
      initialReplay.random,
    );

    expect(started).toMatchObject({
      activePad: started.sequence[0],
      round: 1,
      status: "showing",
    });
    expect(inputReady).toMatchObject({
      activePad: null,
      inputIndex: 0,
      status: "input",
    });
    expect(correctFlash).toMatchObject({
      activePad: correctPad,
      inputIndex: 1,
      score: 1,
      status: "correct",
    });
    expect(correctPause).toMatchObject({
      activePad: null,
      status: "correct",
    });
    expect(nextRound).toMatchObject({
      activePad: nextRound.sequence[0],
      round: 2,
      score: 1,
      status: "showing",
    });
  });

  it("replays a generated terminal win to the same final Simon state", () => {
    const replay = createTerminalReplay("won");
    const firstResult = applyReplayEvents(replay);
    const secondResult = applyReplayEvents(replay);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      inputIndex: replay.finalInputIndex,
      round: replay.finalRound,
      score: replay.finalScore,
      sequence: expect.arrayContaining(replay.events.flatMap((event) =>
        event.type === "pad" ? [event.pad] : [],
      )),
      status: "won",
      difficulty: replay.difficulty,
      winTarget: replay.winTarget,
    });
    expect(firstResult.sequence).toHaveLength(replay.finalSequenceLength);
  });

  it("replays a generated miss to the same final Simon state", () => {
    const replay = createTerminalReplay("lost");
    const firstResult = applyReplayEvents(replay);
    const secondResult = applyReplayEvents(replay);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      activePad: null,
      inputIndex: replay.finalInputIndex,
      round: replay.finalRound,
      score: replay.finalScore,
      status: "lost",
      difficulty: replay.difficulty,
      winTarget: replay.winTarget,
    });
    expect(firstResult.sequence).toHaveLength(replay.finalSequenceLength);
  });
});
