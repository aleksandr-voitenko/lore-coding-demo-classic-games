export type SpaceInvadersStatus = "ready" | "running" | "paused" | "lost" | "won";

export type SpaceInvadersDirection = -1 | 1;

export type SpaceInvadersPlayer = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvader = {
  column: number;
  height: number;
  id: string;
  isActive: boolean;
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

export type SpaceInvadersGameState = {
  alienCount: number;
  baseY: number;
  boardHeight: number;
  boardWidth: number;
  invaders: SpaceInvader[];
  lives: number;
  marchDirection: SpaceInvadersDirection;
  player: SpaceInvadersPlayer;
  playerShot: SpaceInvadersShot | null;
  score: number;
  status: SpaceInvadersStatus;
};

export type CreateSpaceInvadersGameOptions = {
  alienCount?: number;
  boardHeight?: number;
  boardWidth?: number;
};

export const SPACE_INVADERS_BOARD_WIDTH = 420;
export const SPACE_INVADERS_BOARD_HEIGHT = 560;
export const SPACE_INVADERS_COLUMNS = 11;
export const SPACE_INVADERS_ROWS = 5;
export const SPACE_INVADERS_STARTING_LIVES = 3;
export const SPACE_INVADERS_BASE_Y = 492;
export const SPACE_INVADERS_TICK_DELAY_MS = 85;
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

const INVADER_DROP_Y = 4;
const INVADER_GAP_X = 5;
const INVADER_GAP_Y = 14;
const INVADER_HEIGHT = 23;
const INVADER_STEP_X = 2;
const INVADER_TOP = 64;
const INVADER_WIDTH = 28;
const PLAYER_BOTTOM_MARGIN = 10;
const INVADER_X = 38;
const PLAYER_HEIGHT = 50;
const PLAYER_SPEED = 24;
const PLAYER_WIDTH = 62;
const SHOT_HEIGHT = 22;
const SHOT_SPEED = -16;
const SHOT_WIDTH = 6;

export function createInitialSpaceInvadersGame({
  alienCount = SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
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
    invaders: createSpaceInvadersFormation({
      boardWidth: normalizedBoardWidth,
      columns: formation.columns,
      rows: formation.rows,
    }),
    lives: SPACE_INVADERS_STARTING_LIVES,
    marchDirection: 1,
    player: createCenteredPlayer(normalizedBoardWidth, normalizedBoardHeight),
    playerShot: null,
    score: 0,
    status: "ready",
  };
}

export function createSpaceInvadersFormation({
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  columns = SPACE_INVADERS_COLUMNS,
  rows = SPACE_INVADERS_ROWS,
}: {
  boardWidth?: number;
  columns?: number;
  rows?: number;
} = {}) {
  const formationWidth = columns * INVADER_WIDTH + (columns - 1) * INVADER_GAP_X;
  const startX = Math.max(INVADER_X, (boardWidth - formationWidth) / 2);

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column): SpaceInvader => {
      const x = startX + column * (INVADER_WIDTH + INVADER_GAP_X);
      const y = INVADER_TOP + row * (INVADER_HEIGHT + INVADER_GAP_Y);

      return {
        column,
        height: INVADER_HEIGHT,
        id: `${row}:${column}`,
        isActive: true,
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
  if (game.status === "lost" || game.status === "won") {
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
  if (game.status !== "running" || game.playerShot !== null) {
    return game;
  }

  return {
    ...game,
    playerShot: createPlayerShot(game.player),
  };
}

export function advanceSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  const gameAfterShot = advancePlayerShot(game);

  if (gameAfterShot.status === "won") {
    return gameAfterShot;
  }

  const marchedGame = marchInvaders(gameAfterShot);

  if (hasInvaderReachedBase(marchedGame)) {
    return {
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    };
  }

  return marchedGame;
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
}

function advancePlayerShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

  return {
    ...game,
    invaders,
    playerShot: null,
    score,
    status: activeInvaderCount === 0 ? "won" : game.status,
  };
}

function marchInvaders(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const wouldHitWall = activeInvaders.some((invader) => {
    const nextX = invader.x + game.marchDirection * INVADER_STEP_X;

    return nextX < 0 || nextX + invader.width > game.boardWidth;
  });

  if (wouldHitWall) {
    return {
      ...game,
      invaders: game.invaders.map((invader) =>
        invader.isActive ? { ...invader, y: invader.y + INVADER_DROP_Y } : invader,
      ),
      marchDirection: (game.marchDirection * -1) as SpaceInvadersDirection,
    };
  }

  return {
    ...game,
    invaders: game.invaders.map((invader) =>
      invader.isActive
        ? { ...invader, x: invader.x + game.marchDirection * INVADER_STEP_X }
        : invader,
    ),
  };
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

function getInvaderPoints(row: number) {
  if (row === 0) {
    return 30;
  }

  if (row <= 2) {
    return 20;
  }

  return 10;
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
