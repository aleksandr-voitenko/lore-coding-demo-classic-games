import { describe, expect, it } from "vitest";

import { advanceSnakeGame, createInitialGame, type GameState } from "./snake-game-engine";
import { createFoodFeedback } from "./snake-food-feedback";

function createRunningGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGame({ boardSize: 11 }),
    obstacles: [],
    status: "running",
    ...overrides,
  };
}

describe("snake food feedback", () => {
  it("labels red apple pickups with point feedback", () => {
    const game = createRunningGame({
      food: { x: 6, y: 5 },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    const nextGame = advanceSnakeGame(game, { random: () => 0 });
    const feedback = createFoodFeedback(game, nextGame, 12);

    expect(feedback).toEqual({
      id: 12,
      lines: ["+1 🟡"],
      position: { x: 6, y: 5 },
    });
  });

  it("labels yellow apple pickups with bonus point feedback", () => {
    const game = createRunningGame({
      bonusFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      food: { x: 9, y: 9 },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    const nextGame = advanceSnakeGame(game);
    const feedback = createFoodFeedback(game, nextGame, 13);

    expect(feedback).toEqual({
      id: 13,
      lines: ["+2 🟡"],
      position: { x: 6, y: 5 },
    });
  });

  it("labels purple diamond pickups with point and speed feedback", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      speedFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
    });

    const nextGame = advanceSnakeGame(game);
    const feedback = createFoodFeedback(game, nextGame, 14);

    expect(feedback).toEqual({
      id: 14,
      lines: ["+3 🟡", "+1 ⚡"],
      position: { x: 6, y: 5 },
    });
  });

  it("labels blue triangle pickups with point and speed feedback", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      slowFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    const nextGame = advanceSnakeGame(game);
    const feedback = createFoodFeedback(game, nextGame, 15);

    expect(feedback).toEqual({
      id: 15,
      lines: ["+1 🟡", "-1 ⚡"],
      position: { x: 6, y: 5 },
    });
  });

  it("omits blue triangle speed feedback when speed is already 1", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      score: 3,
      slowFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      speedBoosts: -5,
    });

    const nextGame = advanceSnakeGame(game);
    const feedback = createFoodFeedback(game, nextGame, 16);

    expect(feedback).toEqual({
      id: 16,
      lines: ["+1 🟡"],
      position: { x: 6, y: 5 },
    });
  });

  it("does not create feedback when score does not change", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    expect(createFoodFeedback(game, advanceSnakeGame(game), 17)).toBeNull();
  });
});
