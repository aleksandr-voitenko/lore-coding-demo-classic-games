import { describe, expect, it } from "vitest";

import { withReplayElapsed } from "./game-replay.test-helpers";
import {
  getMinesweeperDifficultySettings,
  getMinesweeperCellId,
  type MinesweeperGameState,
} from "./minesweeper-game-engine";
import {
  applyMinesweeperReplayEvent,
  createInitialMinesweeperReplayGame,
  createMinesweeperReplayLeaderboardKey,
  parseMinesweeperReplayPayload,
  shouldRecordMinesweeperReplayCursorEvent,
  MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION,
  MINESWEEPER_REPLAY_SCHEMA_VERSION,
  type MinesweeperReplayCursorEvent,
  type MinesweeperReplayEvent,
  type MinesweeperReplayPayload,
} from "./minesweeper-replay";

function createReplayPayload(
  overrides: Partial<MinesweeperReplayPayload> = {},
): MinesweeperReplayPayload {
  const difficulty = overrides.difficulty ?? "easy";
  const difficultySettings = getMinesweeperDifficultySettings(difficulty);
  const boardHeight = overrides.boardHeight ?? difficultySettings.height;
  const boardWidth = overrides.boardWidth ?? difficultySettings.width;
  const mineCount = overrides.mineCount ?? difficultySettings.mineCount;

  const payload = {
    boardHeight,
    boardWidth,
    cursorEvents: [
      {
        seq: 0,
        tick: 0,
        type: "cursorMove",
        x: 0.25,
        y: 0.75,
      },
      {
        seq: 1,
        tick: 1,
        type: "cursorMove",
        x: 0.5,
        y: 0.2,
      },
    ],
    difficulty,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        cellId: "3:3",
        seq: 1,
        tick: 0,
        type: "toggleFlag",
      },
      {
        cellId: "0:0",
        seq: 2,
        tick: 1,
        type: "reveal",
      },
    ],
    finalFlagCount: 1,
    finalRevealedSafeCellCount: 3,
    finalScore: 12,
    finalStatus: "lost",
    finalTick: 12,
    gameId: "minesweeper",
    leaderboardKey: createMinesweeperReplayLeaderboardKey({
      difficulty,
    }),
    mineCount,
    runId: "run-1",
    schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };

  return {
    ...payload,
    cursorEvents: withReplayElapsed(payload.cursorEvents) as MinesweeperReplayCursorEvent[],
    events: withReplayElapsed(payload.events),
  } as MinesweeperReplayPayload;
}

function applyReplayEvents(
  game: MinesweeperGameState,
  events: MinesweeperReplayEvent[],
  random: () => number,
) {
  return events.reduce(
    (current, event) => applyMinesweeperReplayEvent(current, event, random),
    game,
  );
}

function createTerminalReplay(seed: number) {
  const difficulty = "easy";
  const { height: boardHeight, mineCount, width: boardWidth } =
    getMinesweeperDifficultySettings(difficulty);
  const initialReplay = createInitialMinesweeperReplayGame({
    boardHeight,
    boardWidth,
    difficulty,
    mineCount,
    seed,
  });
  const random = initialReplay.random;
  const events: MinesweeperReplayEvent[] = [
    {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    },
    {
      cellId: getMinesweeperCellId(3, 3),
      elapsedMs: 1,
      seq: 1,
      tick: 0,
      type: "toggleFlag",
    },
    {
      cellId: getMinesweeperCellId(0, 0),
      elapsedMs: 1_000,
      seq: 2,
      tick: 1,
      type: "reveal",
    },
  ];
  let game = applyReplayEvents(initialReplay.game, events, random);
  const mine = game.cells.find((cell) => cell.isMine && !cell.isFlagged);

  if (mine === undefined) {
    throw new Error("Expected seeded Minesweeper replay to place an unflagged mine.");
  }

  events.push({
    cellId: mine.id,
    elapsedMs: 3_000,
    seq: events.length,
    tick: 3,
    type: "reveal",
  });
  game = applyMinesweeperReplayEvent(game, events.at(-1)!, random);

  if (game.status !== "lost") {
    throw new Error(`Expected generated replay to end lost, got ${game.status}.`);
  }

  return createReplayPayload({
    boardHeight,
    boardWidth,
    events,
    finalFlagCount: game.flagCount,
    finalRevealedSafeCellCount: game.revealedSafeCellCount,
    finalScore: 3,
    finalStatus: game.status,
    finalTick: 3,
    leaderboardKey: createMinesweeperReplayLeaderboardKey({
      difficulty,
    }),
    mineCount,
    seed,
  });
}

