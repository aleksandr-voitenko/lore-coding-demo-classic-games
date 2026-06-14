import { describe, expect, it } from "vitest";

import {
  advanceSimonMiss,
  advanceSimonPlayback,
  advanceSimonRound,
  clearSimonActivePad,
  createInitialSimonGame,
  getSimonDifficultySettings,
  getSimonMissFeedbackDelay,
  getSimonRoundCompleteDelay,
  getRandomSimonPad,
  normalizeSimonDifficulty,
  pauseSimonGame,
  playSimonPad,
  restartSimonGame,
  startSimonGame,
  type SimonGameState,
  type SimonPadId,
} from "./simon-game-engine";

function createRandomSource(values: number[]) {
  let index = 0;

  return () => values[index++] ?? values.at(-1) ?? 0;
}

function createInputGame(overrides: Partial<SimonGameState> = {}): SimonGameState {
  return {
    ...createInitialSimonGame(),
    round: 3,
    sequence: ["green", "red", "blue"],
    status: "input",
    ...overrides,
  };
}

function finishShowing(game: SimonGameState) {
  let current = game;

  while (current.status === "showing") {
    current = advanceSimonPlayback(current);
  }

  return current;
}

describe("simon game engine", () => {
  it("creates a ready game with difficulty-derived target settings", () => {
    const game = createInitialSimonGame({ difficulty: "hard" });

    expect(game).toMatchObject({
      activePad: null,
      difficulty: "hard",
      inputIndex: 0,
      playbackIndex: 0,
      round: 0,
      score: 0,
      sequence: [],
      status: "ready",
      winTarget: 16,
    });
    expect(getSimonDifficultySettings("easy").winTarget).toBe(8);
    expect(normalizeSimonDifficulty("expert")).toBe("medium");
  });

  it("maps deterministic random values to the four classic pads", () => {
    const random = createRandomSource([0, 0.25, 0.5, 0.75, 1]);
    const pads = Array.from({ length: 5 }, () => getRandomSimonPad(random));

    expect(pads).toEqual(["green", "red", "yellow", "blue", "blue"]);
  });

  it("starts the first round with a deterministic sequence and playback pad", () => {
    const game = startSimonGame(createInitialSimonGame(), {
      random: createRandomSource([0.51]),
    });

    expect(game).toMatchObject({
      activePad: "yellow",
      round: 1,
      score: 0,
      sequence: ["yellow"],
      status: "showing",
    });
  });

  it("advances playback through the sequence before accepting input", () => {
    const showingGame = {
      ...createInitialSimonGame(),
      activePad: "green" as SimonPadId,
      playbackIndex: 0,
      round: 2,
      sequence: ["green", "blue"] as SimonPadId[],
      status: "showing" as const,
    };
    const firstGap = advanceSimonPlayback(showingGame);
    const secondPad = advanceSimonPlayback(firstGap);
    const secondGap = advanceSimonPlayback(secondPad);

    expect(firstGap).toMatchObject({
      activePad: null,
      playbackIndex: 1,
      status: "showing",
    });
    expect(secondPad).toMatchObject({
      activePad: "blue",
      playbackIndex: 1,
      status: "showing",
    });
    expect(secondGap).toMatchObject({
      activePad: null,
      inputIndex: 0,
      playbackIndex: 0,
      status: "input",
    });
  });

  it("tracks correct input and flashes the pressed pad without mutating the sequence", () => {
    const game = createInputGame();
    const firstInput = playSimonPad(game, "green");
    const clearedInput = clearSimonActivePad(firstInput);

    expect(firstInput).toMatchObject({
      activePad: "green",
      inputIndex: 1,
      score: 0,
      sequence: game.sequence,
      status: "input",
    });
    expect(clearedInput.activePad).toBeNull();
  });

  it("pauses on a correct round before adding the next deterministic pad", () => {
    const game = createInputGame({
      inputIndex: 2,
      score: 1,
      sequence: ["green", "red", "blue"],
    });
    const correctGame = playSimonPad(game, "blue");
    const nextRound = advanceSimonRound(correctGame, {
      random: createRandomSource([0.26]),
    });

    expect(getSimonRoundCompleteDelay()).toBe(1_000);
    expect(correctGame).toMatchObject({
      activePad: "blue",
      inputIndex: 3,
      playbackIndex: 0,
      round: 3,
      score: 3,
      sequence: ["green", "red", "blue"],
      status: "correct",
    });
    expect(nextRound).toMatchObject({
      activePad: "green",
      inputIndex: 0,
      playbackIndex: 0,
      round: 4,
      score: 3,
      sequence: ["green", "red", "blue", "red"],
      status: "showing",
    });
  });

  it("clears the final correct input flash while preserving the round pause", () => {
    const correctGame = {
      ...createInputGame({
        activePad: "red",
        inputIndex: 2,
        sequence: ["green", "red"],
      }),
      status: "correct" as const,
    };
    const clearedGame = clearSimonActivePad(correctGame);

    expect(clearedGame).toMatchObject({
      activePad: null,
      inputIndex: 2,
      sequence: ["green", "red"],
      status: "correct",
    });
  });

  it("shows a miss state before ending the game on the first wrong input", () => {
    const game = createInputGame({ score: 2 });
    const missedGame = playSimonPad(game, "yellow");
    const lostGame = advanceSimonMiss(missedGame);
    const restartedGame = restartSimonGame(lostGame, {
      random: createRandomSource([0.75]),
    });

    expect(getSimonMissFeedbackDelay()).toBe(1_000);
    expect(missedGame).toMatchObject({
      activePad: "yellow",
      inputIndex: 0,
      playbackIndex: 0,
      score: 2,
      status: "missed",
    });
    expect(lostGame).toMatchObject({
      activePad: null,
      inputIndex: 0,
      playbackIndex: 0,
      score: 2,
      status: "lost",
    });
    expect(restartedGame).toMatchObject({
      round: 1,
      score: 0,
      sequence: ["blue"],
      status: "showing",
    });
  });

  it("clears the wrong input flash while preserving the miss state", () => {
    const missedGame = {
      ...createInputGame({
        activePad: "yellow",
        score: 2,
      }),
      status: "missed" as const,
    };
    const clearedGame = clearSimonActivePad(missedGame);

    expect(clearedGame).toMatchObject({
      activePad: null,
      score: 2,
      status: "missed",
    });
  });

  it("wins when the target-length sequence is completed", () => {
    const game = createInputGame({
      inputIndex: 1,
      round: 2,
      sequence: ["green", "red"],
      winTarget: 2,
    });
    const wonGame = playSimonPad(game, "red");

    expect(wonGame).toMatchObject({
      activePad: "red",
      inputIndex: 2,
      round: 2,
      score: 2,
      sequence: ["green", "red"],
      status: "won",
    });
  });

  it("pauses and resumes playback without replacing the sequence", () => {
    const game = startSimonGame(createInitialSimonGame(), {
      random: createRandomSource([0]),
    });
    const pausedGame = pauseSimonGame(game);
    const resumedGame = startSimonGame(pausedGame);

    expect(pausedGame).toMatchObject({
      activePad: null,
      pausedFrom: "showing",
      status: "paused",
    });
    expect(resumedGame).toMatchObject({
      pausedFrom: null,
      sequence: ["green"],
      status: "showing",
    });
    expect(resumedGame.sequence).toBe(pausedGame.sequence);
  });

  it("pauses and resumes the correct-round pause without replacing the sequence", () => {
    const correctGame = {
      ...createInputGame({
        inputIndex: 1,
        score: 1,
        sequence: ["green"],
      }),
      status: "correct" as const,
    };
    const pausedGame = pauseSimonGame(correctGame);
    const resumedGame = startSimonGame(pausedGame);

    expect(pausedGame).toMatchObject({
      activePad: null,
      pausedFrom: "correct",
      sequence: ["green"],
      status: "paused",
    });
    expect(resumedGame).toMatchObject({
      pausedFrom: null,
      sequence: ["green"],
      status: "correct",
    });
    expect(resumedGame.sequence).toBe(correctGame.sequence);
  });

  it("ignores playback and pad input outside their active phases", () => {
    const readyGame = createInitialSimonGame();
    const showingGame = startSimonGame(readyGame, {
      random: createRandomSource([0]),
    });

    expect(advanceSimonPlayback(readyGame)).toBe(readyGame);
    expect(advanceSimonMiss(readyGame)).toBe(readyGame);
    expect(advanceSimonRound(readyGame)).toBe(readyGame);
    expect(playSimonPad(showingGame, "green")).toBe(showingGame);
  });

  it("plays a deterministic two-round game from start to win", () => {
    const startedGame = startSimonGame(
      {
        ...createInitialSimonGame(),
        winTarget: 2,
      },
      {
        random: createRandomSource([0, 0.75]),
      },
    );
    const firstInput = finishShowing(startedGame);
    const firstCorrect = playSimonPad(firstInput, "green");
    const secondShowing = advanceSimonRound(firstCorrect, {
      random: createRandomSource([0.75]),
    });
    const secondInput = finishShowing(secondShowing);
    const afterGreen = playSimonPad(secondInput, "green");
    const wonGame = playSimonPad(afterGreen, "blue");

    expect(secondShowing.sequence).toEqual(["green", "blue"]);
    expect(wonGame).toMatchObject({
      score: 2,
      status: "won",
    });
  });
});
