export type SpaceInvadersStatus = "ready" | "running" | "paused" | "lost" | "won";

export type SpaceInvadersDirection = -1 | 1;

export type SpaceInvaderKind =
  | "standard"
  | "diver"
  | "armored"
  | "shield-bearer"
  | "revenge"
  | "splitter"
  | "splitter-fragment";

export type SpaceInvadersRandomSource = () => number;

export type SpaceInvadersInvaderShotKind =
  | "armor-wave"
  | "commander"
  | "burst"
  | "counterfire"
  | "standard"
  | "needle"
  | "scatter"
  | "splitter-fork"
  | "splitter-fragment";

export type SpaceInvadersPowerUpKind =
  | "bonus-score"
  | "burst-shot"
  | "extra-life"
  | "freeze"
  | "piercing-laser"
  | "shield"
  | "shotgun-shot";

export type SpaceInvadersPendingShotPowerUp = Extract<
  SpaceInvadersPowerUpKind,
  "burst-shot" | "piercing-laser" | "shotgun-shot"
>;

export type SpaceInvadersPlayerShotKind =
  | "standard"
  | "burst"
  | "piercing"
  | "shotgun";

export type SpaceInvadersExplosionKind = "invader" | "player" | "ufo";
export type SpaceInvadersExplosionVariant = 1 | 2 | 3 | 4;

export type SpaceInvadersPlayer = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersUfoState = {
  cooldownTicks: number;
  direction: SpaceInvadersDirection;
  height: number;
  isActive: boolean;
  points: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvader = {
  column: number;
  direction: SpaceInvadersDirection;
  height: number;
  hitPoints: number;
  id: string;
  isActive: boolean;
  isDiving: boolean;
  kind: SpaceInvaderKind;
  points: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersShot = {
  height: number;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersPlayerShot = SpaceInvadersShot & {
  damagedInvaderIds?: string[];
  hasScored?: boolean;
  id: string;
  kind: SpaceInvadersPlayerShotKind;
  velocityX: number;
};

export type SpaceInvadersInvaderShot = SpaceInvadersShot & {
  ageTicks: number;
  id: string;
  kind: SpaceInvadersInvaderShotKind;
  sourceColumn: number;
  sourceInvaderId: string;
  sourceRow: number;
  ttlTicks: number | null;
  velocityX: number;
};

export type SpaceInvadersPowerUp = {
  height: number;
  id: string;
  kind: SpaceInvadersPowerUpKind;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersExplosion = {
  ageTicks: number;
  height: number;
  id: string;
  kind: SpaceInvadersExplosionKind;
  ttlTicks: number;
  variant: SpaceInvadersExplosionVariant;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersScorePopup = {
  ageTicks: number;
  height: number;
  id: string;
  label?: string;
  points: number;
  scoreScale?: number;
  ttlTicks: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersMultiKillCombo = {
  destroyedCount: number;
  height: number;
  points: number;
  scoreScale?: number;
  ticksRemaining: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersScoreTarget = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersScorePopupOptions = {
  label?: string;
  points: number;
  scoreScale?: number;
};

export type SpaceInvadersInvaderBurst = {
  remainingShots: number;
  sourceInvaderId: string;
};

export type SpaceInvadersPlayerBurst = {
  cooldownTicks: number;
  remainingShots: number;
};

export type SpaceInvadersGameState = {
  alienCount: number;
  alienFreezeTicks: number;
  baseY: number;
  boardHeight: number;
  boardWidth: number;
  explosions: SpaceInvadersExplosion[];
  hitStreak: number;
  invaderBurst: SpaceInvadersInvaderBurst | null;
  invaderShotCooldownTicks: number;
  invaderShots: SpaceInvadersInvaderShot[];
  invaders: SpaceInvader[];
  lives: number;
  marchDirection: SpaceInvadersDirection;
  multiKillCombo: SpaceInvadersMultiKillCombo | null;
  nextExplosionId: number;
  nextInvaderShotId: number;
  nextPlayerShotId: number;
  nextPowerUpId: number;
  nextScorePopupId: number;
  pendingShotPowerUp: SpaceInvadersPendingShotPowerUp | null;
  player: SpaceInvadersPlayer;
  playerBurst: SpaceInvadersPlayerBurst | null;
  playerRespawnTicks: number;
  playerShieldTicks: number;
  playerVolleyHasArmoredHit: boolean;
  playerShots: SpaceInvadersPlayerShot[];
  playerVolleyHasScored: boolean;
  playerVolleyHasUnscoredExit: boolean;
  powerUps: SpaceInvadersPowerUp[];
  score: number;
  scorePopups: SpaceInvadersScorePopup[];
  status: SpaceInvadersStatus;
  ufo: SpaceInvadersUfoState;
  ufoHitStreak: number;
};

export type CreateSpaceInvadersGameOptions = {
  alienCount?: number;
  boardHeight?: number;
  boardWidth?: number;
  random?: SpaceInvadersRandomSource;
};
