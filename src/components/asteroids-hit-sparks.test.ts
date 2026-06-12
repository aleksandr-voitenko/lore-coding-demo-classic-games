import { describe, expect, it } from "vitest";

import {
  advanceAsteroidsHitSparks,
  createAsteroidsHitSparks,
} from "./asteroids-hit-sparks";
import {
  createInitialAsteroidsGame,
  getAsteroidsAsteroidScore,
  getAsteroidsSaucerScore,
  type Asteroid,
  type AsteroidsGameState,
  type AsteroidsSaucer,
} from "@/lib/asteroids-game-engine";

function createGame(overrides: Partial<AsteroidsGameState> = {}): AsteroidsGameState {
  return {
    ...createInitialAsteroidsGame(),
    ...overrides,
  };
}

function createAsteroid(overrides: Partial<Asteroid> = {}): Asteroid {
  return {
    id: "asteroid-test",
    radius: 24,
    shape: [1, 0.9, 1.1, 0.95, 1.05, 0.88, 1, 0.92],
    size: "medium",
    velocity: { x: 3, y: -5 },
    x: 638,
    y: 2,
    ...overrides,
  };
}

function createSaucer(overrides: Partial<AsteroidsSaucer> = {}): AsteroidsSaucer {
  return {
    id: "saucer-test",
    kind: "large",
    radius: 18,
    shotCooldownTicks: 20,
    velocity: { x: 1.5, y: 0 },
    x: 120,
    y: 140,
    ...overrides,
  };
}

describe("Asteroids hit sparks", () => {
  it("creates deterministic small sparks when a scored asteroid target disappears", () => {
    const target = createAsteroid();
    const previousGame = createGame({
      asteroids: [target],
      boardHeight: 480,
      boardWidth: 640,
      score: 200,
    });
    const nextGame = createGame({
      ...previousGame,
      asteroids: [],
      score: 200 + getAsteroidsAsteroidScore(target.size),
    });
    const result = createAsteroidsHitSparks({
      nextGame,
      nextId: 7,
      previousGame,
    });

    expect(result.nextId).toBe(8);
    expect(result.sparks).toHaveLength(1);
    expect(result.sparks[0]).toMatchObject({
      ageTicks: 0,
      id: "hit-spark-7",
      x: 1,
      y: 477,
    });
    expect(result.sparks[0]?.particles).toHaveLength(12);
    expect(
      result.sparks[0]?.particles.every(
        (particle) => particle.radius < 2.5 && particle.length < 5,
      ),
    ).toBe(true);
  });

  it("creates saucer sparks only when the missing saucer accounts for score", () => {
    const target = createAsteroid({
      id: "asteroid-large",
      radius: 32,
      size: "large",
      velocity: { x: 0, y: 0 },
      x: 220,
      y: 160,
    });
    const saucer = createSaucer();
    const previousGame = createGame({
      asteroids: [target],
      saucer,
      score: 500,
    });
    const asteroidOnlyScore =
      previousGame.score + getAsteroidsAsteroidScore(target.size);
    const exitedSaucerGame = createGame({
      ...previousGame,
      asteroids: [],
      saucer: null,
      score: asteroidOnlyScore,
    });
    const saucerHitGame = createGame({
      ...previousGame,
      asteroids: [],
      score: asteroidOnlyScore + getAsteroidsSaucerScore(saucer.kind),
      saucer: null,
    });

    expect(
      createAsteroidsHitSparks({
        nextGame: exitedSaucerGame,
        nextId: 0,
        previousGame,
      }).sparks,
    ).toHaveLength(1);
    expect(
      createAsteroidsHitSparks({
        nextGame: saucerHitGame,
        nextId: 0,
        previousGame,
      }).sparks,
    ).toHaveLength(2);
  });

  it("ages sparks and removes them after the fade duration", () => {
    const target = createAsteroid({ x: 120, y: 120 });
    const previousGame = createGame({
      asteroids: [target],
      score: 0,
    });
    const nextGame = createGame({
      ...previousGame,
      asteroids: [],
      score: getAsteroidsAsteroidScore(target.size),
    });
    const initial = createAsteroidsHitSparks({
      nextGame,
      nextId: 0,
      previousGame,
    }).sparks;
    const firstAge = advanceAsteroidsHitSparks(initial);
    let expired = firstAge;

    for (let tick = 1; tick < initial[0]!.durationTicks; tick += 1) {
      expired = advanceAsteroidsHitSparks(expired);
    }

    expect(firstAge[0]?.ageTicks).toBe(1);
    expect(expired).toEqual([]);
  });
});
