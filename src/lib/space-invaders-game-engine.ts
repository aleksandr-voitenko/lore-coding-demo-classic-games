import {
  DIVER_DROP_Y,
  DIVER_STEP_MULTIPLIER,
  EXPLOSION_PADDING_BY_KIND,
  FORMATION_MAX_SPEED_MULTIPLIER,
  FORMATION_SPEEDUP_START_RATIO,
  INVADER_DROP_Y,
  INVADER_FIRE_COOLDOWN_TICKS,
  INVADER_STEP_X,
  PLAYER_SPEED,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_TICK_DELAY_MS,
  UFO_SPEED,
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
  SPACE_INVADERS_MINE_LAYER_ALIEN_COUNT,
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
  SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT,
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
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
} from "./space-invaders/formation";
export {
  createSpaceInvadersFormation,
  isSpaceInvaderShielded,
} from "./space-invaders/formation";
import {
  continueSpaceInvadersMultiKillCombo,
  createInitialSpaceInvadersUfo,
  createSpaceInvadersExplosion,
  deactivateSpaceInvadersUfo,
  finalizeSpaceInvadersMultiKillCombo,
  getProjectileCollisionExplosionTarget,
  maybeCreateSpaceInvadersPowerUpDrop,
} from "./space-invaders/effects";
import {
  clamp,
  normalizeSpaceInvadersDimension,
  rectanglesIntersect,
} from "./space-invaders/geometry";
import { getInvaderCollisionBounds } from "./space-invaders/hitboxes";
import {
  absorbSpaceInvadersPlayerHitShots,
  advanceSpaceInvadersPlayerBurst,
  advanceSpaceInvadersPlayerPowerUps,
  advanceSpaceInvadersPlayerRecovery,
  canSpaceInvadersPlayerBeDamaged,
  createInitialSpaceInvadersPlayerState,
  damageSpaceInvadersPlayer,
  fireSpaceInvadersPlayerShot,
  hasSpaceInvadersPlayerShield,
  isSpaceInvadersPlayerRespawning,
  isSpaceInvadersPlayerVolleyFinished,
  moveSpaceInvadersPlayerState,
} from "./space-invaders/player-state";
import {
  advanceInvaderShotPositions,
  advanceSpaceInvadersRevengeVolleys,
  createCommanderShardShots,
  isInvaderShotDangerous,
  maybePrimeSpaceInvadersRevengeVolley,
  maybeFireInvaderShot,
} from "./space-invaders/projectiles";
import { advanceSpaceInvadersPlayerShots } from "./space-invaders/player-shots";
import {
  getCombinedSpaceInvadersScoreTarget,
  resetSpaceInvadersHitStreak,
} from "./space-invaders/scoring";
import type {
  CreateSpaceInvadersGameOptions,
  SpaceInvader,
  SpaceInvadersDirection,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersRandomSource,
  SpaceInvadersScoreTarget,
  SpaceInvadersPlayerShot,
} from "./space-invaders/types";

type MineBlastInvaderDamage = {
  damagedArmoredInvaders: {
    hitPoints: number;
    invader: SpaceInvader;
  }[];
  destroyedInvaderPoints: number;
  destroyedInvaders: SpaceInvader[];
};

type MineBlastDamageSets = {
  invaderShotIds: Set<string>;
  playerShotIds: Set<string>;
};

type MineBlastResolution = {
  didDamagePlayer: boolean;
  game: SpaceInvadersGameState;
};

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
    ...createInitialSpaceInvadersPlayerState(
      normalizedBoardWidth,
      normalizedBoardHeight,
    ),
    powerUps: [],
    revengeVolleys: [],
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
  return moveSpaceInvadersPlayerState(game, deltaX);
}

export function moveSpaceInvadersPlayerLeft(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, -PLAYER_SPEED);
}

export function moveSpaceInvadersPlayerRight(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, PLAYER_SPEED);
}

