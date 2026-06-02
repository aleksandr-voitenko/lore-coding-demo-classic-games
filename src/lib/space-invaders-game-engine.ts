export type SpaceInvadersStatus = "ready" | "running" | "paused" | "lost" | "won";

export type SpaceInvadersDirection = -1 | 1;

export type SpaceInvaderKind = "standard" | "diver" | "shield-bearer" | "revenge";

export type SpaceInvadersRandomSource = () => number;

export type SpaceInvadersInvaderShotKind =
  | "commander"
  | "burst"
  | "standard"
  | "needle"
  | "scatter";

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

type SpaceInvadersScoreTarget = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type SpaceInvadersScorePopupOptions = {
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

export const SPACE_INVADERS_BOARD_WIDTH = 420;
export const SPACE_INVADERS_BOARD_HEIGHT = 560;
export const SPACE_INVADERS_COLUMNS = 11;
export const SPACE_INVADERS_ROWS = 5;
export const SPACE_INVADERS_STARTING_LIVES = 3;
export const SPACE_INVADERS_BASE_Y = 492;
export const SPACE_INVADERS_TICK_DELAY_MS = 34;
export const SPACE_INVADERS_BOARD_SIZE_OPTIONS = [
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
  { height: 720, label: "540 x 720", width: 540 },
] as const;
export const SPACE_INVADERS_ALIEN_COUNT_OPTIONS = [
  { alienCount: 24, columns: 8, label: "24", rows: 3 },
  { alienCount: 40, columns: 10, label: "40", rows: 4 },
  { alienCount: 55, columns: 11, label: "55", rows: 5 },
] as const;
export const SPACE_INVADERS_EXPLOSION_VARIANTS = [1, 2, 3, 4] as const;
export const SPACE_INVADERS_POWER_UP_KINDS: SpaceInvadersPowerUpKind[] = [
  "bonus-score",
  "burst-shot",
  "extra-life",
  "freeze",
  "piercing-laser",
  "shield",
  "shotgun-shot",
];
const SPACE_INVADERS_COMMON_POWER_UP_KINDS: Exclude<
  SpaceInvadersPowerUpKind,
  "extra-life"
>[] = [
  "bonus-score",
  "burst-shot",
  "freeze",
  "piercing-laser",
  "shield",
  "shotgun-shot",
];

const INVADER_DROP_Y = 4;
const DIVER_INVADER_COUNT = 10;
const DIVER_DROP_Y = 16;
const DIVER_STEP_MULTIPLIER = 4.375;
export const SPACE_INVADERS_SHIELD_BEARER_COUNT = 4;
export const SPACE_INVADERS_REVENGE_ALIEN_COUNT = 3;
const EXPLOSION_PADDING_BY_KIND: Record<SpaceInvadersExplosionKind, number> = {
  invader: 16,
  player: 12,
  ufo: 18,
};
const EXPLOSION_TTL_TICKS = 12;
export const SPACE_INVADERS_SCORE_POPUP_TICKS = Math.round(
  1_600 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_RESPAWN_TICKS = EXPLOSION_TTL_TICKS;
export const SPACE_INVADERS_PLAYER_SHIELD_TICKS = Math.round(
  5_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS = Math.round(
  2_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_BONUS_SCORE_POINTS = 50;
export const SPACE_INVADERS_HIT_STREAK_BONUS_STEP = 5;
export const SPACE_INVADERS_HIT_STREAK_BONUS_CAP = 30;
export const SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP = 0.08;
export const SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP = 1.48;
export const SPACE_INVADERS_MULTI_KILL_BONUSES = {
  2: 25,
  3: 60,
  4: 100,
} as const;
export const SPACE_INVADERS_MULTI_KILL_COMBO_TICKS = Math.round(
  700 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_UFO_CHAIN_BONUS_STEP = 50;
export const SPACE_INVADERS_UFO_CHAIN_BONUS_CAP = 150;
export const SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE = 0.05;
export const SPACE_INVADERS_ALIEN_FREEZE_TICKS = Math.round(
  5_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_POWER_UP_SHIELD_TICKS = Math.round(
  10_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT = 5;
export const SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS = Math.max(
  0,
  Math.round(300 / SPACE_INVADERS_TICK_DELAY_MS) - 1,
);
const INVADER_GAP_X = 5;
const INVADER_GAP_Y = 14;
const INVADER_HEIGHT = 23;
const INVADER_STEP_X = 0.8;
const INVADER_TOP = 64;
const INVADER_WIDTH = 28;
const INVADER_FIRE_COOLDOWN_TICKS = 80;
const INVADER_HIT_RECOVERY_TICKS = 120;
const MAX_INVADER_SHOTS = 3;
const PLAYER_BOTTOM_MARGIN = 10;
const PLAYER_SIZE_SCALE = 0.8;
const INVADER_X = 38;
const PLAYER_HEIGHT = 50 * PLAYER_SIZE_SCALE;
const PLAYER_SPEED = 9.6;
const PLAYER_WIDTH = 62 * PLAYER_SIZE_SCALE;
const SHOT_HEIGHT = 22;
const SHOT_SPEED = -6.4;
const SHOT_WIDTH = 6;
export const SPACE_INVADERS_POWER_UP_SIZE = 36;
export const SPACE_INVADERS_POWER_UP_SPEED = Math.abs(SHOT_SPEED) * 0.75;
const UFO_COOLDOWN_TICKS = 420;
const UFO_HEIGHT = 18;
const UFO_POINT_VALUES = [100, 150, 200, 300] as const;
const UFO_SPEED = 2.4;
const UFO_WIDTH = 48;
const UFO_Y = 34;
const BURST_SHOT_COUNT = 3;
const BURST_SHOT_DELAY_TICKS = Math.max(
  0,
  Math.round(1_000 / SPACE_INVADERS_TICK_DELAY_MS) - 1,
);
const COMMANDER_SHOT_MAX_SPEED_X = 1.1;
const COMMANDER_SHOT_STEER_X = 0.14;
const SCATTER_SHOT_VELOCITIES_X = [-1.25, 0, 1.25] as const;
const SHOTGUN_SHOT_VELOCITIES_X = [-2.4, -1.2, 0, 1.2, 2.4] as const;

type InvaderShotSpec = {
  cooldownTicks: number;
  height: number;
  kind: SpaceInvadersInvaderShotKind;
  ttlTicks: number | null;
  velocityX: number;
  velocityY: number;
  width: number;
};

const SPACE_INVADERS_ROW_SHOT_KINDS: SpaceInvadersInvaderShotKind[] = [
  "commander",
  "burst",
  "scatter",
  "needle",
  "standard",
];

const INVADER_SHOT_SPECS: Record<SpaceInvadersInvaderShotKind, InvaderShotSpec> = {
  commander: {
    cooldownTicks: 132,
    height: 24,
    kind: "commander",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 2.35,
    width: 8,
  },
  burst: {
    cooldownTicks: 92,
    height: 18,
    kind: "burst",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.45,
    width: 7,
  },
  standard: {
    cooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    height: 20,
    kind: "standard",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.2,
    width: 5,
  },
  needle: {
    cooldownTicks: 56,
    height: 24,
    kind: "needle",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 4.9,
    width: 3,
  },
  scatter: {
    cooldownTicks: 112,
    height: 12,
    kind: "scatter",
    ttlTicks: 96,
    velocityX: 0,
    velocityY: 2.8,
    width: 5,
  },
};

export function createInitialSpaceInvadersGame({
  alienCount = SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  random = Math.random,
}: CreateSpaceInvadersGameOptions = {}): SpaceInvadersGameState {
  const normalizedBoardWidth = normalizeSpaceInvadersDimension(
    boardWidth,
    SPACE_INVADERS_BOARD_WIDTH,
    360,
  );
  const normalizedBoardHeight = normalizeSpaceInvadersDimension(
    boardHeight,
    SPACE_INVADERS_BOARD_HEIGHT,
    480,
  );
  const formation = getSpaceInvadersFormationSpec(alienCount);

  return {
    alienCount: formation.alienCount,
    alienFreezeTicks: 0,
    baseY: normalizedBoardHeight - 68,
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    explosions: [],
    hitStreak: 0,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    invaderShots: [],
    invaders: createSpaceInvadersFormation({
      boardWidth: normalizedBoardWidth,
      columns: formation.columns,
      random,
      rows: formation.rows,
    }),
    lives: SPACE_INVADERS_STARTING_LIVES,
    marchDirection: 1,
    nextExplosionId: 0,
    nextInvaderShotId: 0,
    nextPlayerShotId: 0,
    nextPowerUpId: 0,
    nextScorePopupId: 0,
    pendingShotPowerUp: null,
    player: createCenteredPlayer(normalizedBoardWidth, normalizedBoardHeight),
    playerBurst: null,
    playerRespawnTicks: 0,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    powerUps: [],
    score: 0,
    scorePopups: [],
    status: "ready",
    multiKillCombo: null,
    ufo: createInitialSpaceInvadersUfo(),
    ufoHitStreak: 0,
  };
}

export function createSpaceInvadersFormation({
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  columns = SPACE_INVADERS_COLUMNS,
  random = Math.random,
  rows = SPACE_INVADERS_ROWS,
}: {
  boardWidth?: number;
  columns?: number;
  random?: SpaceInvadersRandomSource;
  rows?: number;
} = {}) {
  const formationWidth = columns * INVADER_WIDTH + (columns - 1) * INVADER_GAP_X;
  const startX = Math.max(INVADER_X, (boardWidth - formationWidth) / 2);
  const shieldBearerInvaderIds = selectShieldBearerInvaderIds({
    columns,
    random,
    rows,
  });
  const revengeAlienIds = selectRevengeAlienIds({
    columns,
    excludedIds: shieldBearerInvaderIds,
    random,
    rows,
  });
  const specialInvaderIds = new Set([
    ...shieldBearerInvaderIds,
    ...revengeAlienIds,
  ]);
  const diverInvaderIds = selectDiverInvaderIds(
    rows,
    columns,
    random,
    specialInvaderIds,
  );

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column): SpaceInvader => {
      const id = `${row}:${column}`;
      const kind: SpaceInvaderKind = shieldBearerInvaderIds.has(id)
        ? "shield-bearer"
        : revengeAlienIds.has(id)
          ? "revenge"
        : diverInvaderIds.has(id)
          ? "diver"
          : "standard";
      const x = startX + column * (INVADER_WIDTH + INVADER_GAP_X);
      const y = INVADER_TOP + row * (INVADER_HEIGHT + INVADER_GAP_Y);

      return {
        column,
        direction: 1,
        height: INVADER_HEIGHT,
        id,
        isActive: true,
        isDiving: false,
        kind,
        points: getInvaderPoints(row),
        row,
        width: INVADER_WIDTH,
        x,
        y,
      };
    }),
  ).flat();
}

export function startSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status === "running") {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "lost" || game.status === "won") {
    return restartSpaceInvadersGame(game);
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pauseSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartSpaceInvadersGame(
  game: Pick<SpaceInvadersGameState, "alienCount" | "boardHeight" | "boardWidth"> = {
    alienCount: SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
    boardHeight: SPACE_INVADERS_BOARD_HEIGHT,
    boardWidth: SPACE_INVADERS_BOARD_WIDTH,
  },
): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame({
      alienCount: game.alienCount,
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
    }),
    status: "running" as const,
  };
}

export function moveSpaceInvadersPlayer(
  game: SpaceInvadersGameState,
  deltaX: number,
): SpaceInvadersGameState {
  if (game.status === "lost" || game.status === "won" || game.playerRespawnTicks > 0) {
    return game;
  }

  return {
    ...game,
    player: {
      ...game.player,
      x: clamp(game.player.x + deltaX, 0, game.boardWidth - game.player.width),
    },
  };
}

export function moveSpaceInvadersPlayerLeft(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, -PLAYER_SPEED);
}

export function moveSpaceInvadersPlayerRight(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, PLAYER_SPEED);
}

