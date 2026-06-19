import {
  EXPLOSION_PADDING_BY_KIND,
  EXPLOSION_TTL_TICKS,
  INVADER_HIT_RECOVERY_TICKS,
  PLAYER_BOTTOM_MARGIN,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COMMON_POWER_UP_KINDS,
  SPACE_INVADERS_EXPLOSION_VARIANTS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  UFO_COOLDOWN_TICKS,
  UFO_HEIGHT,
  UFO_POINT_VALUES,
  UFO_WIDTH,
  UFO_Y,
} from "./constants";
import { getRandomIndex, getRandomValue } from "./random";
import {
  getCombinedSpaceInvadersScoreTarget,
  getSpaceInvadersInvaderScorePopupLabel,
  getSpaceInvadersMultiKillBonus,
} from "./scoring";
import type {
  SpaceInvader,
  SpaceInvadersDirection,
  SpaceInvadersExplosion,
  SpaceInvadersExplosionKind,
  SpaceInvadersGameState,
  SpaceInvadersPowerUp,
  SpaceInvadersRandomSource,
  SpaceInvadersScorePopup,
  SpaceInvadersScorePopupOptions,
  SpaceInvadersScoreTarget,
  SpaceInvadersUfoState,
} from "./types";

export function createSpaceInvadersExplosion(
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

export function createSpaceInvadersScorePopup(
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

export function continueSpaceInvadersMultiKillCombo(
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

export function finalizeSpaceInvadersMultiKillCombo(
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

export function damageSpaceInvadersPlayer(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
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
    player: createCenteredSpaceInvadersPlayer(game.boardWidth, game.boardHeight),
    playerBurst: null,
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    status: lives <= 0 ? "lost" : game.status,
  };
}

export function getProjectileCollisionExplosionTarget(
  firstTarget: { height: number; width: number; x: number; y: number },
  secondTarget: { height: number; width: number; x: number; y: number },
): SpaceInvadersScoreTarget {
  const left = Math.max(firstTarget.x, secondTarget.x);
  const right = Math.min(
    firstTarget.x + firstTarget.width,
    secondTarget.x + secondTarget.width,
  );
  const top = Math.max(firstTarget.y, secondTarget.y);
  const bottom = Math.min(
    firstTarget.y + firstTarget.height,
    secondTarget.y + secondTarget.height,
  );
  const centerX =
    left < right
      ? (left + right) / 2
      : (firstTarget.x +
          firstTarget.width / 2 +
          secondTarget.x +
          secondTarget.width / 2) /
        2;
  const centerY =
    top < bottom
      ? (top + bottom) / 2
      : (firstTarget.y +
          firstTarget.height / 2 +
          secondTarget.y +
          secondTarget.height / 2) /
        2;

  return {
    height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
    width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
    x: centerX - SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH / 2,
    y: centerY - SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT / 2,
  };
}

export function createCenteredSpaceInvadersPlayer(
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
) {
  return {
    height: PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    x: (boardWidth - PLAYER_WIDTH) / 2,
    y: boardHeight - PLAYER_HEIGHT - PLAYER_BOTTOM_MARGIN,
  };
}

export function maybeCreateSpaceInvadersPowerUpDrop(
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

export function createInitialSpaceInvadersUfo(): SpaceInvadersUfoState {
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

export function deactivateSpaceInvadersUfo(
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

function getNextSpaceInvadersUfoPoints(points: number) {
  const pointIndex = UFO_POINT_VALUES.findIndex((value) => value === points);
  const nextIndex = pointIndex === -1 ? 0 : (pointIndex + 1) % UFO_POINT_VALUES.length;

  return UFO_POINT_VALUES[nextIndex] ?? UFO_POINT_VALUES[0];
}
