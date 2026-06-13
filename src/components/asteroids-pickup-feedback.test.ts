import { describe, expect, it } from "vitest";

import {
  advanceAsteroidsPickupFeedbacks,
  createAsteroidsPickupFeedbacks,
} from "./asteroids-pickup-feedback";
import {
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  createInitialAsteroidsGame,
  type AsteroidsGameState,
  type AsteroidsPowerUpKind,
} from "@/lib/asteroids-game-engine";

function createGame(overrides: Partial<AsteroidsGameState> = {}): AsteroidsGameState {
  return {
    ...createInitialAsteroidsGame(),
    status: "running",
    ...overrides,
  };
}

describe("Asteroids pickup feedback", () => {
  it("creates short labels when collected power-ups leave the board", () => {
    const expectedLabels: Record<AsteroidsPowerUpKind, string> = {
      "bonus-score": `+${ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS}`,
      "bullet-speed": "+bullet speed",
      "engine-speed": "+engine speed",
      shield: "+shield",
      "shot-interval": "+fire rate",
    };

    for (const [kind, label] of Object.entries(expectedLabels)) {
      const previousGame = createGame({
        powerUp: {
          id: `power-up-${kind}`,
          kind: kind as AsteroidsPowerUpKind,
          radius: 12,
          x: 140,
          y: 180,
        },
      });
      const nextGame = createGame({
        ...previousGame,
        powerUp: null,
      });
      const result = createAsteroidsPickupFeedbacks({
        nextGame,
        nextId: 4,
        previousGame,
      });

      expect(result.nextId).toBe(5);
      expect(result.feedbacks).toEqual([
        expect.objectContaining({
          ageTicks: 0,
          id: "pickup-feedback-4",
          kind,
          label,
          x: 140,
          y: 180,
        }),
      ]);
    }
  });

  it("does not create feedback when an active power-up persists or is cleared on loss", () => {
    const previousGame = createGame({
      powerUp: {
        id: "power-up-shield",
        kind: "shield",
        radius: 12,
        x: 140,
        y: 180,
      },
    });

    expect(
      createAsteroidsPickupFeedbacks({
        nextGame: previousGame,
        nextId: 0,
        previousGame,
      }),
    ).toEqual({
      feedbacks: [],
      nextId: 0,
    });
    expect(
      createAsteroidsPickupFeedbacks({
        nextGame: createGame({
          ...previousGame,
          powerUp: null,
          status: "lost",
        }),
        nextId: 0,
        previousGame,
      }),
    ).toEqual({
      feedbacks: [],
      nextId: 0,
    });
  });

  it("ages feedback and removes it after the fade duration", () => {
    const previousGame = createGame({
      powerUp: {
        id: "power-up-engine",
        kind: "engine-speed",
        radius: 12,
        x: 140,
        y: 180,
      },
    });
    const initial = createAsteroidsPickupFeedbacks({
      nextGame: createGame({
        ...previousGame,
        powerUp: null,
      }),
      nextId: 0,
      previousGame,
    }).feedbacks;
    const firstAge = advanceAsteroidsPickupFeedbacks(initial);
    let expired = firstAge;

    for (let tick = 1; tick < initial[0]!.durationTicks; tick += 1) {
      expired = advanceAsteroidsPickupFeedbacks(expired);
    }

    expect(firstAge[0]?.ageTicks).toBe(1);
    expect(expired).toEqual([]);
  });
});