export function fireSpaceInvadersShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (
    game.status !== "running" ||
    game.playerRespawnTicks > 0 ||
    game.playerBurst !== null ||
    game.playerShots.length > 0
  ) {
    return game;
  }

  const createdShots = createPlayerShots(
    game.player,
    game.nextPlayerShotId,
    game.pendingShotPowerUp,
  );

  return {
    ...game,
    nextPlayerShotId: game.nextPlayerShotId + createdShots.length,
    pendingShotPowerUp: null,
    playerBurst:
      game.pendingShotPowerUp === "burst-shot"
        ? {
            cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
            remainingShots: SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT - createdShots.length,
          }
        : null,
    playerShots: createdShots,
  };
}

export function advanceSpaceInvadersGame(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  const gameAfterExplosions = advanceExplosions(game);
  const gameAfterScorePopups = advanceScorePopups(gameAfterExplosions);
  const gameAfterMultiKillComboWindow =
    advanceSpaceInvadersMultiKillComboWindow(gameAfterScorePopups);
  const gameAfterPowerUps = advancePowerUps(gameAfterMultiKillComboWindow);
  const gameAfterShot = advancePlayerShots(gameAfterPowerUps, random);

  if (gameAfterShot.status === "won") {
    return finalizeSpaceInvadersPlayerVolley(
      finalizeSpaceInvadersMultiKillCombo(gameAfterShot),
    );
  }

  const gameAfterPlayerBurst = advancePlayerBurst(gameAfterShot);
  const gameAfterMultiKillCombo =
    finalizeSpaceInvadersMultiKillComboIfVolleyEnded(gameAfterPlayerBurst);
  const gameAfterPlayerVolley = finalizeSpaceInvadersPlayerVolley(
    gameAfterMultiKillCombo,
  );
  const gameAfterInvaderShots = advanceInvaderShots(gameAfterPlayerVolley, random);

  if (
    gameAfterInvaderShots.status === "lost" ||
    gameAfterInvaderShots.lives < gameAfterPlayerVolley.lives
  ) {
    return finalizeSpaceInvadersMultiKillCombo(gameAfterInvaderShots);
  }

  const { game: gameAfterFreezeTick, isFrozen: areAliensFrozen } =
    advanceAlienFreeze(gameAfterInvaderShots);

  if (areAliensFrozen) {
    return advancePlayerRecovery(gameAfterFreezeTick);
  }

  const gameAfterInvaderFire = maybeFireInvaderShot(gameAfterFreezeTick);
  const gameAfterUfo = advanceSpaceInvadersUfo(gameAfterInvaderFire);
  const marchedGame = marchInvaders(gameAfterUfo);

  if (hasInvaderReachedBase(marchedGame)) {
    return finalizeSpaceInvadersMultiKillCombo({
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    });
  }

  return advancePlayerRecovery(marchedGame);
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
}

