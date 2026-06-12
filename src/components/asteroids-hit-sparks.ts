import {
  ASTEROIDS_TICK_DELAY_MS,
  getAsteroidsAsteroidScore,
  getAsteroidsSaucerScore,
  type AsteroidsGameState,
} from "@/lib/asteroids-game-engine";

export type AsteroidsHitSparkColor = "bullet" | "saucerShot" | "ship" | "thrust";

export type AsteroidsHitSparkParticle = {
  angle: number;
  color: AsteroidsHitSparkColor;
  length: number;
  radius: number;
  travelDistance: number;
};

export type AsteroidsHitSpark = {
  ageTicks: number;
  durationTicks: number;
  id: string;
  particles: AsteroidsHitSparkParticle[];
  x: number;
  y: number;
};

type CreateAsteroidsHitSparksOptions = {
  nextId: number;
  nextGame: AsteroidsGameState;
  previousGame: AsteroidsGameState;
};

const HIT_SPARK_DURATION_TICKS = Math.ceil(420 / ASTEROIDS_TICK_DELAY_MS);
const HIT_SPARK_PARTICLE_COUNT = 12;
const HIT_SPARK_COLORS: AsteroidsHitSparkColor[] = [
  "bullet",
  "thrust",
  "ship",
  "saucerShot",
];

export function createAsteroidsHitSparks({
  nextGame,
  nextId,
  previousGame,
}: CreateAsteroidsHitSparksOptions) {
  const scoreDelta = nextGame.score - previousGame.score;

  if (scoreDelta <= 0) {
    return {
      nextId,
      sparks: [] satisfies AsteroidsHitSpark[],
    };
  }

  const nextAsteroidIds = new Set(nextGame.asteroids.map((asteroid) => asteroid.id));
  const hitAsteroids = previousGame.asteroids.filter(
    (asteroid) => !nextAsteroidIds.has(asteroid.id),
  );
  const asteroidScore = hitAsteroids.reduce(
    (total, asteroid) => total + getAsteroidsAsteroidScore(asteroid.size),
    0,
  );
  const sparks = hitAsteroids.map((asteroid, index) =>
    createHitSpark({
      id: `hit-spark-${nextId + index}`,
      radius: asteroid.radius,
      seed: `asteroid:${asteroid.id}`,
      x: wrapEffectCoordinate(
        asteroid.x + asteroid.velocity.x,
        previousGame.boardWidth,
      ),
      y: wrapEffectCoordinate(
        asteroid.y + asteroid.velocity.y,
        previousGame.boardHeight,
      ),
    }),
  );
  let currentNextId = nextId + sparks.length;
  const saucerScoreDelta = scoreDelta - asteroidScore;

  if (
    previousGame.saucer !== null &&
    nextGame.saucer === null &&
    saucerScoreDelta >= getAsteroidsSaucerScore(previousGame.saucer.kind)
  ) {
    sparks.push(
      createHitSpark({
        id: `hit-spark-${currentNextId}`,
        radius: previousGame.saucer.radius,
        seed: `saucer:${previousGame.saucer.id}`,
        x: previousGame.saucer.x + previousGame.saucer.velocity.x,
        y: previousGame.saucer.y + previousGame.saucer.velocity.y,
      }),
    );
    currentNextId += 1;
  }

  return {
    nextId: currentNextId,
    sparks,
  };
}

export function advanceAsteroidsHitSparks(sparks: AsteroidsHitSpark[]) {
  return sparks
    .map((spark) => ({
      ...spark,
      ageTicks: spark.ageTicks + 1,
    }))
    .filter((spark) => spark.ageTicks < spark.durationTicks);
}

function createHitSpark({
  id,
  radius,
  seed,
  x,
  y,
}: {
  id: string;
  radius: number;
  seed: string;
  x: number;
  y: number;
}): AsteroidsHitSpark {
  const baseTravel = Math.min(28, Math.max(12, radius * 0.58));

  return {
    ageTicks: 0,
    durationTicks: HIT_SPARK_DURATION_TICKS,
    id,
    particles: Array.from({ length: HIT_SPARK_PARTICLE_COUNT }, (_, index) => {
      const angleJitter = seededUnit(seed, `angle:${index}`) * 0.32 - 0.16;
      const colorIndex = Math.floor(
        seededUnit(seed, `color:${index}`) * HIT_SPARK_COLORS.length,
      );

      return {
        angle:
          (index / HIT_SPARK_PARTICLE_COUNT) * Math.PI * 2 + angleJitter,
        color: HIT_SPARK_COLORS[colorIndex] ?? "bullet",
        length: 2.6 + seededUnit(seed, `length:${index}`) * 1.8,
        radius: 0.9 + seededUnit(seed, `radius:${index}`) * 0.45,
        travelDistance:
          baseTravel * (0.78 + seededUnit(seed, `distance:${index}`) * 0.58),
      };
    }),
    x,
    y,
  };
}

function seededUnit(seed: string, salt: string) {
  return stableHash(`${seed}:${salt}`) / 0xffffffff;
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function wrapEffectCoordinate(value: number, limit: number) {
  return ((value % limit) + limit) % limit;
}
