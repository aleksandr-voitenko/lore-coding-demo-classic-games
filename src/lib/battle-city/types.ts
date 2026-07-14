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

export type BattleCityPlayerId = "player1" | "player2";

export type BattleCityMultiplayerFrameInput = Readonly<
  Record<BattleCityPlayerId, BattleCityFrameInput>
>;

export type BattleCityPlayerPhase =
  | "active"
  | "exploding"
  | "inactive"
  | "spawning";

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
  movementStunTicks?: number;
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

export type BattleCityBulletOwner = "player" | "player2" | "enemy";

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

export type BattleCityPlayerGameOverMessage = {
  movementPixels: number;
  playerId: BattleCityPlayerId;
  ticksRemaining: number;
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
  player2?: BattleCityPlayer;
  player2BonusLifeAwarded?: boolean;
  player2Lives?: number;
  player2Score?: number;
  player2StageKillCounts?: BattleCityKillCounts;
  playerGameOverMessage?: BattleCityPlayerGameOverMessage | null;
  powerUpScorePopup: BattleCityPowerUpScorePopup | null;
  score: number;
  spawnedEnemyCount: number;
  stage: number;
  stageBattleTicks: number;
  stageKillCounts: BattleCityKillCounts;
  stageKillLeaderBonusAwarded?: boolean;
  stageOutcome: BattleCityStageOutcome;
  stageResultTicks: number;
  stageTransitionTicks: number;
  status: BattleCityStatus;
  terrain: BattleCityTerrain[][];
  terrainFragments: number[][];
  tick: number;
  totalEnemyCount: number;
  frameCounterResetPending?: boolean;
};

export type BattleCityMultiplayerGameState = BattleCityGameState & {
  player2: BattleCityPlayer;
  player2BonusLifeAwarded: boolean;
  player2Lives: number;
  player2Score: number;
  player2StageKillCounts: BattleCityKillCounts;
  playerGameOverMessage: BattleCityPlayerGameOverMessage | null;
  stageKillLeaderBonusAwarded: boolean;
  frameCounterResetPending: boolean;
};

export type BattleCityStageDefinition = {
  difficulty: BattleCityDifficulty;
  enemyQueue: BattleCityEnemyType[];
  spawns: {
    enemies: BattleCityPosition[];
    player1: BattleCityPosition;
    player2: BattleCityPosition;
  };
  stage: number;
  terrain: string[];
};

export type CreateBattleCityGameOptions = {
  stage?: number;
};