function advancePlayerShots(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.playerShots.length === 0) {
    return game;
  }

  let nextGame: SpaceInvadersGameState = {
    ...game,
    playerShots: [],
  };
  const activeShots: SpaceInvadersPlayerShot[] = [];
  const destroyedInvaderBounds: SpaceInvadersScoreTarget[] = [];
  let playerVolleyHasScored =
    game.playerVolleyHasScored ||
    game.playerShots.some((shot) => shot.hasScored === true);
  let playerVolleyHasUnscoredExit = game.playerVolleyHasUnscoredExit;
  let destroyedInvaderPopupPoints = 0;
  let invaderPopupScoreScale = 1;

  for (const shot of game.playerShots) {
    const movedShot = advancePlayerShotPosition(shot);
    let didScoreWithShot = shot.hasScored === true || playerVolleyHasScored;

    if (!isPlayerShotActive(movedShot, game)) {
      if (!didScoreWithShot) {
        playerVolleyHasUnscoredExit = true;
      }

      continue;
    }

    if (nextGame.ufo.isActive && rectanglesIntersect(movedShot, nextGame.ufo)) {
      const hitUfo = nextGame.ufo;
      const gameWithExplosion = createSpaceInvadersExplosion(
        nextGame,
        "ufo",
        hitUfo,
        random,
      );
      let ufoPopupPoints = hitUfo.points;
      let ufoPopupLabel: string | undefined;
      let ufoPopupScoreScale = 1;
      let gameWithScore: SpaceInvadersGameState = {
        ...gameWithExplosion,
        score: gameWithExplosion.score + hitUfo.points,
      };

      if (!didScoreWithShot) {
        const hitStreakResult = advanceSpaceInvadersHitStreak(gameWithScore);

        gameWithScore = hitStreakResult.game;
        ufoPopupPoints += hitStreakResult.bonus;

        if (hitStreakResult.bonus > 0) {
          ufoPopupScoreScale = getSpaceInvadersHitStreakPopupScale(
            gameWithScore.hitStreak,
          );
        }
      }

      const ufoChainResult = advanceSpaceInvadersUfoChain(gameWithScore);

      gameWithScore = ufoChainResult.game;
      ufoPopupPoints += ufoChainResult.bonus;

      if (ufoChainResult.bonus > 0) {
        ufoPopupLabel = "UFO CHAIN";
      }

      const gameWithScorePopup = createSpaceInvadersScorePopup(
        gameWithScore,
        hitUfo,
        {
          label: ufoPopupLabel,
          points: ufoPopupPoints,
          scoreScale: ufoPopupScoreScale,
        },
      );

      didScoreWithShot = true;
      playerVolleyHasScored = true;

      nextGame = {
        ...gameWithScorePopup,
        ufo: deactivateSpaceInvadersUfo(hitUfo, nextGame.boardWidth),
      };

      if (movedShot.kind !== "piercing") {
        continue;
      }
    }

    const hitInvaders = nextGame.invaders.filter(
      (invader) => invader.isActive && rectanglesIntersect(movedShot, invader),
    );
    const vulnerableHitInvaders =
      movedShot.kind === "piercing"
        ? hitInvaders
        : hitInvaders.filter(
            (invader) => !isSpaceInvaderShielded(invader, nextGame.invaders),
          );

    if (hitInvaders.length === 0) {
      activeShots.push({
        ...movedShot,
        hasScored: didScoreWithShot,
      });
      continue;
    }

    if (vulnerableHitInvaders.length === 0) {
      if (!didScoreWithShot) {
        playerVolleyHasUnscoredExit = true;
      }

      continue;
    }

    const destroyedInvaders =
      movedShot.kind === "piercing"
        ? vulnerableHitInvaders
        : vulnerableHitInvaders.slice(0, 1);
    const destroyedInvaderIds = new Set(
      destroyedInvaders.map((invader) => invader.id),
    );
    const destroyedInvaderPoints = destroyedInvaders.reduce(
      (total, invader) => total + invader.points,
      0,
    );
    const invaders = nextGame.invaders.map((invader) =>
      destroyedInvaderIds.has(invader.id) ? { ...invader, isActive: false } : invader,
    );
    const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;
    let gameWithHits: SpaceInvadersGameState = {
      ...nextGame,
      invaders,
      score: nextGame.score + destroyedInvaderPoints,
    };

    destroyedInvaderPopupPoints += destroyedInvaderPoints;

    for (const hitInvader of destroyedInvaders) {
      destroyedInvaderBounds.push(hitInvader);
      gameWithHits = createSpaceInvadersExplosion(
        gameWithHits,
        "invader",
        hitInvader,
        random,
      );
      gameWithHits = maybeCreateSpaceInvadersPowerUpDrop(
        gameWithHits,
        hitInvader,
        random,
      );
    }

    gameWithHits = maybeCreateSpaceInvadersRevengeShots(
      gameWithHits,
      destroyedInvaders,
    );

    if (!didScoreWithShot) {
      const hitStreakResult = advanceSpaceInvadersHitStreak(gameWithHits);

      gameWithHits = hitStreakResult.game;
      destroyedInvaderPopupPoints += hitStreakResult.bonus;
      if (hitStreakResult.bonus > 0) {
        invaderPopupScoreScale = Math.max(
          invaderPopupScoreScale,
          getSpaceInvadersHitStreakPopupScale(gameWithHits.hitStreak),
        );
      }
      didScoreWithShot = true;
      playerVolleyHasScored = true;
    }

    nextGame = {
      ...gameWithHits,
      status: activeInvaderCount === 0 ? "won" : nextGame.status,
    };

    if (movedShot.kind === "piercing" && nextGame.status !== "won") {
      activeShots.push({
        ...movedShot,
        hasScored: didScoreWithShot,
      });
    }
  }

  if (destroyedInvaderBounds.length > 0) {
    nextGame = continueSpaceInvadersMultiKillCombo(
      nextGame,
      getCombinedSpaceInvadersScoreTarget(destroyedInvaderBounds),
      destroyedInvaderBounds.length,
      destroyedInvaderPopupPoints,
      invaderPopupScoreScale,
    );
  }

  const scoredActiveShots = playerVolleyHasScored
    ? activeShots.map((shot) =>
        shot.hasScored === true
          ? shot
          : {
              ...shot,
              hasScored: true,
            },
      )
    : activeShots;

  return {
    ...nextGame,
    playerShots: scoredActiveShots,
    playerVolleyHasScored,
    playerVolleyHasUnscoredExit,
  };
}

