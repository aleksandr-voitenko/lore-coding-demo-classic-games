export type SpaceInvadersStatus = "ready" | "running" | "paused" | "lost" | "won";

export type SpaceInvadersDirection = -1 | 1;

export type SpaceInvaderKind = "standard" | "diver";

export type SpaceInvadersRandomSource = () => number;

export type SpaceInvadersInvaderShotKind =
  | "commander"
  | "zigzag"
  | "standard"
  | "needle"
  | "scatter";

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

export type SpaceInvadersGameState = {
  alienCount: number;
  baseY: number;
  boardHeight: number;
  boardWidth: number;
  explosions: SpaceInvadersExplosion[];
  invaderShotCooldownTicks: number;
  invaderShots: SpaceInvadersInvaderShot[];
  invaders: SpaceInvader[];
  lives: number;
  marchDirection: SpaceInvadersDirection;
  nextExplosionId: number;
  nextInvaderShotId: number;
  player: SpaceInvadersPlayer;
  playerRespawnTicks: number;
  playerShieldTicks: number;
  playerShot: SpaceInvadersShot | null;
  score: number;
  status: SpaceInvadersStatus;
  ufo: SpaceInvadersUfoState;
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

const INVADER_DROP_Y = 4;
const DIVER_INVADER_COUNT = 10;
const DIVER_DROP_Y = 16;
const DIVER_STEP_MULTIPLIER = 4.375;
const EXPLOSION_PADDING_BY_KIND: Record<SpaceInvadersExplosionKind, number> = {
  invader: 16,
  player: 12,
  ufo: 18,
};
const EXPLOSION_TTL_TICKS = 12;
export const SPACE_INVADERS_PLAYER_RESPAWN_TICKS = EXPLOSION_TTL_TICKS;
export const SPACE_INVADERS_PLAYER_SHIELD_TICKS = Math.round(
  5_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS = Math.round(
  2_000 / SPACE_INVADERS_TICK_DELAY_MS,
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
const INVADER_X = 38;
const PLAYER_HEIGHT = 50;
const PLAYER_SPEED = 9.6;
const PLAYER_WIDTH = 62;
const SHOT_HEIGHT = 22;
const SHOT_SPEED = -6.4;
const SHOT_WIDTH = 6;
const UFO_COOLDOWN_TICKS = 420;
const UFO_HEIGHT = 18;
const UFO_POINT_VALUES = [100, 150, 200, 300] as const;
const UFO_SPEED = 2.4;
const UFO_WIDTH = 48;
const UFO_Y = 34;
const COMMANDER_SHOT_MAX_SPEED_X = 1.1;
const COMMANDER_SHOT_STEER_X = 0.14;
const ZIGZAG_SHOT_SEGMENT_TICKS = 12;
const SCATTER_SHOT_VELOCITIES_X = [-1.25, 0, 1.25] as const;

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
  "zigzag",
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
  zigzag: {
    cooldownTicks: 92,
    height: 18,
    kind: "zigzag",
    ttlTicks: null,
    velocityX: 1.15,
    velocityY: 3,
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
    baseY: normalizedBoardHeight - 68,
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    explosions: [],
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
    player: createCenteredPlayer(normalizedBoardWidth, normalizedBoardHeight),
    playerRespawnTicks: 0,
    playerShieldTicks: 0,
    playerShot: null,
    score: 0,
    status: "ready",
    ufo: createInitialSpaceInvadersUfo(),
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
  const diverInvaderIds = selectDiverInvaderIds(rows, columns, random);

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column): SpaceInvader => {
      const id = `${row}:${column}`;
      const kind: SpaceInvaderKind = diverInvaderIds.has(id) ? "diver" : "standard";
      const x = startX + column * (INVADER_WIDTH + INVADER_GAP_X);
      const y = INVADER_TOP + row * (INVADER_HEIGHT + INVADER_GAP_Y);

      return {
        column,
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
  if (game.status !== "running" || game.playerRespawnTicks > 0 || game.playerShot !== null) {
    return game;
  }

  return {
    ...game,
    playerShot: createPlayerShot(game.player),
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
  const gameAfterShot = advancePlayerShot(gameAfterExplosions, random);

  if (gameAfterShot.status === "won") {
    return gameAfterShot;
  }

  const gameAfterInvaderShots = advanceInvaderShots(gameAfterShot, random);

  if (
    gameAfterInvaderShots.status === "lost" ||
    gameAfterInvaderShots.lives < gameAfterShot.lives
  ) {
    return gameAfterInvaderShots;
  }

  const gameAfterInvaderFire = maybeFireInvaderShot(gameAfterInvaderShots);
  const gameAfterUfo = advanceSpaceInvadersUfo(gameAfterInvaderFire);
  const marchedGame = marchInvaders(gameAfterUfo);

  if (hasInvaderReachedBase(marchedGame)) {
    return {
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    };
  }

  return advancePlayerRecovery(marchedGame);
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
}

function advancePlayerShot(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.playerShot === null) {
    return game;
  }

  const movedShot = {
    ...game.playerShot,
    y: game.playerShot.y + game.playerShot.velocityY,
  };

  if (movedShot.y + movedShot.height < 0) {
    return {
      ...game,
      playerShot: null,
    };
  }

  if (game.ufo.isActive && rectanglesIntersect(movedShot, game.ufo)) {
    const gameWithExplosion = createSpaceInvadersExplosion(game, "ufo", game.ufo, random);

    return {
      ...gameWithExplosion,
      playerShot: null,
      score: game.score + game.ufo.points,
      ufo: deactivateSpaceInvadersUfo(game.ufo, game.boardWidth),
    };
  }

  const hitInvader = game.invaders.find(
    (invader) => invader.isActive && rectanglesIntersect(movedShot, invader),
  );

  if (hitInvader === undefined) {
    return {
      ...game,
      playerShot: movedShot,
    };
  }

  const invaders = game.invaders.map((invader) =>
    invader.id === hitInvader.id ? { ...invader, isActive: false } : invader,
  );
  const score = game.score + hitInvader.points;
  const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;
  const gameWithExplosion = createSpaceInvadersExplosion(
    game,
    "invader",
    hitInvader,
    random,
  );

  return {
    ...gameWithExplosion,
    invaders,
    playerShot: null,
    score,
    status: activeInvaderCount === 0 ? "won" : game.status,
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
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots: [],
    lives,
    player: createCenteredPlayer(game.boardWidth, game.boardHeight),
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShot: null,
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

function maybeFireInvaderShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.invaderShotCooldownTicks > 0) {
    return {
      ...game,
      invaderShotCooldownTicks: game.invaderShotCooldownTicks - 1,
    };
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

  return {
    ...game,
    invaderShotCooldownTicks: getInvaderShotSpec(shooter.row).cooldownTicks,
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

  if (shot.kind === "zigzag") {
    const segment = Math.floor(
      (shot.ageTicks + shot.sourceColumn * 2) / ZIGZAG_SHOT_SEGMENT_TICKS,
    );
    const direction = segment % 2 === 0 ? 1 : -1;

    return Math.abs(shot.velocityX) * direction;
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
  const wouldHitWall = activeInvaders.some((invader) => {
    const nextX =
      invader.x + game.marchDirection * getInvaderStepX(invader, exposedDiverIds);

    return nextX < 0 || nextX + invader.width > game.boardWidth;
  });

  if (wouldHitWall) {
    return {
      ...game,
      invaders: game.invaders.map((invader) =>
        invader.isActive
          ? {
              ...invader,
              isDiving: getNextDiverState(invader, exposedDiverIds),
              y: invader.y + getInvaderDropY(invader, exposedDiverIds),
            }
          : invader,
      ),
      marchDirection: (game.marchDirection * -1) as SpaceInvadersDirection,
    };
  }

  return {
    ...game,
    invaders: game.invaders.map((invader) =>
      invader.isActive
        ? {
            ...invader,
            x:
              invader.x +
              game.marchDirection * getInvaderStepX(invader, exposedDiverIds),
            isDiving: getNextDiverState(invader, exposedDiverIds),
          }
        : invader,
    ),
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

function getInvaderDropY(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return isExposedDiver(invader, exposedDiverIds) ? DIVER_DROP_Y : INVADER_DROP_Y;
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

function createPlayerShot(player: SpaceInvadersPlayer): SpaceInvadersShot {
  return {
    height: SHOT_HEIGHT,
    velocityY: SHOT_SPEED,
    width: SHOT_WIDTH,
    x: player.x + player.width / 2 - SHOT_WIDTH / 2,
    y: player.y - SHOT_HEIGHT - 2,
  };
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
) {
  const candidates = Array.from({ length: Math.max(0, rows - 1) }, (_, row) =>
    Array.from({ length: columns }, (_, column) => `${row}:${column}`),
  ).flat();
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

function getRandomIndex(candidateCount: number, random: SpaceInvadersRandomSource) {
  if (candidateCount <= 1) {
    return 0;
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  return Math.max(0, Math.min(candidateCount - 1, Math.floor(randomValue * candidateCount)));
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
