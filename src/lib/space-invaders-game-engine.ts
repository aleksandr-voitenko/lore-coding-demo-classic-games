import {
  DIVER_DROP_Y,
  DIVER_STEP_MULTIPLIER,
  EXPLOSION_PADDING_BY_KIND,
  EXPLOSION_TTL_TICKS,
  INVADER_DROP_Y,
  INVADER_FIRE_COOLDOWN_TICKS,
  INVADER_HIT_RECOVERY_TICKS,
  INVADER_STEP_X,
  PLAYER_BOTTOM_MARGIN,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_COMMON_POWER_UP_KINDS,
  SPACE_INVADERS_EXPLOSION_VARIANTS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_TICK_DELAY_MS,
  UFO_COOLDOWN_TICKS,
  UFO_HEIGHT,
  UFO_POINT_VALUES,
  UFO_SPEED,
  UFO_WIDTH,
  UFO_Y,
} from "./space-invaders/constants";
export {
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_ARMORED_ALIEN_COUNT,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_SIZE_OPTIONS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
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
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_POWER_UP_KINDS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_TICK_DELAY_MS,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "./space-invaders/constants";
import {
  createSpaceInvadersFormation,
  createSpaceInvadersSplitterFragments,
  getInvaderHitPointsAfterPlayerShot,
  getSpaceInvadersFormationSpec,
  isSpaceInvaderShielded,
} from "./space-invaders/formation";
export {
  createSpaceInvadersFormation,
  isSpaceInvaderShielded,
} from "./space-invaders/formation";
import {
  clamp,
  normalizeSpaceInvadersDimension,
  rectanglesIntersect,
} from "./space-invaders/geometry";
import { getInvaderCollisionBounds } from "./space-invaders/hitboxes";
import {
  advanceInvaderShotPositions,
  advancePlayerShotPosition,
  createInitialPlayerBurstState,
  createNextPlayerBurstShot,
  createPlayerShots,
  isInvaderShotDangerous,
  isPlayerShotActive,
  maybeCreateSpaceInvadersRevengeShots,
  maybeFireInvaderShot,
} from "./space-invaders/projectiles";
import { getRandomIndex, getRandomValue } from "./space-invaders/random";
import {
  advanceSpaceInvadersHitStreak,
  advanceSpaceInvadersUfoChain,
  getCombinedSpaceInvadersScoreTarget,
  getSpaceInvadersHitStreakPopupScale,
  getSpaceInvadersInvaderScorePopupLabel,
  getSpaceInvadersMultiKillBonus,
  resetSpaceInvadersHitStreak,
} from "./space-invaders/scoring";
import type {
  CreateSpaceInvadersGameOptions,
  SpaceInvader,
  SpaceInvadersDirection,
  SpaceInvadersExplosion,
  SpaceInvadersExplosionKind,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerShot,
  SpaceInvadersPowerUp,
  SpaceInvadersRandomSource,
  SpaceInvadersScorePopup,
  SpaceInvadersScorePopupOptions,
  SpaceInvadersScoreTarget,
  SpaceInvadersUfoState,
} from "./space-invaders/types";
export type {
  CreateSpaceInvadersGameOptions,
  SpaceInvader,
  SpaceInvaderKind,
  SpaceInvadersDirection,
  SpaceInvadersExplosion,
  SpaceInvadersExplosionKind,
  SpaceInvadersExplosionVariant,
  SpaceInvadersGameState,
  SpaceInvadersInvaderBurst,
  SpaceInvadersInvaderShot,
  SpaceInvadersInvaderShotKind,
  SpaceInvadersMultiKillCombo,
  SpaceInvadersPendingShotPowerUp,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerBurst,
  SpaceInvadersPlayerShot,
  SpaceInvadersPlayerShotKind,
  SpaceInvadersPowerUp,
  SpaceInvadersPowerUpKind,
  SpaceInvadersRandomSource,
  SpaceInvadersScorePopup,
  SpaceInvadersShot,
  SpaceInvadersStatus,
  SpaceInvadersUfoState,
} from "./space-invaders/types";

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
    playerVolleyHasArmoredHit: false,
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
        ? createInitialPlayerBurstState(createdShots.length)
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
  let playerVolleyHasArmoredHit = game.playerVolleyHasArmoredHit;
  let playerVolleyHasUnscoredExit = game.playerVolleyHasUnscoredExit;
  let destroyedInvaderPopupPoints = 0;
  let invaderPopupScoreScale = 1;

  for (const shot of game.playerShots) {
    const movedShot = advancePlayerShotPosition(shot);
    const damagedInvaderIds = new Set(movedShot.damagedInvaderIds ?? []);
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
      (invader) =>
        invader.isActive &&
        !damagedInvaderIds.has(invader.id) &&
        rectanglesIntersect(movedShot, getInvaderCollisionBounds(invader)),
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

    const hitTargets =
      movedShot.kind === "piercing"
        ? vulnerableHitInvaders
        : vulnerableHitInvaders.slice(0, 1);
    const hitResults = hitTargets.map((invader) => ({
      hitPoints: getInvaderHitPointsAfterPlayerShot(invader),
      invader,
    }));
    const damagedArmoredInvaders = hitResults.filter(
      ({ hitPoints, invader }) => invader.kind === "armored" && hitPoints > 0,
    );
    const destroyedInvaders = hitResults
      .filter(({ hitPoints }) => hitPoints <= 0)
      .map(({ invader }) => invader);
    const damagedArmoredHitPointsById = new Map(
      damagedArmoredInvaders.map(({ hitPoints, invader }) => [invader.id, hitPoints]),
    );
    const destroyedInvaderIds = new Set(
      destroyedInvaders.map((invader) => invader.id),
    );
    const shotDamagedInvaderIds = [...damagedInvaderIds, ...hitTargets.map(({ id }) => id)];
    const destroyedInvaderPoints = destroyedInvaders.reduce(
      (total, invader) => total + invader.points,
      0,
    );
    const invadersAfterDestroy = nextGame.invaders.map((invader) => {
      if (destroyedInvaderIds.has(invader.id)) {
        return { ...invader, hitPoints: 0, isActive: false };
      }

      const hitPoints = damagedArmoredHitPointsById.get(invader.id);

      return hitPoints === undefined ? invader : { ...invader, hitPoints };
    });
    const splitterFragments = createSpaceInvadersSplitterFragments(
      destroyedInvaders,
      nextGame.boardWidth,
    );
    const invaders = [...invadersAfterDestroy, ...splitterFragments];
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

    if (destroyedInvaders.length > 0 && !didScoreWithShot) {
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
    } else if (damagedArmoredInvaders.length > 0) {
      playerVolleyHasArmoredHit = true;
    }

    nextGame = {
      ...gameWithHits,
      status: activeInvaderCount === 0 ? "won" : nextGame.status,
    };

    if (movedShot.kind === "piercing" && nextGame.status !== "won") {
      activeShots.push({
        ...movedShot,
        damagedInvaderIds: shotDamagedInvaderIds,
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
    playerVolleyHasArmoredHit,
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

  return {
    ...game,
    ...createNextPlayerBurstShot(game),
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

  const {
    invaderShots: movedShots,
    nextInvaderShotId,
  } = advanceInvaderShotPositions(game);
  const gameAfterShotCollisions = resolveOpposingShotCollisions(
    {
      ...game,
      invaderShots: movedShots,
      nextInvaderShotId,
    },
    random,
  );
  const hittingShots = gameAfterShotCollisions.invaderShots.filter(
    (shot) =>
      isInvaderShotDangerous(shot) &&
      rectanglesIntersect(shot, gameAfterShotCollisions.player),
  );
  const didHitPlayer = hittingShots.length > 0;

  if (!didHitPlayer) {
    return gameAfterShotCollisions;
  }

  if (gameAfterShotCollisions.playerRespawnTicks > 0) {
    return gameAfterShotCollisions;
  }

  if (gameAfterShotCollisions.playerShieldTicks > 0) {
    return {
      ...gameAfterShotCollisions,
      invaderShots: gameAfterShotCollisions.invaderShots.filter(
        (shot) => !hittingShots.includes(shot),
      ),
    };
  }

  const lives = gameAfterShotCollisions.lives - 1;
  const gameWithExplosion = createSpaceInvadersExplosion(
    gameAfterShotCollisions,
    "player",
    gameAfterShotCollisions.player,
    random,
  );

  return {
    ...gameWithExplosion,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots: [],
    nextInvaderShotId: gameAfterShotCollisions.nextInvaderShotId,
    hitStreak: 0,
    lives,
    player: createCenteredPlayer(
      gameAfterShotCollisions.boardWidth,
      gameAfterShotCollisions.boardHeight,
    ),
    playerBurst: null,
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    status: lives <= 0 ? "lost" : gameAfterShotCollisions.status,
  };
}

function resolveOpposingShotCollisions(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.playerShots.length === 0 || game.invaderShots.length === 0) {
    return game;
  }

  const collidedPlayerShotIds = new Set<string>();
  const collidedInvaderShotIds = new Set<string>();
  let didCollide = false;
  let nextGame = game;

  for (const playerShot of game.playerShots) {
    for (const invaderShot of game.invaderShots) {
      if (rectanglesIntersect(playerShot, invaderShot)) {
        didCollide = true;
        if (!isPlayerShotInvulnerable(playerShot)) {
          collidedPlayerShotIds.add(playerShot.id);
        }
        if (!isInvaderShotInvulnerable(invaderShot)) {
          collidedInvaderShotIds.add(invaderShot.id);
        }
        nextGame = createSpaceInvadersExplosion(
          nextGame,
          "projectile",
          getOpposingShotCollisionExplosionTarget(playerShot, invaderShot),
          random,
        );
      }
    }
  }

  if (!didCollide) {
    return game;
  }

  const playerShots = game.playerShots.filter(
    (shot) => !collidedPlayerShotIds.has(shot.id),
  );
  const isPlayerVolleyFinished = playerShots.length === 0 && game.playerBurst === null;

  return {
    ...nextGame,
    invaderShots: game.invaderShots.filter(
      (shot) => !collidedInvaderShotIds.has(shot.id),
    ),
    playerShots,
    playerVolleyHasArmoredHit: isPlayerVolleyFinished
      ? false
      : game.playerVolleyHasArmoredHit,
    playerVolleyHasScored: isPlayerVolleyFinished ? false : game.playerVolleyHasScored,
    playerVolleyHasUnscoredExit: isPlayerVolleyFinished
      ? false
      : game.playerVolleyHasUnscoredExit,
  };
}

function isPlayerShotInvulnerable(
  shot: Pick<SpaceInvadersPlayerShot, "kind">,
) {
  return shot.kind === "piercing";
}

function isInvaderShotInvulnerable(
  shot: Pick<SpaceInvadersInvaderShot, "kind">,
) {
  return shot.kind === "armor-wave";
}

function getOpposingShotCollisionExplosionTarget(
  playerShot: SpaceInvadersPlayerShot,
  invaderShot: SpaceInvadersInvaderShot,
): SpaceInvadersScoreTarget {
  const left = Math.max(playerShot.x, invaderShot.x);
  const right = Math.min(playerShot.x + playerShot.width, invaderShot.x + invaderShot.width);
  const top = Math.max(playerShot.y, invaderShot.y);
  const bottom = Math.min(
    playerShot.y + playerShot.height,
    invaderShot.y + invaderShot.height,
  );
  const centerX =
    left < right
      ? (left + right) / 2
      : (playerShot.x + playerShot.width / 2 + invaderShot.x + invaderShot.width / 2) /
        2;
  const centerY =
    top < bottom
      ? (top + bottom) / 2
      : (playerShot.y + playerShot.height / 2 + invaderShot.y + invaderShot.height / 2) /
        2;

  return {
    height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
    width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
    x: centerX - SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH / 2,
    y: centerY - SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT / 2,
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
    game.playerVolleyHasUnscoredExit &&
    !game.playerVolleyHasScored &&
    !game.playerVolleyHasArmoredHit
      ? resetSpaceInvadersHitStreak(game)
      : game;

  if (
    !resolvedGame.playerVolleyHasArmoredHit &&
    !resolvedGame.playerVolleyHasScored &&
    !resolvedGame.playerVolleyHasUnscoredExit
  ) {
    return resolvedGame;
  }

  return {
    ...resolvedGame,
    playerVolleyHasArmoredHit: false,
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
      .filter(isDiverMovementInvader)
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
  return isDiverMovementInvader(invader) && exposedDiverIds.has(invader.id);
}

function isDiverMovementInvader(invader: Pick<SpaceInvader, "kind">) {
  return invader.kind === "diver" || invader.kind === "splitter-fragment";
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
