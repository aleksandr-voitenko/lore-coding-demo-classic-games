export {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  getSpaceInvadersPlayerSpeed,
  getSpaceInvadersTickDelay,
  isSpaceInvaderShielded,
  moveSpaceInvadersPlayer,
  pauseSpaceInvadersGame,
  restartSpaceInvadersGame,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_ARMORED_ALIEN_COUNT,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
  startSpaceInvadersGame,
} from "./space-invaders-game-engine";
export type {
  SpaceInvader,
  SpaceInvadersExplosion,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersPowerUp,
  SpaceInvadersScorePopup,
} from "./space-invaders-game-engine";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  type SpaceInvader,
  type SpaceInvadersExplosion,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersPowerUp,
  type SpaceInvadersScorePopup,
} from "./space-invaders-game-engine";

export function createRunningGame(
  overrides: Partial<SpaceInvadersGameState> = {},
): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame({ random: () => 0 }),
    status: "running",
    ...overrides,
  };
}

export function getDiverIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "diver")
    .map((invader) => invader.id);
}

export function getShieldBearerIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "shield-bearer")
    .map((invader) => invader.id);
}

export function getRevengeAlienIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "revenge")
    .map((invader) => invader.id);
}

export function getSplitterAlienIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "splitter")
    .map((invader) => invader.id);
}

export function getArmoredAlienIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "armored")
    .map((invader) => invader.id);
}

export function withOnlyActiveInvader(
  game: SpaceInvadersGameState,
  activeInvader: SpaceInvader,
) {
  return {
    ...game,
    invaders: game.invaders.map((invader) => ({
      ...invader,
      ...(invader.id === activeInvader.id ? activeInvader : {}),
      isActive: invader.id === activeInvader.id,
    })),
  };
}

export function createInvaderShotFixture(
  overrides: Partial<SpaceInvadersInvaderShot> = {},
): SpaceInvadersInvaderShot {
  return {
    ageTicks: 0,
    height: 20,
    id: "invader-shot-test",
    kind: "standard",
    sourceColumn: 0,
    sourceInvaderId: "4:0",
    sourceRow: 4,
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.2,
    width: 5,
    x: 100,
    y: 100,
    ...overrides,
  };
}

export function createExplosionFixture(
  overrides: Partial<SpaceInvadersExplosion> = {},
): SpaceInvadersExplosion {
  return {
    ageTicks: 0,
    height: 46,
    id: "explosion-test",
    kind: "invader",
    ttlTicks: 12,
    variant: 1,
    width: 46,
    x: 100,
    y: 100,
    ...overrides,
  };
}

export function createScorePopupFixture(
  overrides: Partial<SpaceInvadersScorePopup> = {},
): SpaceInvadersScorePopup {
  return {
    ageTicks: 0,
    height: 22,
    id: "score-popup-test",
    points: 30,
    ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
    width: 32,
    x: 100,
    y: 100,
    ...overrides,
  };
}

export function createPowerUpFixture(
  overrides: Partial<SpaceInvadersPowerUp> = {},
): SpaceInvadersPowerUp {
  return {
    height: SPACE_INVADERS_POWER_UP_SIZE,
    id: "power-up-test",
    kind: "bonus-score",
    velocityY: SPACE_INVADERS_POWER_UP_SPEED,
    width: SPACE_INVADERS_POWER_UP_SIZE,
    x: 100,
    y: 100,
    ...overrides,
  };
}

export function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

export function createCatchablePowerUp(
  game: SpaceInvadersGameState,
  overrides: Partial<SpaceInvadersPowerUp> = {},
): SpaceInvadersPowerUp {
  const width = overrides.width ?? 18;

  return createPowerUpFixture({
    x: game.player.x + game.player.width / 2 - width / 2,
    y: game.player.y - SPACE_INVADERS_POWER_UP_SPEED,
    width,
    ...overrides,
  });
}

export function getInvader(
  game: SpaceInvadersGameState,
  row: number,
  column: number,
): SpaceInvader {
  const invader = game.invaders.find(
    (candidate) => candidate.row === row && candidate.column === column,
  );

  if (invader === undefined) {
    throw new Error(`Missing invader at row ${row}, column ${column}`);
  }

  return invader;
}

export function centerPlayerUnderInvader(
  game: SpaceInvadersGameState,
  invader: SpaceInvader,
) {
  return {
    ...game.player,
    x: invader.x + invader.width / 2 - game.player.width / 2,
  };
}

export function createPlayerShotAlignedWith(
  target: { height: number; width: number; x: number; y: number },
  game = createRunningGame(),
) {
  const shot = fireSpaceInvadersShot(game).playerShots[0]!;

  return {
    ...shot,
    x: target.x + target.width / 2 - shot.width / 2,
    y: target.y + target.height / 2 - shot.height / 2 - shot.velocityY,
  };
}

export function fireFromOnlyInvader(row: number, column = 5) {
  const game = createInitialSpaceInvadersGame();
  const shooter = {
    ...getInvader(game, row, column),
    kind: "standard" as const,
  };
  const runningGame = withOnlyActiveInvader(
    createRunningGame({
      invaderShotCooldownTicks: 0,
      player: centerPlayerUnderInvader(game, shooter),
    }),
    shooter,
  );

  return {
    advanced: advanceSpaceInvadersGame(runningGame),
    shooter,
  };
}

export function advanceSpaceInvadersTicks(
  game: SpaceInvadersGameState,
  ticks: number,
) {
  let advanced = game;

  for (let tick = 0; tick < ticks; tick += 1) {
    advanced = advanceSpaceInvadersGame(advanced, () => 0);
  }

  return advanced;
}