export function fireSpaceInvadersShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  return fireSpaceInvadersPlayerShot(game);
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
  const gameAfterPowerUps = advanceSpaceInvadersPlayerPowerUps(
    gameAfterMultiKillComboWindow,
  );
  const gameAfterShot = advanceSpaceInvadersPlayerShots(gameAfterPowerUps, random);

  if (gameAfterShot.status === "won") {
    return finalizeSpaceInvadersPlayerVolley(
      finalizeSpaceInvadersMultiKillCombo(gameAfterShot),
    );
  }

  const gameAfterPlayerBurst = advanceSpaceInvadersPlayerBurst(gameAfterShot);
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

  if (gameAfterInvaderShots.status === "won") {
    return finalizeSpaceInvadersMultiKillCombo(gameAfterInvaderShots);
  }

  const gameAfterRevengeVolleys =
    advanceSpaceInvadersRevengeVolleys(gameAfterInvaderShots);
  const { game: gameAfterFreezeTick, isFrozen: areAliensFrozen } =
    advanceAlienFreeze(gameAfterRevengeVolleys);

  if (areAliensFrozen) {
    return advanceSpaceInvadersPlayerRecovery(gameAfterFreezeTick);
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

  return advanceSpaceInvadersPlayerRecovery(marchedGame);
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
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
  const hittingMineShots = hittingShots.filter((shot) => shot.kind === "mine");
  const gameAfterMineHits =
    hittingMineShots.length === 0
      ? gameAfterShotCollisions
      : detonateMineShots(gameAfterShotCollisions, hittingMineShots, random).game;

  if (
    hittingMineShots.length > 0 &&
    (isSpaceInvadersPlayerRespawning(gameAfterMineHits) ||
      gameAfterMineHits.status === "lost")
  ) {
    return gameAfterMineHits;
  }

  const remainingHittingShots = gameAfterMineHits.invaderShots.filter(
    (shot) =>
      isInvaderShotDangerous(shot) &&
      rectanglesIntersect(shot, gameAfterMineHits.player),
  );

  if (remainingHittingShots.length === 0) {
    return gameAfterMineHits;
  }

  if (isSpaceInvadersPlayerRespawning(gameAfterMineHits)) {
    return gameAfterMineHits;
  }

  if (hasSpaceInvadersPlayerShield(gameAfterMineHits)) {
    return absorbSpaceInvadersPlayerHitShots(
      gameAfterMineHits,
      remainingHittingShots,
    );
  }

  return damageSpaceInvadersPlayer(gameAfterMineHits, random);
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
  const splitCommanderShotIds = new Set<string>();
  const collidedMineShots = new Map<string, SpaceInvadersInvaderShot>();
  let didCollide = false;
  let nextGame = game;

  // Collect all same-tick projectile collisions before mutating shots or spawning shards.
  for (const playerShot of game.playerShots) {
    for (const invaderShot of game.invaderShots) {
      if (rectanglesIntersect(playerShot, invaderShot)) {
        didCollide = true;
        if (!isPlayerShotInvulnerable(playerShot)) {
          collidedPlayerShotIds.add(playerShot.id);
        }
        if (!isInvaderShotInvulnerable(invaderShot)) {
          collidedInvaderShotIds.add(invaderShot.id);
          if (invaderShot.kind === "mine") {
            collidedMineShots.set(invaderShot.id, invaderShot);
          } else if (shouldSplitCommanderShotOnCollision(invaderShot)) {
            splitCommanderShotIds.add(invaderShot.id);
          }
        }
        if (invaderShot.kind !== "mine") {
          nextGame = createSpaceInvadersExplosion(
            nextGame,
            "projectile",
            getProjectileCollisionExplosionTarget(playerShot, invaderShot),
            random,
          );
        }
      }
    }
  }

  if (!didCollide) {
    return game;
  }

  const splitCommanderShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = game.nextInvaderShotId;

  if (collidedMineShots.size > 0) {
    const mineBlastResolution = detonateMineShots(
      nextGame,
      [...collidedMineShots.values()],
      random,
      {
        invaderShotIds: collidedInvaderShotIds,
        playerShotIds: collidedPlayerShotIds,
      },
    );

    nextGame = mineBlastResolution.game;

    if (mineBlastResolution.didDamagePlayer) {
      return nextGame;
    }
  }

  const playerShots = game.playerShots.filter(
    (shot) => !collidedPlayerShotIds.has(shot.id),
  );
  const isPlayerVolleyFinished = playerShots.length === 0 && game.playerBurst === null;

  for (const invaderShot of game.invaderShots) {
    if (!splitCommanderShotIds.has(invaderShot.id)) {
      continue;
    }

    const shards = createCommanderShardShots(invaderShot, nextInvaderShotId);
    splitCommanderShots.push(...shards);
    nextInvaderShotId += shards.length;
  }

  return {
    ...nextGame,
    invaderShots: [
      ...game.invaderShots.filter((shot) => !collidedInvaderShotIds.has(shot.id)),
      ...splitCommanderShots,
    ],
    nextInvaderShotId,
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

function shouldSplitCommanderShotOnCollision(
  shot: Pick<SpaceInvadersInvaderShot, "kind">,
) {
  return shot.kind === "commander";
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

function detonateMineShots(
  game: SpaceInvadersGameState,
  mineShots: SpaceInvadersInvaderShot[],
  random: SpaceInvadersRandomSource,
  destroyedShotIds: MineBlastDamageSets = {
    invaderShotIds: new Set<string>(),
    playerShotIds: new Set<string>(),
  },
): MineBlastResolution {
  const queuedMineShots = [...mineShots];
  const detonatedMineShotIds = new Set<string>();
  let didDamagePlayer = false;
  let nextGame = game;

  // Mines can trigger other mines; remove destroyed shots only after the chain resolves.
  while (queuedMineShots.length > 0) {
    const mineShot = queuedMineShots.shift()!;

    if (detonatedMineShotIds.has(mineShot.id)) {
      continue;
    }

    detonatedMineShotIds.add(mineShot.id);
    destroyedShotIds.invaderShotIds.add(mineShot.id);

    const blastBounds = getMineBlastBounds(mineShot);

    nextGame = createSpaceInvadersExplosion(nextGame, "mine", mineShot, random);
    nextGame = applyMineBlastInvaderDamage(nextGame, blastBounds, random);

    for (const playerShot of game.playerShots) {
      if (
        !destroyedShotIds.playerShotIds.has(playerShot.id) &&
        rectanglesIntersect(playerShot, blastBounds)
      ) {
        destroyedShotIds.playerShotIds.add(playerShot.id);
      }
    }

    for (const invaderShot of game.invaderShots) {
      if (
        destroyedShotIds.invaderShotIds.has(invaderShot.id) ||
        !rectanglesIntersect(invaderShot, blastBounds)
      ) {
        continue;
      }

      destroyedShotIds.invaderShotIds.add(invaderShot.id);

      if (invaderShot.kind === "mine") {
        queuedMineShots.push(invaderShot);
      }
    }

    didDamagePlayer =
      didDamagePlayer || doesMineBlastDamagePlayer(nextGame, blastBounds);
  }

  nextGame = {
    ...nextGame,
    invaderShots: nextGame.invaderShots.filter(
      (shot) => !destroyedShotIds.invaderShotIds.has(shot.id),
    ),
    playerShots: nextGame.playerShots.filter(
      (shot) => !destroyedShotIds.playerShotIds.has(shot.id),
    ),
  };

  if (didDamagePlayer) {
    return {
      didDamagePlayer: true,
      game: damageSpaceInvadersPlayer(nextGame, random),
    };
  }

  return {
    didDamagePlayer: false,
    game: nextGame,
  };
}

function getMineBlastBounds(
  mineShot: Pick<SpaceInvadersInvaderShot, "height" | "width" | "x" | "y">,
): SpaceInvadersScoreTarget {
  const padding = EXPLOSION_PADDING_BY_KIND.mine;
  const height = mineShot.height + padding * 2;
  const width = mineShot.width + padding * 2;

  return {
    height,
    width,
    x: mineShot.x + mineShot.width / 2 - width / 2,
    y: mineShot.y + mineShot.height / 2 - height / 2,
  };
}

function applyMineBlastInvaderDamage(
  game: SpaceInvadersGameState,
  blastBounds: SpaceInvadersScoreTarget,
  random: SpaceInvadersRandomSource,
) {
  const hitInvaders = game.invaders.filter(
    (invader) =>
      invader.isActive &&
      rectanglesIntersect(blastBounds, getInvaderCollisionBounds(invader)),
  );

  if (hitInvaders.length === 0) {
    return game;
  }

  const damage = getMineBlastInvaderDamage(hitInvaders);
  const damagedArmoredHitPointsById = new Map(
    damage.damagedArmoredInvaders.map(({ hitPoints, invader }) => [
      invader.id,
      hitPoints,
    ]),
  );
  const destroyedInvaderIds = new Set(
    damage.destroyedInvaders.map((invader) => invader.id),
  );
  const invadersAfterDamage = game.invaders.map((invader) => {
    if (destroyedInvaderIds.has(invader.id)) {
      return { ...invader, hitPoints: 0, isActive: false };
    }

    const hitPoints = damagedArmoredHitPointsById.get(invader.id);

    return hitPoints === undefined ? invader : { ...invader, hitPoints };
  });
  const splitterFragments = createSpaceInvadersSplitterFragments(
    damage.destroyedInvaders,
    game.boardWidth,
  );
  const invaders = [...invadersAfterDamage, ...splitterFragments];
  const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;
  let gameWithDamage: SpaceInvadersGameState = {
    ...game,
    invaders,
    score: game.score + damage.destroyedInvaderPoints,
    status: activeInvaderCount === 0 ? "won" : game.status,
  };

  for (const destroyedInvader of damage.destroyedInvaders) {
    gameWithDamage = createSpaceInvadersExplosion(
      gameWithDamage,
      "invader",
      destroyedInvader,
      random,
    );
    gameWithDamage = maybeCreateSpaceInvadersPowerUpDrop(
      gameWithDamage,
      destroyedInvader,
      random,
    );
  }

  gameWithDamage = maybePrimeSpaceInvadersRevengeVolley(
    gameWithDamage,
    damage.destroyedInvaders,
    random,
  );

  if (damage.destroyedInvaders.length === 0) {
    return gameWithDamage;
  }

  return continueSpaceInvadersMultiKillCombo(
    gameWithDamage,
    getCombinedSpaceInvadersScoreTarget(damage.destroyedInvaders),
    damage.destroyedInvaders.length,
    damage.destroyedInvaderPoints,
    1,
  );
}

function getMineBlastInvaderDamage(
  hitInvaders: SpaceInvader[],
): MineBlastInvaderDamage {
  const hitResults = hitInvaders.map((invader) => ({
    hitPoints: getInvaderHitPointsAfterPlayerShot(invader),
    invader,
  }));
  const damagedArmoredInvaders = hitResults.filter(
    ({ hitPoints, invader }) => invader.kind === "armored" && hitPoints > 0,
  );
  const destroyedInvaders = hitResults
    .filter(({ hitPoints }) => hitPoints <= 0)
    .map(({ invader }) => invader);
  const destroyedInvaderPoints = destroyedInvaders.reduce(
    (total, invader) => total + invader.points,
    0,
  );

  return {
    damagedArmoredInvaders,
    destroyedInvaderPoints,
    destroyedInvaders,
  };
}

function doesMineBlastDamagePlayer(
  game: SpaceInvadersGameState,
  blastBounds: SpaceInvadersScoreTarget,
) {
  return canSpaceInvadersPlayerBeDamaged(game, blastBounds);
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

  if (game.status !== "running" || isSpaceInvadersPlayerVolleyFinished(game)) {
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
  if (
    game.multiKillCombo === null ||
    !isSpaceInvadersPlayerVolleyFinished(game)
  ) {
    return game;
  }

  return finalizeSpaceInvadersMultiKillCombo(game);
}

function finalizeSpaceInvadersPlayerVolley(game: SpaceInvadersGameState) {
  if (!isSpaceInvadersPlayerVolleyFinished(game)) {
    return game;
  }

  // Reset clean-hit streaks only after a whole player volley exits without scoring or armor damage.
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

function marchInvaders(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const exposedDiverIds = getExposedDiverIds(activeInvaders);
  const formationSpeedMultiplier = getFormationSpeedMultiplier(
    game,
    activeInvaders.length,
  );
  const formationInvaders = activeInvaders.filter(
    (invader) => !isExposedDiver(invader, exposedDiverIds),
  );
  const wouldFormationHitWall = formationInvaders.some((invader) => {
    const nextX =
      invader.x +
      game.marchDirection *
        getInvaderStepX(invader, exposedDiverIds, formationSpeedMultiplier);

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
        x:
          invader.x +
          game.marchDirection *
            getInvaderStepX(invader, exposedDiverIds, formationSpeedMultiplier),
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

function getFormationSpeedMultiplier(
  game: Pick<SpaceInvadersGameState, "alienCount">,
  activeInvaderCount: number,
) {
  const speedupStartCount = game.alienCount * FORMATION_SPEEDUP_START_RATIO;

  if (activeInvaderCount <= 1) {
    return FORMATION_MAX_SPEED_MULTIPLIER;
  }

  if (activeInvaderCount >= speedupStartCount) {
    return 1;
  }

  const interpolationSpan = speedupStartCount - 1;
  const depletionProgress = (speedupStartCount - activeInvaderCount) / interpolationSpan;

  return 1 + depletionProgress * (FORMATION_MAX_SPEED_MULTIPLIER - 1);
}

function getInvaderStepX(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return (
    INVADER_STEP_X *
    getInvaderMovementMultiplier(invader, exposedDiverIds, formationSpeedMultiplier)
  );
}

function getInvaderMovementMultiplier(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return isExposedDiver(invader, exposedDiverIds)
    ? DIVER_STEP_MULTIPLIER
    : formationSpeedMultiplier;
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
