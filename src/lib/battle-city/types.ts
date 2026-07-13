export type BattleCityDirection = "up" | "right" | "down" | "left";

export type BattleCityStatus =
  | "ready"
  | "stage-intro"
  | "running"
  | "paused"
  | "stage-clear"
  | "game-over"
  | "stage-results"
  | "lost";

export type BattleCityEnemyType = "basic" | "fast" | "power" | "armor";

export type BattleCityPowerUpType =
  | "star"
  | "grenade"
  | "helmet"
  | "shovel"
  | "tank"
  | "clock";

export type BattleCityTerrain =
  | "empty"
  | "brick"
  | "steel"
  | "forest"
  | "water"
  | "ice"
  | "headquarters";

export type BattleCityDifficulty = "★" | "★★" | "★★★" | "★★★★";

export type BattleCityRandom = () => number;

export type BattleCityFrameInput = {
  direction: BattleCityDirection | null;
  fireRequested: boolean;
};

export type BattleCityPlayerPhase = "active" | "exploding" | "spawning";

export type BattleCityStageOutcome = "cleared" | "lost" | null;

export type BattleCityKillCounts = Record<BattleCityEnemyType, number>;

export type BattleCityPosition = {
  col: number;
  row: number;
};

export type BattleCityPlayer = BattleCityPosition & {
  direction: BattleCityDirection;
  iceSlideDirection: BattleCityDirection | null;
  iceSlideStepsRemaining: number;
  invulnerabilityTicks: number;
  phase: BattleCityPlayerPhase;
  phaseTicks: number;
  powerTier: 0 | 1 | 2 | 3;
  shieldTicks: number;
};

export type BattleCityEnemy = BattleCityPosition & {
  destructionPoints: number | null;
  direction: BattleCityDirection;
  explosionTicks: number;
  hasDroppedPowerUp: boolean;
  hitPoints: number;
  id: string;
  isCarrier: boolean;
  maxHitPoints: number;
  moveIntervalTicks: number;
  movementPauseSteps: number;
  movementTurnPending: boolean;
  score: number;
  slot: number;
  spawnOrder: number;
  spawnTicks: number;
  type: BattleCityEnemyType;
};

export type BattleCityBulletOwner = "player" | "enemy";

export type BattleCityBullet = BattleCityPosition & {
  canDestroySteel: boolean;
  direction: BattleCityDirection;
  id: string;
  impactTicks: number;
  isNewborn: boolean;
  owner: BattleCityBulletOwner;
  slot: number;
  speed: number;
  strength: 1 | 2;
};

export type BattleCityPowerUp = BattleCityPosition & {
  id: string;
  type: BattleCityPowerUpType;
};

export type BattleCityPowerUpScorePopup = BattleCityPosition & {
  ticks: number;
};

export type BattleCityGameState = {
  activePowerUp: BattleCityPowerUp | null;
  baseAlive: boolean;
  baseExplosionTicks: number;
  bonusLifeAwarded: boolean;
  bullets: BattleCityBullet[];
  cycle: number;
  destroyedEnemyCount: number;
  difficulty: BattleCityDifficulty;
  enemies: BattleCityEnemy[];
  enemySpawnCooldownTicks: number;
  fortressTicks: number;
  freezeTicks: number;
  lives: number;
  nextBulletId: number;
  nextEnemyId: number;
  nextPowerUpId: number;
  player: BattleCityPlayer;
  powerUpScorePopup: BattleCityPowerUpScorePopup | null;
  score: number;
  spawnedEnemyCount: number;
  stage: number;
  stageBattleTicks: number;
  stageKillCounts: BattleCityKillCounts;
  stageOutcome: BattleCityStageOutcome;
  stageResultTicks: number;
  stageTransitionTicks: number;
  status: BattleCityStatus;
  terrain: BattleCityTerrain[][];
  terrainFragments: number[][];
  tick: number;
  totalEnemyCount: number;
};

export type BattleCityStageDefinition = {
  difficulty: BattleCityDifficulty;
  enemyQueue: BattleCityEnemyType[];
  spawns: {
    enemies: BattleCityPosition[];
    player1: BattleCityPosition;
  };
  stage: number;
  terrain: string[];
};

export type CreateBattleCityGameOptions = {
  stage?: number;
};