function advanceSpaceInvadersUfo(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.ufo.isActive) {
    const movedUfo = {
      ...game.ufo,
      x: game.ufo.x + game.ufo.direction * UFO_SPEED,
    };

    if (
      (movedUfo.direction === 1 && movedUfo.x > game.boardWidth) ||
      (movedUfo.direction === -1 && movedUfo.x + movedUfo.width < 0)
    ) {
      return {
        ...game,
        ufo: deactivateSpaceInvadersUfo(movedUfo, game.boardWidth),
        ufoHitStreak: 0,
      };
    }

    return {
      ...game,
      ufo: movedUfo,
    };
  }

  if (game.ufo.cooldownTicks > 0) {
    return {
      ...game,
      ufo: {
        ...game.ufo,
        cooldownTicks: game.ufo.cooldownTicks - 1,
      },
    };
  }

  return {
    ...game,
    ufo: {
      ...game.ufo,
      isActive: true,
      x: game.ufo.direction === 1 ? -game.ufo.width : game.boardWidth,
    },
  };
}

function advancePlayerBurst(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.playerBurst === null) {
    return game;
  }

  if (game.playerBurst.cooldownTicks > 0) {
    return {
      ...game,
      playerBurst: {
        ...game.playerBurst,
        cooldownTicks: game.playerBurst.cooldownTicks - 1,
      },
    };
  }

  const createdShot = createPlayerShot(
    game.player,
    game.nextPlayerShotId,
    "burst",
    0,
  );
  const remainingShots = game.playerBurst.remainingShots - 1;

  return {
    ...game,
    nextPlayerShotId: game.nextPlayerShotId + 1,
    playerBurst:
      remainingShots > 0
        ? {
            cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
            remainingShots,
          }
        : null,
    playerShots: [...game.playerShots, createdShot],
  };
}

function advancePowerUps(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.powerUps.length === 0) {
    return game;
  }

  let nextGame = game;
  const activePowerUps: SpaceInvadersPowerUp[] = [];

  for (const powerUp of game.powerUps) {
    const movedPowerUp = {
      ...powerUp,
      y: powerUp.y + powerUp.velocityY,
    };

    if (game.playerRespawnTicks === 0 && rectanglesIntersect(movedPowerUp, nextGame.player)) {
      nextGame = applySpaceInvadersPowerUp(nextGame, movedPowerUp);
      continue;
    }

    if (movedPowerUp.y <= game.boardHeight) {
      activePowerUps.push(movedPowerUp);
    }
  }

  return {
    ...nextGame,
    powerUps: activePowerUps,
  };
}

function applySpaceInvadersPowerUp(
  game: SpaceInvadersGameState,
  powerUp: SpaceInvadersPowerUp,
): SpaceInvadersGameState {
  switch (powerUp.kind) {
    case "bonus-score":
      return createSpaceInvadersScorePopup(
        {
          ...game,
          score: game.score + SPACE_INVADERS_BONUS_SCORE_POINTS,
        },
        powerUp,
        { points: SPACE_INVADERS_BONUS_SCORE_POINTS },
      );
    case "extra-life":
      return {
        ...game,
        lives: game.lives + 1,
      };
    case "burst-shot":
    case "piercing-laser":
    case "shotgun-shot":
      return {
        ...game,
        pendingShotPowerUp: powerUp.kind,
      };
    case "freeze":
      return {
        ...game,
        alienFreezeTicks: Math.max(
          game.alienFreezeTicks,
          SPACE_INVADERS_ALIEN_FREEZE_TICKS,
        ),
      };
    case "shield":
      return {
        ...game,
        playerShieldTicks: Math.max(
          game.playerShieldTicks,
          SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
        ),
      };
  }
}

function advanceAlienFreeze(game: SpaceInvadersGameState) {
  if (game.alienFreezeTicks <= 0) {
    return {
      game,
      isFrozen: false,
    };
  }

  return {
    game: {
      ...game,
      alienFreezeTicks: game.alienFreezeTicks - 1,
    },
    isFrozen: true,
  };
}

function advanceInvaderShots(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.invaderShots.length === 0) {
    return game;
  }

  const movedShots = game.invaderShots
    .map((shot) => advanceInvaderShot(shot, game))
    .filter((shot) => isInvaderShotActive(shot, game));
  const hittingShots = movedShots.filter((shot) => rectanglesIntersect(shot, game.player));
  const didHitPlayer = hittingShots.length > 0;

  if (!didHitPlayer) {
    return {
      ...game,
      invaderShots: movedShots,
    };
  }

  if (game.playerRespawnTicks > 0) {
    return {
      ...game,
      invaderShots: movedShots,
    };
  }

  if (game.playerShieldTicks > 0) {
    return {
      ...game,
      invaderShots: movedShots.filter((shot) => !hittingShots.includes(shot)),
    };
  }

  const lives = game.lives - 1;
  const gameWithExplosion = createSpaceInvadersExplosion(
    game,
    "player",
    game.player,
    random,
  );

  return {
    ...gameWithExplosion,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots: [],
    hitStreak: 0,
    lives,
    player: createCenteredPlayer(game.boardWidth, game.boardHeight),
    playerBurst: null,
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    status: lives <= 0 ? "lost" : game.status,
  };
}

function advancePlayerRecovery(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.playerRespawnTicks > 0) {
    const playerRespawnTicks = game.playerRespawnTicks - 1;

    return {
      ...game,
      playerRespawnTicks,
      playerShieldTicks:
        playerRespawnTicks === 0
          ? SPACE_INVADERS_PLAYER_SHIELD_TICKS
          : game.playerShieldTicks,
    };
  }

  if (game.playerShieldTicks > 0) {
    return {
      ...game,
      playerShieldTicks: game.playerShieldTicks - 1,
    };
  }

  return game;
}

function advanceExplosions(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.explosions.length === 0) {
    return game;
  }

  return {
    ...game,
    explosions: game.explosions
      .map((explosion) => ({
        ...explosion,
        ageTicks: explosion.ageTicks + 1,
        ttlTicks: explosion.ttlTicks - 1,
      }))
      .filter((explosion) => explosion.ttlTicks > 0),
  };
}

function advanceScorePopups(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.scorePopups.length === 0) {
    return game;
  }

  return {
    ...game,
    scorePopups: game.scorePopups
      .map((popup) => ({
        ...popup,
        ageTicks: popup.ageTicks + 1,
        ttlTicks: popup.ttlTicks - 1,
      }))
      .filter((popup) => popup.ttlTicks > 0),
  };
}

function advanceSpaceInvadersMultiKillComboWindow(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;

  if (combo === null) {
    return game;
  }

  if (game.status !== "running" || isSpaceInvadersVolleyFinished(game)) {
    return finalizeSpaceInvadersMultiKillCombo(game);
  }

  const nextCombo = {
    ...combo,
    ticksRemaining: combo.ticksRemaining - 1,
  };

  if (nextCombo.ticksRemaining <= 0) {
    return finalizeSpaceInvadersMultiKillCombo({
      ...game,
      multiKillCombo: nextCombo,
    });
  }

  return {
    ...game,
    multiKillCombo: nextCombo,
  };
}

