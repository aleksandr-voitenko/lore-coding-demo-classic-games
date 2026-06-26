export type AsteroidsStatus = "ready" | "running" | "paused" | "lost";

export type AsteroidsPoint = {
  x: number;
  y: number;
};

export type AsteroidsControlInput = {
  rotateLeft?: boolean;
  rotateRight?: boolean;
  thrust?: boolean;
};

export type AsteroidsRandom = () => number;

export type AsteroidsDifficulty = "easy" | "medium" | "hard";

export type AsteroidSize = "large" | "medium" | "small";

export type AsteroidsSaucerKind = "large" | "small";

export type AsteroidsPowerUpKind =
  | "bonus-score"
  | "bullet-speed"
  | "engine-speed"
  | "shield"
  | "shot-interval";

export type AsteroidsShip = {
  angle: number;
  isThrusting: boolean;
  radius: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsShipExplosion = {
  durationTicks: number;
  radius: number;
  ticksRemaining: number;
  x: number;
  y: number;
};

export type AsteroidsBullet = {
  id: string;
  radius: number;
  ttl: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsSaucerShot = AsteroidsBullet;

export type Asteroid = {
  id: string;
  radius: number;
  shape: number[];
  size: AsteroidSize;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsSaucer = {
  id: string;
  kind: AsteroidsSaucerKind;
  radius: number;
  shotCooldownTicks: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsPowerUp = {
  id: string;
  kind: AsteroidsPowerUpKind;
  radius: number;
  x: number;
  y: number;
};

export type AsteroidsGameState = {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bulletSpeedMultiplier: number;
  bullets: AsteroidsBullet[];
  difficulty: AsteroidsDifficulty;
  engineSpeedMultiplier: number;
  lives: number;
  nextAsteroidId: number;
  nextBulletId: number;
  nextPowerUpId: number;
  nextSaucerBulletId: number;
  nextSaucerId: number;
  powerUp: AsteroidsPowerUp | null;
  powerUpSpawnCooldownTicks: number;
  respawnInvulnerabilityTicks: number;
  saucer: AsteroidsSaucer | null;
  saucerBullets: AsteroidsSaucerShot[];
  saucerSpawnCooldownTicks: number;
  score: number;
  ship: AsteroidsShip;
  shipExplosion: AsteroidsShipExplosion | null;
  shotCooldownTicks: number;
  shotIntervalMultiplier: number;
  startingAsteroidCount: number;
  status: AsteroidsStatus;
  wave: number;
};

export type AsteroidsShipOwnedState = Pick<
  AsteroidsGameState,
  | "bulletSpeedMultiplier"
  | "bullets"
  | "engineSpeedMultiplier"
  | "respawnInvulnerabilityTicks"
  | "ship"
  | "shipExplosion"
  | "shotCooldownTicks"
  | "shotIntervalMultiplier"
>;

export type AsteroidsSharedWorldState = Omit<
  AsteroidsGameState,
  keyof AsteroidsShipOwnedState
>;

export type CreateAsteroidsGameOptions = {
  difficulty?: AsteroidsDifficulty | string;
  random?: AsteroidsRandom;
};

export type AdvanceAsteroidsGameOptions = {
  random?: AsteroidsRandom;
};