describe("minesweeper replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseMinesweeperReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardHeight: 9,
        boardWidth: 9,
        cursorEvents: [
          {
            type: "cursorMove",
            x: 0.25,
            y: 0.75,
          },
          {
            type: "cursorMove",
            x: 0.5,
            y: 0.2,
          },
        ],
        difficulty: "easy",
        events: [
          {
            type: "start",
          },
          {
            cellId: "3:3",
            type: "toggleFlag",
          },
          {
            cellId: "0:0",
            type: "reveal",
          },
        ],
        finalFlagCount: 1,
        finalRevealedSafeCellCount: 3,
        gameId: "minesweeper",
        mineCount: 10,
      },
      success: true,
    });

    expect(
      parseMinesweeperReplayPayload(
        createReplayPayload({
          leaderboardKey: "minesweeper|difficulty=medium",
        }),
      ),
    ).toEqual({
      error: "Minesweeper replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseMinesweeperReplayPayload(
        createReplayPayload({
          mineCount: 11,
        }),
      ),
    ).toEqual({
      error: "Minesweeper replay parameters are not supported.",
      success: false,
    });
    expect(
      parseMinesweeperReplayPayload(
        createReplayPayload({
          events: [
            {
              cellId: "9:0",
              seq: 0,
              tick: 0,
              type: "reveal",
            } as unknown as MinesweeperReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Minesweeper replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseMinesweeperReplayPayload(
        createReplayPayload({
          cursorEvents: [
            {
              elapsedMs: 0,
              seq: 0,
              tick: 0,
              type: "cursorMove",
              x: 1.1,
              y: 0.5,
            },
          ],
        }),
      ),
    ).toEqual({
      error: "Minesweeper replay includes an unsupported cursor event.",
      success: false,
    });
    expect(
      parseMinesweeperReplayPayload(
        createReplayPayload({
          finalRevealedSafeCellCount: 13,
          finalStatus: "won",
        }),
      ),
    ).toEqual({
      error: "Minesweeper replay final state is not supported.",
      success: false,
    });
  });

  it("parses legacy payloads without cursor events", () => {
    const legacyReplay = createReplayPayload({
      schemaVersion: MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION,
    });

    delete (legacyReplay as Partial<MinesweeperReplayPayload>).cursorEvents;

    expect(parseMinesweeperReplayPayload(legacyReplay)).toMatchObject({
      payload: {
        cursorEvents: [],
        schemaVersion: MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION,
      },
      success: true,
    });
  });

  it("samples replay cursor movement at most every 50 milliseconds", () => {
    expect(
      shouldRecordMinesweeperReplayCursorEvent({
        elapsedMs: 100,
        lastElapsedMs: null,
      }),
    ).toBe(true);
    expect(
      shouldRecordMinesweeperReplayCursorEvent({
        elapsedMs: 149,
        lastElapsedMs: 100,
      }),
    ).toBe(false);
    expect(
      shouldRecordMinesweeperReplayCursorEvent({
        elapsedMs: 149,
        force: true,
        lastElapsedMs: 100,
      }),
    ).toBe(true);
    expect(
      shouldRecordMinesweeperReplayCursorEvent({
        elapsedMs: 150,
        lastElapsedMs: 100,
      }),
    ).toBe(true);
  });

  it("accepts terminal won replay payloads with elapsed-second scores", () => {
    const payload = createReplayPayload({
      finalRevealedSafeCellCount: 71,
      finalScore: 9,
      finalStatus: "won",
      finalTick: 9,
    });

    expect(parseMinesweeperReplayPayload(payload)).toMatchObject({
      payload: {
        finalScore: 9,
        finalStatus: "won",
        finalTick: 9,
      },
      success: true,
    });
  });

  it("replays a seeded flag-first run to the same terminal Minesweeper state", () => {
    const replay = createTerminalReplay(4321);
    const first = createInitialMinesweeperReplayGame(replay);
    const second = createInitialMinesweeperReplayGame(replay);
    const firstResult = applyReplayEvents(first.game, replay.events, first.random);
    const secondResult = applyReplayEvents(second.game, replay.events, second.random);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      flagCount: replay.finalFlagCount,
      height: replay.boardHeight,
      mineCount: replay.mineCount,
      revealedSafeCellCount: replay.finalRevealedSafeCellCount,
      status: replay.finalStatus,
      width: replay.boardWidth,
    });
  });
});