function finalizeSpaceInvadersMultiKillComboIfVolleyEnded(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.multiKillCombo === null || !isSpaceInvadersVolleyFinished(game)) {
    return game;
  }

  return finalizeSpaceInvadersMultiKillCombo(game);
}

function finalizeSpaceInvadersPlayerVolley(game: SpaceInvadersGameState) {
  if (!isSpaceInvadersVolleyFinished(game)) {
    return game;
  }

  const resolvedGame =
    game.playerVolleyHasUnscoredExit && !game.playerVolleyHasScored
      ? resetSpaceInvadersHitStreak(game)
      : game;

  if (
    !resolvedGame.playerVolleyHasScored &&
    !resolvedGame.playerVolleyHasUnscoredExit
  ) {
    return resolvedGame;
  }

  return {
    ...resolvedGame,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
  };
}

function continueSpaceInvadersMultiKillCombo(
  game: SpaceInvadersGameState,
  target: SpaceInvadersScoreTarget,
  destroyedCount: number,
  points: number,
  scoreScale: number,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;
  const mergedTarget =
    combo === null
      ? target
      : getCombinedSpaceInvadersScoreTarget([combo, target]);

  return {
    ...game,
    multiKillCombo: {
      destroyedCount: (combo?.destroyedCount ?? 0) + destroyedCount,
      height: mergedTarget.height,
      points: (combo?.points ?? 0) + points,
      scoreScale: Math.max(combo?.scoreScale ?? 1, scoreScale),
      ticksRemaining: SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
      width: mergedTarget.width,
      x: mergedTarget.x,
      y: mergedTarget.y,
    },
  };
}

function finalizeSpaceInvadersMultiKillCombo(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;

  if (combo === null) {
    return game;
  }

  const multiKillBonus = getSpaceInvadersMultiKillBonus(combo.destroyedCount);
  const gameWithBonus = {
    ...game,
    multiKillCombo: null,
    score: game.score + multiKillBonus,
  };

  return createSpaceInvadersScorePopup(gameWithBonus, combo, {
    label: getSpaceInvadersInvaderScorePopupLabel(
      combo.destroyedCount,
      multiKillBonus,
    ),
    points: combo.points + multiKillBonus,
    scoreScale: combo.scoreScale,
  });
}

function isSpaceInvadersVolleyFinished(
  game: Pick<SpaceInvadersGameState, "playerBurst" | "playerShots">,
) {
  return game.playerShots.length === 0 && game.playerBurst === null;
}

function createSpaceInvadersExplosion(
  game: SpaceInvadersGameState,
  kind: SpaceInvadersExplosionKind,
  target: { height: number; width: number; x: number; y: number },
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  const padding = EXPLOSION_PADDING_BY_KIND[kind];
  const height = target.height + padding * 2;
  const width = target.width + padding * 2;
  const variant =
    SPACE_INVADERS_EXPLOSION_VARIANTS[
      getRandomIndex(SPACE_INVADERS_EXPLOSION_VARIANTS.length, random)
    ] ?? 1;
  const explosion: SpaceInvadersExplosion = {
    ageTicks: 0,
    height,
    id: `explosion-${game.nextExplosionId}`,
    kind,
    ttlTicks: EXPLOSION_TTL_TICKS,
    variant,
    width,
    x: target.x + target.width / 2 - width / 2,
    y: target.y + target.height / 2 - height / 2,
  };

  return {
    ...game,
    explosions: [...game.explosions, explosion],
    nextExplosionId: game.nextExplosionId + 1,
  };
}

function createSpaceInvadersScorePopup(
  game: SpaceInvadersGameState,
  target: SpaceInvadersScoreTarget,
  { label, points, scoreScale = 1 }: SpaceInvadersScorePopupOptions,
): SpaceInvadersGameState {
  const scorePopup: SpaceInvadersScorePopup = {
    ageTicks: 0,
    height: target.height,
    id: `score-popup-${game.nextScorePopupId}`,
    ...(label === undefined ? {} : { label }),
    points,
    ...(scoreScale <= 1 ? {} : { scoreScale }),
    ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
    width: target.width,
    x: target.x,
    y: target.y,
  };

  return {
    ...game,
    nextScorePopupId: game.nextScorePopupId + 1,
    scorePopups: [...game.scorePopups, scorePopup],
  };
}

function advanceSpaceInvadersHitStreak(
  game: SpaceInvadersGameState,
): { bonus: number; game: SpaceInvadersGameState } {
  const hitStreak = game.hitStreak + 1;
  const bonus = getSpaceInvadersHitStreakBonus(hitStreak);
  const gameWithHitStreak = {
    ...game,
    hitStreak,
    score: game.score + bonus,
  };

  return {
    bonus,
    game: gameWithHitStreak,
  };
}

function resetSpaceInvadersHitStreak(game: SpaceInvadersGameState) {
  if (game.hitStreak === 0) {
    return game;
  }

  return {
    ...game,
    hitStreak: 0,
  };
}

function advanceSpaceInvadersUfoChain(
  game: SpaceInvadersGameState,
): { bonus: number; game: SpaceInvadersGameState } {
  const ufoHitStreak = game.ufoHitStreak + 1;
  const bonus = getSpaceInvadersUfoChainBonus(ufoHitStreak);
  const gameWithUfoHitStreak = {
    ...game,
    ufoHitStreak,
    score: game.score + bonus,
  };

  return {
    bonus,
    game: gameWithUfoHitStreak,
  };
}

function getSpaceInvadersHitStreakBonus(hitStreak: number) {
  return Math.min(
    Math.max(0, hitStreak - 1) * SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
    SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  );
}

function getSpaceInvadersHitStreakPopupScale(hitStreak: number) {
  const scoreScale = Math.min(
    1 + Math.max(0, hitStreak - 1) * SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
    SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  );

  return Number(scoreScale.toFixed(2));
}

function getSpaceInvadersUfoChainBonus(ufoHitStreak: number) {
  return Math.min(
    Math.max(0, ufoHitStreak - 1) * SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
    SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  );
}

function getSpaceInvadersMultiKillBonus(destroyedInvaderCount: number) {
  if (destroyedInvaderCount >= 4) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[4];
  }

  if (destroyedInvaderCount === 3) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[3];
  }

  if (destroyedInvaderCount === 2) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[2];
  }

  return 0;
}

function getSpaceInvadersInvaderScorePopupLabel(
  destroyedInvaderCount: number,
  multiKillBonus: number,
) {
  if (multiKillBonus > 0) {
    if (destroyedInvaderCount === 2) {
      return "DOUBLE";
    }

    if (destroyedInvaderCount === 3) {
      return "TRIPLE";
    }

    return "MULTI";
  }

  return undefined;
}

function getCombinedSpaceInvadersScoreTarget(
  targets: SpaceInvadersScoreTarget[],
): SpaceInvadersScoreTarget {
  const left = Math.min(...targets.map((target) => target.x));
  const top = Math.min(...targets.map((target) => target.y));
  const right = Math.max(...targets.map((target) => target.x + target.width));
  const bottom = Math.max(...targets.map((target) => target.y + target.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function maybeFireInvaderShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.invaderShotCooldownTicks > 0) {
    return {
      ...game,
      invaderShotCooldownTicks: game.invaderShotCooldownTicks - 1,
    };
  }

  if (game.invaderBurst !== null) {
    return continueInvaderBurst(game);
  }

  if (game.invaderShots.length >= MAX_INVADER_SHOTS) {
    return game;
  }

  const shooter = selectInvaderShotSource(game);

  if (shooter === undefined) {
    return {
      ...game,
      invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    };
  }

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId);

  if (game.invaderShots.length + createdShots.length > MAX_INVADER_SHOTS) {
    return game;
  }

  const spec = getInvaderShotSpec(shooter.row);

  return {
    ...game,
    invaderBurst:
      spec.kind === "burst"
        ? {
            remainingShots: BURST_SHOT_COUNT - createdShots.length,
            sourceInvaderId: shooter.id,
          }
        : null,
    invaderShotCooldownTicks:
      spec.kind === "burst" ? BURST_SHOT_DELAY_TICKS : spec.cooldownTicks,
    invaderShots: [...game.invaderShots, ...createdShots],
    nextInvaderShotId: game.nextInvaderShotId + createdShots.length,
  };
}

function continueInvaderBurst(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const burst = game.invaderBurst;

  if (burst === null) {
    return game;
  }

  const shooter = game.invaders.find(
    (invader) => invader.id === burst.sourceInvaderId && invader.isActive,
  );

  if (shooter === undefined) {
    return {
      ...game,
      invaderBurst: null,
      invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    };
  }

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId);

  if (game.invaderShots.length + createdShots.length > MAX_INVADER_SHOTS) {
    return game;
  }

  const remainingShots = burst.remainingShots - createdShots.length;

  return {
    ...game,
    invaderBurst:
      remainingShots > 0
        ? {
            ...burst,
            remainingShots,
          }
        : null,
    invaderShotCooldownTicks:
      remainingShots > 0
        ? BURST_SHOT_DELAY_TICKS
        : getInvaderShotSpec(shooter.row).cooldownTicks,
    invaderShots: [...game.invaderShots, ...createdShots],
    nextInvaderShotId: game.nextInvaderShotId + createdShots.length,
  };
}

function selectInvaderShotSource(game: SpaceInvadersGameState) {
  const lowestInvaders = getLowestActiveInvadersByColumn(game.invaders);
  const blockedColumns = new Set(game.invaderShots.map((shot) => shot.sourceColumn));
  const unblockedInvaders = lowestInvaders.filter(
    (invader) => !blockedColumns.has(invader.column),
  );
  const candidates = unblockedInvaders.length > 0 ? unblockedInvaders : lowestInvaders;

  if (candidates.length === 0) {
    return undefined;
  }

  const playerCenterX = game.player.x + game.player.width / 2;

  return [...candidates].sort((first, second) => {
    const firstDistance = Math.abs(getEntityCenterX(first) - playerCenterX);
    const secondDistance = Math.abs(getEntityCenterX(second) - playerCenterX);

    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance;
    }

    return first.column - second.column;
  })[0];
}

function getLowestActiveInvadersByColumn(invaders: SpaceInvader[]) {
  const lowestInvaderByColumn = new Map<number, SpaceInvader>();

  for (const invader of invaders) {
    if (!invader.isActive) {
      continue;
    }

    const current = lowestInvaderByColumn.get(invader.column);

    if (
      current === undefined ||
      invader.y > current.y ||
      (invader.y === current.y && invader.row > current.row)
    ) {
      lowestInvaderByColumn.set(invader.column, invader);
    }
  }

  return [...lowestInvaderByColumn.values()];
}

function advanceInvaderShot(
  shot: SpaceInvadersInvaderShot,
  game: SpaceInvadersGameState,
): SpaceInvadersInvaderShot {
  const velocityX = getNextInvaderShotVelocityX(shot, game.player);

  return {
    ...shot,
    ageTicks: shot.ageTicks + 1,
    ttlTicks: shot.ttlTicks === null ? null : shot.ttlTicks - 1,
    velocityX,
    x: shot.x + velocityX,
    y: shot.y + shot.velocityY,
  };
}

function getNextInvaderShotVelocityX(
  shot: SpaceInvadersInvaderShot,
  player: SpaceInvadersPlayer,
) {
  if (shot.kind === "commander") {
    const deltaX = getEntityCenterX(player) - getEntityCenterX(shot);

    if (Math.abs(deltaX) < 1) {
      return shot.velocityX;
    }

    return clamp(
      shot.velocityX + Math.sign(deltaX) * COMMANDER_SHOT_STEER_X,
      -COMMANDER_SHOT_MAX_SPEED_X,
      COMMANDER_SHOT_MAX_SPEED_X,
    );
  }

  return shot.velocityX;
}

function isInvaderShotActive(
  shot: SpaceInvadersInvaderShot,
  game: Pick<SpaceInvadersGameState, "boardHeight" | "boardWidth">,
) {
  return (
    (shot.ttlTicks === null || shot.ttlTicks > 0) &&
    shot.y <= game.boardHeight &&
    shot.x + shot.width >= 0 &&
    shot.x <= game.boardWidth
  );
}

function createInvaderShots(invader: SpaceInvader, nextInvaderShotId: number) {
  const spec = getInvaderShotSpec(invader.row);

  if (spec.kind === "scatter") {
    return SCATTER_SHOT_VELOCITIES_X.map((velocityX, index) =>
      createInvaderShot(invader, nextInvaderShotId + index, spec, velocityX),
    );
  }

  return [createInvaderShot(invader, nextInvaderShotId, spec, spec.velocityX)];
}

function maybeCreateSpaceInvadersRevengeShots(
  game: SpaceInvadersGameState,
  destroyedInvaders: SpaceInvader[],
): SpaceInvadersGameState {
  const destroyedRevengeInvaders = destroyedInvaders.filter(
    (invader) => invader.kind === "revenge",
  );

  if (destroyedRevengeInvaders.length === 0) {
    return game;
  }

  const revengeSources = getRevengeShotSources(
    destroyedRevengeInvaders,
    game.invaders,
  );
  const revengeShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = game.nextInvaderShotId;

  for (const source of revengeSources) {
    const createdShots = createInvaderShots(source, nextInvaderShotId);

    revengeShots.push(...createdShots);
    nextInvaderShotId += createdShots.length;
  }

  if (revengeShots.length === 0) {
    return game;
  }

  return {
    ...game,
    invaderShots: [...game.invaderShots, ...revengeShots],
    nextInvaderShotId,
  };
}

function getRevengeShotSources(
  destroyedRevengeInvaders: SpaceInvader[],
  invaders: SpaceInvader[],
) {
  const sourceById = new Map<string, SpaceInvader>();

  for (const revengeInvader of destroyedRevengeInvaders) {
    const adjacentInvaders = invaders
      .filter(
        (invader) =>
          invader.isActive &&
          Math.abs(invader.row - revengeInvader.row) <= 1 &&
          Math.abs(invader.column - revengeInvader.column) <= 1,
      )
      .sort((first, second) =>
        first.row === second.row
          ? first.column - second.column
          : first.row - second.row,
      );

    for (const adjacentInvader of adjacentInvaders) {
      sourceById.set(adjacentInvader.id, adjacentInvader);
    }
  }

  return [...sourceById.values()];
}

function createInvaderShot(
  invader: SpaceInvader,
  nextInvaderShotId: number,
  spec: InvaderShotSpec,
  velocityX: number,
): SpaceInvadersInvaderShot {
  return {
    ageTicks: 0,
    height: spec.height,
    id: `invader-shot-${nextInvaderShotId}`,
    kind: spec.kind,
    sourceColumn: invader.column,
    sourceInvaderId: invader.id,
    sourceRow: invader.row,
    ttlTicks: spec.ttlTicks,
    velocityX,
    velocityY: spec.velocityY,
    width: spec.width,
    x: invader.x + invader.width / 2 - spec.width / 2,
    y: invader.y + invader.height + 1,
  };
}

function getInvaderShotSpec(row: number) {
  return INVADER_SHOT_SPECS[getInvaderShotKind(row)];
}

function getInvaderShotKind(row: number) {
  return SPACE_INVADERS_ROW_SHOT_KINDS[row] ?? "scatter";
}

function marchInvaders(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const exposedDiverIds = getExposedDiverIds(activeInvaders);
  const formationInvaders = activeInvaders.filter(
    (invader) => !isExposedDiver(invader, exposedDiverIds),
  );
  const wouldFormationHitWall = formationInvaders.some((invader) => {
    const nextX =
      invader.x + game.marchDirection * getInvaderStepX(invader, exposedDiverIds);

    return nextX < 0 || nextX + invader.width > game.boardWidth;
  });

  const nextMarchDirection = wouldFormationHitWall
    ? ((game.marchDirection * -1) as SpaceInvadersDirection)
    : game.marchDirection;

  if (wouldFormationHitWall) {
    return {
      ...game,
      invaders: game.invaders.map((invader) => {
        if (!invader.isActive) {
          return invader;
        }

        const isDiving = isExposedDiver(invader, exposedDiverIds);

        return {
          ...invader,
          direction: nextMarchDirection,
          isDiving,
          y: invader.y + (isDiving ? DIVER_DROP_Y : INVADER_DROP_Y),
        };
      }),
      marchDirection: nextMarchDirection,
    };
  }

  return {
    ...game,
    invaders: game.invaders.map((invader) => {
      if (!invader.isActive) {
        return invader;
      }

      if (isExposedDiver(invader, exposedDiverIds)) {
        return advanceDivingInvader(invader, game);
      }

      return {
        ...invader,
        direction: game.marchDirection,
        x: invader.x + game.marchDirection * getInvaderStepX(invader, exposedDiverIds),
        isDiving: getNextDiverState(invader, exposedDiverIds),
      };
    }),
  };
}

function advanceDivingInvader(
  invader: SpaceInvader,
  game: Pick<SpaceInvadersGameState, "boardWidth">,
): SpaceInvader {
  const nextX = invader.x + invader.direction * INVADER_STEP_X * DIVER_STEP_MULTIPLIER;

  if (nextX < 0 || nextX + invader.width > game.boardWidth) {
    return {
      ...invader,
      direction: (invader.direction * -1) as SpaceInvadersDirection,
      isDiving: true,
      x: clamp(invader.x, 0, game.boardWidth - invader.width),
      y: invader.y + DIVER_DROP_Y,
    };
  }

  return {
    ...invader,
    isDiving: true,
    x: nextX,
  };
}

function getExposedDiverIds(activeInvaders: SpaceInvader[]) {
  return new Set(
    activeInvaders
      .filter((invader) => invader.kind === "diver")
      .filter((invader) => invader.isDiving || isDiverLaneClear(invader, activeInvaders))
      .map((invader) => invader.id),
  );
}

function isDiverLaneClear(diver: SpaceInvader, activeInvaders: SpaceInvader[]) {
  return !activeInvaders.some(
    (invader) =>
      invader.id !== diver.id && invader.y > diver.y && invadersOverlapX(diver, invader),
  );
}

function invadersOverlapX(first: SpaceInvader, second: SpaceInvader) {
  return first.x < second.x + second.width && second.x < first.x + first.width;
}

function getInvaderStepX(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return INVADER_STEP_X * getInvaderMovementMultiplier(invader, exposedDiverIds);
}

function getInvaderMovementMultiplier(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
) {
  return isExposedDiver(invader, exposedDiverIds) ? DIVER_STEP_MULTIPLIER : 1;
}

function getNextDiverState(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return invader.isDiving || isExposedDiver(invader, exposedDiverIds);
}

function isExposedDiver(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return invader.kind === "diver" && exposedDiverIds.has(invader.id);
}

function hasInvaderReachedBase(game: SpaceInvadersGameState) {
  return game.invaders.some(
    (invader) => invader.isActive && invader.y + invader.height >= game.baseY,
  );
}

function createCenteredPlayer(
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
): SpaceInvadersPlayer {
  return {
    height: PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    x: (boardWidth - PLAYER_WIDTH) / 2,
    y: boardHeight - PLAYER_HEIGHT - PLAYER_BOTTOM_MARGIN,
  };
}

function createPlayerShots(
  player: SpaceInvadersPlayer,
  nextPlayerShotId: number,
  pendingShotPowerUp: SpaceInvadersPendingShotPowerUp | null,
): SpaceInvadersPlayerShot[] {
  if (pendingShotPowerUp === "shotgun-shot") {
    return SHOTGUN_SHOT_VELOCITIES_X.map((velocityX, index) =>
      createPlayerShot(player, nextPlayerShotId + index, "shotgun", velocityX),
    );
  }

  return [
    createPlayerShot(
      player,
      nextPlayerShotId,
      getPlayerShotKind(pendingShotPowerUp),
      0,
    ),
  ];
}

function getPlayerShotKind(
  pendingShotPowerUp: SpaceInvadersPendingShotPowerUp | null,
): SpaceInvadersPlayerShotKind {
  if (pendingShotPowerUp === "burst-shot") {
    return "burst";
  }

  if (pendingShotPowerUp === "piercing-laser") {
    return "piercing";
  }

  return "standard";
}

function createPlayerShot(
  player: SpaceInvadersPlayer,
  nextPlayerShotId: number,
  kind: SpaceInvadersPlayerShotKind,
  velocityX: number,
): SpaceInvadersPlayerShot {
  return {
    height: SHOT_HEIGHT,
    hasScored: false,
    id: `player-shot-${nextPlayerShotId}`,
    kind,
    velocityX,
    velocityY: SHOT_SPEED,
    width: SHOT_WIDTH,
    x: player.x + player.width / 2 - SHOT_WIDTH / 2,
    y: player.y - SHOT_HEIGHT - 2,
  };
}

function advancePlayerShotPosition(shot: SpaceInvadersPlayerShot): SpaceInvadersPlayerShot {
  return {
    ...shot,
    x: shot.x + shot.velocityX,
    y: shot.y + shot.velocityY,
  };
}

function isPlayerShotActive(
  shot: SpaceInvadersPlayerShot,
  game: Pick<SpaceInvadersGameState, "boardHeight" | "boardWidth">,
) {
  return (
    shot.y + shot.height >= 0 &&
    shot.x + shot.width >= 0 &&
    shot.x <= game.boardWidth &&
    shot.y <= game.boardHeight
  );
}

function maybeCreateSpaceInvadersPowerUpDrop(
  game: SpaceInvadersGameState,
  invader: SpaceInvader,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (invader.kind !== "diver") {
    return game;
  }

  const powerUp: SpaceInvadersPowerUp = {
    height: SPACE_INVADERS_POWER_UP_SIZE,
    id: `power-up-${game.nextPowerUpId}`,
    kind: getRandomPowerUpKind(random),
    velocityY: SPACE_INVADERS_POWER_UP_SPEED,
    width: SPACE_INVADERS_POWER_UP_SIZE,
    x: invader.x + invader.width / 2 - SPACE_INVADERS_POWER_UP_SIZE / 2,
    y: invader.y + invader.height / 2 - SPACE_INVADERS_POWER_UP_SIZE / 2,
  };

  return {
    ...game,
    nextPowerUpId: game.nextPowerUpId + 1,
    powerUps: [...game.powerUps, powerUp],
  };
}

function getRandomPowerUpKind(random: SpaceInvadersRandomSource) {
  const randomValue = getRandomValue(random);

  if (randomValue < SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE) {
    return "extra-life";
  }

  const commonRandomValue =
    (randomValue - SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE) /
    (1 - SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE);

  return (
    SPACE_INVADERS_COMMON_POWER_UP_KINDS[
      getRandomIndex(SPACE_INVADERS_COMMON_POWER_UP_KINDS.length, () => commonRandomValue)
    ] ?? "bonus-score"
  );
}

function createInitialSpaceInvadersUfo(): SpaceInvadersUfoState {
  return {
    cooldownTicks: UFO_COOLDOWN_TICKS,
    direction: 1,
    height: UFO_HEIGHT,
    isActive: false,
    points: UFO_POINT_VALUES[0],
    width: UFO_WIDTH,
    x: -UFO_WIDTH,
    y: UFO_Y,
  };
}

function deactivateSpaceInvadersUfo(
  ufo: SpaceInvadersUfoState,
  boardWidth: number,
): SpaceInvadersUfoState {
  const nextDirection = (ufo.direction * -1) as SpaceInvadersDirection;

  return {
    ...ufo,
    cooldownTicks: UFO_COOLDOWN_TICKS,
    direction: nextDirection,
    isActive: false,
    points: getNextSpaceInvadersUfoPoints(ufo.points),
    x: nextDirection === 1 ? -ufo.width : boardWidth,
  };
}

function getNextSpaceInvadersUfoPoints(points: number) {
  const pointIndex = UFO_POINT_VALUES.findIndex((value) => value === points);
  const nextIndex = pointIndex === -1 ? 0 : (pointIndex + 1) % UFO_POINT_VALUES.length;

  return UFO_POINT_VALUES[nextIndex] ?? UFO_POINT_VALUES[0];
}

function getInvaderPoints(row: number) {
  if (row === 0) {
    return 30;
  }

  if (row <= 2) {
    return 20;
  }

  return 10;
}

function selectDiverInvaderIds(
  rows: number,
  columns: number,
  random: SpaceInvadersRandomSource,
  excludedIds = new Set<string>(),
) {
  const candidates = Array.from({ length: Math.max(0, rows - 1) }, (_, row) =>
    Array.from({ length: columns }, (_, column) => `${row}:${column}`),
  )
    .flat()
    .filter((id) => !excludedIds.has(id));
  const selectedCount = Math.min(DIVER_INVADER_COUNT, candidates.length);
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectShieldBearerInvaderIds({
  columns,
  random,
  rows,
}: {
  columns: number;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const candidates = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  ).flat();
  const selectedCount = Math.min(SPACE_INVADERS_SHIELD_BEARER_COUNT, candidates.length);
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectRevengeAlienIds({
  columns,
  excludedIds,
  random,
  rows,
}: {
  columns: number;
  excludedIds: Set<string>;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const unavailableIds = getUnavailableRevengeAlienIds(excludedIds, columns);
  const middleRowIds = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  ).flat();
  const preferredCandidates = middleRowIds.filter((id) => !unavailableIds.has(id));
  const fallbackCandidates = middleRowIds.filter(
    (id) => !excludedIds.has(id) && unavailableIds.has(id),
  );
  const candidates = [...preferredCandidates, ...fallbackCandidates];
  const nonBottomSlotCount = Math.max(0, rows - 1) * columns;
  const maximumRevengeAlienCount = Math.max(
    0,
    nonBottomSlotCount - excludedIds.size - DIVER_INVADER_COUNT,
  );
  const selectedCount = Math.min(
    SPACE_INVADERS_REVENGE_ALIEN_COUNT,
    maximumRevengeAlienCount,
    candidates.length,
  );
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function getUnavailableRevengeAlienIds(excludedIds: Set<string>, columns: number) {
  const unavailableIds = new Set<string>(excludedIds);

  for (const id of excludedIds) {
    const [row, column] = getInvaderGridPositionFromId(id);

    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const unavailableColumn = column + columnOffset;

      if (unavailableColumn >= 0 && unavailableColumn < columns) {
        unavailableIds.add(`${row}:${unavailableColumn}`);
      }
    }
  }

  return unavailableIds;
}

function getInvaderGridPositionFromId(id: string) {
  const [row = "0", column = "0"] = id.split(":");

  return [Number(row), Number(column)] as const;
}

export function isSpaceInvaderShielded(
  invader: SpaceInvader,
  invaders: SpaceInvader[],
) {
  if (!invader.isActive || invader.kind === "shield-bearer") {
    return false;
  }

  const invaderCenterX = getEntityCenterX(invader);
  const maximumShieldDistanceX = INVADER_WIDTH + INVADER_GAP_X + 1;

  return invaders.some(
    (candidate) =>
      candidate.isActive &&
      candidate.kind === "shield-bearer" &&
      candidate.row === invader.row &&
      Math.abs(getEntityCenterX(candidate) - invaderCenterX) <=
        maximumShieldDistanceX,
  );
}

function getRandomIndex(candidateCount: number, random: SpaceInvadersRandomSource) {
  if (candidateCount <= 1) {
    return 0;
  }

  const randomValue = getRandomValue(random);

  return Math.max(0, Math.min(candidateCount - 1, Math.floor(randomValue * candidateCount)));
}

function getRandomValue(random: SpaceInvadersRandomSource) {
  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, randomValue));
}

function rectanglesIntersect(
  first: { height: number; width: number; x: number; y: number },
  second: { height: number; width: number; x: number; y: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function getEntityCenterX(entity: { width: number; x: number }) {
  return entity.x + entity.width / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSpaceInvadersFormationSpec(alienCount: number) {
  const normalizedAlienCount = Number.isFinite(alienCount)
    ? Math.max(1, Math.floor(alienCount))
    : SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS;

  return (
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS.find(
      (option) => option.alienCount === normalizedAlienCount,
    ) ??
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS.find(
      (option) => option.alienCount === SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
    ) ??
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS[SPACE_INVADERS_ALIEN_COUNT_OPTIONS.length - 1]
  );
}

function normalizeSpaceInvadersDimension(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}
